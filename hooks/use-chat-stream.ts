/**
 * Client reader for the /api/chat SSE stream, built on fetch and
 * ReadableStream, with abort support. If the server answers JSON instead
 * (non-stream path), the payload is replayed as the same events.
 */

import type { ChatEvent } from "@/lib/chat/stream";
import type { FollowUp, RichBlock } from "@/lib/chat/rich-message";

export type StreamHandlers = {
  onStatus?: (text: string) => void;
  onTextDelta?: (text: string) => void;
  onBlockPending?: (id: string, type: string) => void;
  onBlock?: (id: string, block: RichBlock) => void;
  onFollowUps?: (items: FollowUp[]) => void;
  onDone?: (data: { threadId: string; messageId: string; packsUsed?: string[] }) => void;
  onError?: (data: {
    code: string;
    message: string;
    retryable: boolean;
    requestId: string;
    fix?: string;
  }) => void;
};

export type StreamRequest = {
  message: string;
  mode?: string;
  threadId?: string;
  timezone?: string;
  action?: Record<string, unknown>;
};

function dispatchEvent(event: ChatEvent, handlers: StreamHandlers): void {
  switch (event.event) {
    case "status":
      handlers.onStatus?.(event.data.text);
      break;
    case "text_delta":
      handlers.onTextDelta?.(event.data.text);
      break;
    case "block_pending":
      handlers.onBlockPending?.(event.data.id, event.data.type);
      break;
    case "block":
      handlers.onBlock?.(event.data.id, event.data.block);
      break;
    case "follow_ups":
      handlers.onFollowUps?.(event.data.items);
      break;
    case "done":
      handlers.onDone?.(event.data);
      break;
    case "error":
      handlers.onError?.(event.data);
      break;
  }
}

export async function streamChatResponse(
  input: StreamRequest,
  handlers: StreamHandlers,
  signal?: AbortSignal,
): Promise<void> {
  let response: Response;
  try {
    response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
      body: JSON.stringify({
        message: input.message,
        mode: input.mode,
        threadId: input.threadId ?? undefined,
        timezone: input.timezone,
        action: input.action,
      }),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    handlers.onError?.({
      code: "OFFLINE",
      message: "You're offline. Your message will send when you reconnect.",
      retryable: true,
      requestId: "client",
    });
    return;
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("text/event-stream")) {
    const payload = (await response.json().catch(() => null)) as {
      data?: {
        reply?: string;
        blocks?: RichBlock[];
        followUps?: FollowUp[];
        threadId?: string;
        messageId?: string;
        packsUsed?: string[];
      };
      error?: string;
    } | null;
    if (!response.ok || !payload?.data?.reply) {
      handlers.onError?.({
        code: "UNKNOWN",
        message: "Something went wrong on our side. Your message is saved.",
        retryable: true,
        requestId: "client",
      });
      return;
    }
    const data = payload.data;
    if (data.reply) handlers.onTextDelta?.(data.reply);
    (data.blocks ?? []).forEach((block, i) =>
      handlers.onBlock?.(`block-${i}`, block),
    );
    if (data.followUps?.length) handlers.onFollowUps?.(data.followUps);
    handlers.onDone?.({
      threadId: data.threadId ?? "",
      messageId: data.messageId ?? "",
      packsUsed: data.packsUsed,
    });
    return;
  }

  const reader = response.body?.getReader();
  if (!reader) {
    handlers.onError?.({
      code: "UNKNOWN",
      message: "Something went wrong on our side. Your message is saved.",
      retryable: true,
      requestId: "client",
    });
    return;
  }
  const decoder = new TextDecoder();
  let buffer = "";
  let currentEvent = "";
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";
      for (const part of parts) {
        for (const line of part.split("\n")) {
          if (line.startsWith("event: ")) currentEvent = line.slice(7).trim();
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6)) as unknown;
              dispatchEvent({ event: currentEvent, data } as ChatEvent, handlers);
            } catch {
              // Skip a malformed event.
            }
          }
        }
        currentEvent = "";
      }
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return;
    handlers.onError?.({
      code: "OFFLINE",
      message: "You're offline. Your message will send when you reconnect.",
      retryable: true,
      requestId: "client",
    });
  }
}
