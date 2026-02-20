import { ok } from "@/lib/api/http";
import { POST as chatPost } from "@/app/api/chat/route";
import { sendToChannel } from "@/lib/chat/channel-sender";
import type { RichBlock } from "@/lib/chat/rich-message";
import { db } from "@/lib/db";
import { CHAT_MODE_IDS } from "@/lib/constants";
import { decryptConnection, encryptConnectionFields } from "@/lib/repositories/integration-crypto";

type TelegramUpdate = {
  update_id?: number;
  message?: {
    message_id?: number;
    text?: string;
    chat?: { id?: number | string };
    from?: { is_bot?: boolean };
  };
};

type ChatMode = (typeof CHAT_MODE_IDS)[number];

type TelegramChatState = {
  threadId?: string;
  mode?: ChatMode;
};

type TelegramConfig = {
  grantedScopes?: string[];
  chats?: Record<string, TelegramChatState>;
  lastProcessedUpdateId?: number;
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
    /\b(?:switch to|set|use|go into|change to)\s+(auto|explore|dating|family|social|relax|travel|focus)\s+mode\b/,
  )?.[1];
  const candidate = explicit ?? conversational;
  if (!candidate) return null;
  return CHAT_MODE_IDS.includes(candidate) ? (candidate as ChatMode) : null;
}

function parseIncoming(update: TelegramUpdate) {
  const msg = update.message;
  const text = msg?.text?.trim();
  const chatId = msg?.chat?.id;
  if (!text || chatId == null) return null;
  if (msg?.from?.is_bot) return null;
  return { text, chatId: String(chatId) };
}

function getUpdateId(update: TelegramUpdate): number | null {
  if (typeof update.update_id !== "number" || !Number.isFinite(update.update_id)) return null;
  return update.update_id;
}

function getLastProcessedUpdateId(config: TelegramConfig): number | null {
  if (typeof config.lastProcessedUpdateId !== "number") return null;
  if (!Number.isFinite(config.lastProcessedUpdateId)) return null;
  return config.lastProcessedUpdateId;
}

async function reserveUpdateIdIfNew(
  rawTelegram: NonNullable<Awaited<ReturnType<typeof db.integrationConnection.findUnique>>>,
  config: TelegramConfig,
  updateId: number,
): Promise<{ accepted: boolean; nextConfig: TelegramConfig }> {
  const lastProcessedUpdateId = getLastProcessedUpdateId(config);
  if (lastProcessedUpdateId != null && updateId <= lastProcessedUpdateId) {
    return { accepted: false, nextConfig: config };
  }

  const nextConfig: TelegramConfig = {
    ...config,
    lastProcessedUpdateId: updateId,
  };

  // Optimistic CAS on updatedAt prevents concurrent duplicate deliveries from
  // both reserving and sending for the same Telegram update.
  const casResult = await db.integrationConnection.updateMany({
    where: {
      provider: "telegram",
      updatedAt: rawTelegram.updatedAt,
    },
    data: encryptConnectionFields({
      configJson: JSON.stringify(nextConfig),
    }),
  });
  if (casResult.count > 0) {
    return { accepted: true, nextConfig };
  }

  const latestRawTelegram = await db.integrationConnection.findUnique({
    where: { provider: "telegram" },
  });
  const latestTelegram = latestRawTelegram ? decryptConnection(latestRawTelegram) : null;
  const latestConfig = parseTelegramConfig(latestTelegram?.configJson);
  const latestProcessedUpdateId = getLastProcessedUpdateId(latestConfig);
  if (latestProcessedUpdateId != null && updateId <= latestProcessedUpdateId) {
    return { accepted: false, nextConfig: latestConfig };
  }

  const latestNextConfig: TelegramConfig = {
    ...latestConfig,
    lastProcessedUpdateId: updateId,
  };
  await db.integrationConnection.update({
    where: { provider: "telegram" },
    data: encryptConnectionFields({
      configJson: JSON.stringify(latestNextConfig),
    }),
  });
  return { accepted: true, nextConfig: latestNextConfig };
}

export async function POST(request: Request) {
  const update = (await request.json().catch(() => null)) as TelegramUpdate | null;
  if (!update) return ok({ received: false, ignored: true, reason: "invalid_json" });

  const incoming = parseIncoming(update);
  if (!incoming) return ok({ received: true, ignored: true, reason: "no_text_message" });

  const rawTelegram = await db.integrationConnection.findUnique({
    where: { provider: "telegram" },
  });
  const telegram = rawTelegram ? decryptConnection(rawTelegram) : null;
  if (!telegram?.accessToken || telegram.status !== "connected") {
    return ok({ received: true, ignored: true, reason: "telegram_not_connected" });
  }
  if (!rawTelegram) {
    return ok({ received: true, ignored: true, reason: "telegram_not_connected" });
  }

  let config = parseTelegramConfig(telegram.configJson);
  const updateId = getUpdateId(update);
  if (updateId != null) {
    const reservation = await reserveUpdateIdIfNew(rawTelegram, config, updateId);
    if (!reservation.accepted) {
      return ok({
        received: true,
        ignored: true,
        reason: "duplicate_update",
        updateId,
      });
    }
    config = reservation.nextConfig;
  }

  const chats = config.chats ?? {};
  const prior = chats[incoming.chatId] ?? {};
  const modeOverride = extractModeOverride(incoming.text);
  const mode = modeOverride ?? prior.mode ?? "auto";

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

  const sendResult = await sendToChannel({
    provider: "telegram",
    accessToken: telegram.accessToken,
    recipientId: incoming.chatId,
    message: {
      text: replyText,
      blocks: chatPayload.data?.blocks,
    },
  });
  if (!sendResult.ok) {
    console.error(`[telegram-webhook] send failed: ${sendResult.error}`);
  }

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
      data: encryptConnectionFields({
        configJson: JSON.stringify({
          ...config,
          chats: nextChats,
        }),
      }),
    });
  }

  return ok({ received: true, handled: true, updateId: update.update_id ?? null });
}

export async function GET() {
  return ok({ ok: true, provider: "telegram", endpoint: "webhook" });
}
