/**
 * Server-Sent Events for chat streaming, plus human error wording.
 * Events: status, text_delta, block_pending, block, follow_ups, done, error.
 * Raw JSON never reaches the user: errors map to a short code and a request id.
 */

import type { FollowUp, RichBlock } from "./rich-message";

export type ChatEvent =
  | { event: "status"; data: { text: string } }
  | { event: "text_delta"; data: { text: string } }
  | { event: "block_pending"; data: { id: string; type: string } }
  | { event: "block"; data: { id: string; block: RichBlock } }
  | { event: "follow_ups"; data: { items: FollowUp[] } }
  | {
      event: "done";
      data: { threadId: string; messageId: string; packsUsed?: string[] };
    }
  | {
      event: "error";
      data: { code: string; message: string; retryable: boolean; requestId: string; fix?: string };
    };

export type ChatEventEmitter = (event: ChatEvent) => void;

export const noopEmit: ChatEventEmitter = () => {};

/** Encode one SSE event. Data is a single JSON line. */
export function encodeSseEvent(event: ChatEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`;
}

/** Create a stream the route can write events into as work happens. */
export function createChatEventStream(): {
  stream: ReadableStream<string>;
  emit: ChatEventEmitter;
  close: () => void;
} {
  let controller: ReadableStreamDefaultController<string> | null = null;
  const queued: string[] = [];
  const stream = new ReadableStream<string>({
    start(c) {
      controller = c;
      for (const line of queued.splice(0)) c.enqueue(line);
    },
  });
  const emit: ChatEventEmitter = (event) => {
    const line = encodeSseEvent(event);
    if (controller) controller.enqueue(line);
    else queued.push(line);
  };
  const close = () => {
    try {
      controller?.close();
    } catch {
      // Already closed.
    }
  };
  return { stream, emit, close };
}

/** Split reply text into word chunks for text_delta events. */
export function splitTextDeltas(text: string, wordsPerChunk = 6): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const chunks: string[] = [];
  for (let i = 0; i < words.length; i += wordsPerChunk) {
    chunks.push(words.slice(i, i + wordsPerChunk).join(" "));
  }
  return chunks;
}

// ── Human error wording ─────────────────────────────────────────────────────

export type ChatErrorInfo = {
  code: string;
  message: string;
  retryable: boolean;
  fix?: string;
};

export function newRequestId(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** Map a thrown error to human wording. No JSON, no stack traces, no keys. */
export function mapChatError(error: unknown): ChatErrorInfo {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  const dev = process.env.NODE_ENV === "development";
  if (/budget/i.test(raw)) {
    const reset = raw.match(/resets?\s+(\d{4})-(\d{2})-(\d{2})/);
    let when = "next month";
    if (reset) {
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      when = `${months[Number(reset[2]) - 1]} ${Number(reset[3])}`;
    }
    return {
      code: "MODEL_BUDGET",
      message: `The AI budget for this month is spent, it resets ${when}.`,
      retryable: false,
    };
  }
  if (/401|403/.test(raw)) {
    return {
      code: "MODEL_AUTH",
      message:
        "Beetlebot can't reach its AI model right now. This is a setup problem on our side, not your message.",
      retryable: false,
      fix: dev ? "Check OPENROUTER_API_KEY" : undefined,
    };
  }
  if (/429/.test(raw)) {
    return {
      code: "MODEL_RATE_LIMIT",
      message: "Too many requests at the moment. Try again in a minute.",
      retryable: true,
    };
  }
  if (/5\d\d|timeout|timed out|ECONNRESET|ENOTFOUND|fetch failed/i.test(raw)) {
    return {
      code: "MODEL_UNAVAILABLE",
      message: "The AI model didn't answer in time. Your message is saved.",
      retryable: true,
    };
  }
  if (/offline|network|NetworkError|Failed to fetch/i.test(raw)) {
    return {
      code: "OFFLINE",
      message: "You're offline. Your message will send when you reconnect.",
      retryable: true,
    };
  }
  return {
    code: "UNKNOWN",
    message: "Something went wrong on our side. Your message is saved.",
    retryable: true,
  };
}
