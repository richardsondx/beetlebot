import { ok } from "@/lib/api/http";
import { POST as chatPost } from "@/app/api/chat/route";
import { sendToChannel } from "@/lib/chat/channel-sender";
import type { RichBlock } from "@/lib/chat/rich-message";
import { db } from "@/lib/db";
import { MODE_IDS } from "@/lib/constants";

type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    text?: string;
    chat?: { id?: number | string };
    from?: { is_bot?: boolean };
  };
};

type ChatMode = (typeof MODE_IDS)[number];

type TelegramChatState = {
  threadId?: string;
  mode?: ChatMode;
};

type TelegramConfig = {
  grantedScopes?: string[];
  chats?: Record<string, TelegramChatState>;
};

function parseTelegramConfig(configJson: string | null | undefined): TelegramConfig {
  if (!configJson) return {};
  try {
    const parsed = JSON.parse(configJson) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return {};
    return parsed as TelegramConfig;
  } catch {
    return {};
  }
}

function extractModeOverride(message: string): ChatMode | null {
  const normalized = message.trim().toLowerCase();
  const commandMatch = normalized.match(/^\/mode\s+([a-z_]+)/);
  const explicit = commandMatch?.[1];
  const conversational = normalized.match(
    /\b(?:switch to|set|use|go into|change to)\s+(explore|dating|family|social|relax|travel|focus)\s+mode\b/,
  )?.[1];
  const candidate = explicit ?? conversational;
  if (!candidate) return null;
  return MODE_IDS.includes(candidate) ? (candidate as ChatMode) : null;
}

function parseIncoming(update: TelegramUpdate) {
  const msg = update.message;
  const text = msg?.text?.trim();
  const chatId = msg?.chat?.id;
  if (!text || chatId == null) return null;
  if (msg?.from?.is_bot) return null;
  return { text, chatId: String(chatId) };
}

export async function POST(request: Request) {
  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  if (!update) return ok({ received: false, ignored: true, reason: "invalid_json" });

  const incoming = parseIncoming(update);
  if (!incoming) return ok({ received: true, ignored: true, reason: "no_text_message" });

  const telegram = await db.integrationConnection.findUnique({
    where: { provider: "telegram" },
  });
  if (!telegram?.accessToken || telegram.status !== "connected") {
    return ok({ received: true, ignored: true, reason: "telegram_not_connected" });
  }

  const config = parseTelegramConfig(telegram.configJson);
  const chats = config.chats ?? {};
  const prior = chats[incoming.chatId] ?? {};
  const modeOverride = extractModeOverride(incoming.text);
  const mode = modeOverride ?? prior.mode ?? "explore";

  const chatRequest = new Request("http://internal/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: incoming.text,
      mode,
      threadId: prior.threadId,
    }),
  });
  const chatResponse = await chatPost(chatRequest);

  const chatPayload = (await chatResponse.json().catch(() => ({}))) as {
    data?: { reply?: string; blocks?: RichBlock[]; threadId?: string };
    error?: string;
  };

  const replyText =
    chatPayload.data?.reply?.trim() ||
    (chatPayload.error ? `I hit an error: ${chatPayload.error}` : "I didn't catch that — try again?");

  await sendToChannel({
    provider: "telegram",
    accessToken: telegram.accessToken,
    recipientId: incoming.chatId,
    message: {
      text: replyText,
      blocks: chatPayload.data?.blocks,
    },
  });

  const nextThreadId = chatPayload.data?.threadId;
  const shouldSaveThread = typeof nextThreadId === "string" && nextThreadId.length >= 8;
  const shouldSaveMode = Boolean(modeOverride || prior.mode);
  if (shouldSaveThread || shouldSaveMode) {
    const nextChats: Record<string, TelegramChatState> = {
      ...chats,
      [incoming.chatId]: {
        threadId: shouldSaveThread ? nextThreadId : prior.threadId,
        mode: mode as ChatMode,
      },
    };
    await db.integrationConnection.update({
      where: { provider: "telegram" },
      data: {
        configJson: JSON.stringify({
          ...config,
          chats: nextChats,
        }),
      },
    });
  }

  return ok({ received: true, handled: true, updateId: update.update_id ?? null });
}

export async function GET() {
  return ok({ ok: true, provider: "telegram", endpoint: "webhook" });
}
