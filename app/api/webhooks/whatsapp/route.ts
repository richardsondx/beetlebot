import { ok } from "@/lib/api/http";
import { POST as chatPost } from "@/app/api/chat/route";
import { sendToChannel } from "@/lib/chat/channel-sender";
import { db } from "@/lib/db";
import type { RichBlock } from "@/lib/chat/rich-message";
import { decryptConnection } from "@/lib/repositories/integration-crypto";

type WhatsAppWebhookQuery = {
  "hub.mode"?: string;
  "hub.verify_token"?: string;
  "hub.challenge"?: string;
};

type WhatsAppWebhookMessage = {
  id?: string;
  from?: string;
  text?: { body?: string };
  type?: string;
};

type WhatsAppWebhookStatus = {
  id?: string;
  status?: string;
};

type WhatsAppWebhookPayload = {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      field?: string;
      value?: {
        messaging_product?: string;
        metadata?: { phone_number_id?: string; display_phone_number?: string };
        messages?: WhatsAppWebhookMessage[];
        statuses?: WhatsAppWebhookStatus[];
      };
    }>;
  }>;
};

type WhatsAppConfig = {
  phoneNumberId?: string;
  businessAccountId?: string;
  chats?: Record<string, { threadId?: string }>;
  processedMessageIds?: Record<string, number>;
};

function parseConfig(configJson?: string | null): WhatsAppConfig {
  if (!configJson) return {};
  try {
    return JSON.parse(configJson) as WhatsAppConfig;
  } catch {
    return {};
  }
}

function pruneProcessedMessageIds(
  ids: Record<string, number> | undefined,
  maxEntries = 200,
): Record<string, number> {
  if (!ids) return {};
  const sorted = Object.entries(ids).sort((a, b) => a[1] - b[1]);
  const kept = sorted.slice(Math.max(0, sorted.length - maxEntries));
  return Object.fromEntries(kept);
}

async function reserveMessageIdIfNew(
  rawWhatsApp: NonNullable<Awaited<ReturnType<typeof db.integrationConnection.findUnique>>>,
  config: WhatsAppConfig,
  messageId: string,
): Promise<{ accepted: boolean; nextConfig: WhatsAppConfig }> {
  const processed = config.processedMessageIds ?? {};
  if (processed[messageId]) {
    return { accepted: false, nextConfig: config };
  }

  const nextConfig: WhatsAppConfig = {
    ...config,
    processedMessageIds: pruneProcessedMessageIds(
      {
        ...processed,
        [messageId]: Date.now(),
      },
      200,
    ),
  };

  const casResult = await db.integrationConnection.updateMany({
    where: {
      provider: "whatsapp",
      updatedAt: rawWhatsApp.updatedAt,
    },
    data: {
      configJson: JSON.stringify(nextConfig),
    },
  });
  if (casResult.count > 0) {
    return { accepted: true, nextConfig };
  }

  const latestRawWhatsApp = await db.integrationConnection.findUnique({
    where: { provider: "whatsapp" },
  });
  const latestWhatsApp = latestRawWhatsApp ? decryptConnection(latestRawWhatsApp) : null;
  const latestConfig = parseConfig(latestWhatsApp?.configJson);
  if (latestConfig.processedMessageIds?.[messageId]) {
    return { accepted: false, nextConfig: latestConfig };
  }

  const latestNextConfig: WhatsAppConfig = {
    ...latestConfig,
    processedMessageIds: pruneProcessedMessageIds(
      {
        ...(latestConfig.processedMessageIds ?? {}),
        [messageId]: Date.now(),
      },
      200,
    ),
  };
  await db.integrationConnection.update({
    where: { provider: "whatsapp" },
    data: {
      configJson: JSON.stringify(latestNextConfig),
    },
  });
  return { accepted: true, nextConfig: latestNextConfig };
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams.entries()) as WhatsAppWebhookQuery;
  const mode = params["hub.mode"]?.trim();
  const verifyToken = params["hub.verify_token"]?.trim();
  const challenge = params["hub.challenge"]?.trim();
  const expectedToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  const tokenMatches = Boolean(expectedToken && verifyToken && verifyToken === expectedToken);

  if (mode === "subscribe" && tokenMatches && challenge) {
    return new Response(challenge, { status: 200 });
  }

  return ok(
    {
      verified: false,
      reason: "invalid_verification_request",
    },
    403,
  );
}

export async function POST(request: Request) {
  const payload = (await request.json().catch(() => null)) as WhatsAppWebhookPayload | null;
  const entries = payload?.entry ?? [];
  const changes = entries.flatMap((entry) => entry.changes ?? []);
  const messageEvents = changes.flatMap((change) => change.value?.messages ?? []);
  const statusEvents = changes.flatMap((change) => change.value?.statuses ?? []);
  const phoneNumberId = changes.find((change) => change.value?.metadata?.phone_number_id)?.value?.metadata
    ?.phone_number_id;

  const rawWhatsApp = await db.integrationConnection.findUnique({
    where: { provider: "whatsapp" },
  });
  const whatsapp = rawWhatsApp ? decryptConnection(rawWhatsApp) : null;
  let config = parseConfig(whatsapp?.configJson);
  const connected = whatsapp?.status === "connected";

  if (!payload) {
    return ok({ received: false, ignored: true, reason: "invalid_json" });
  }

  const firstTextEvent = messageEvents.find((event) => event.type === "text");
  const firstText = firstTextEvent?.text?.body?.trim();
  const firstSender = firstTextEvent?.from?.trim();
  const incomingMessageId = firstTextEvent?.id?.trim();
  const effectivePhoneNumberId = phoneNumberId ?? config.phoneNumberId;

  if (incomingMessageId && rawWhatsApp) {
    const reservation = await reserveMessageIdIfNew(rawWhatsApp, config, incomingMessageId);
    if (!reservation.accepted) {
      return ok({
        received: true,
        handled: false,
        reason: "duplicate_message",
      });
    }
    config = reservation.nextConfig;
  }

  if (!firstText || !firstSender) {
    return ok({
      received: true,
      handled: false,
      reason: "no_text_message",
      messageCount: messageEvents.length,
      statusCount: statusEvents.length,
    });
  }

  if (!connected || !whatsapp?.accessToken || !effectivePhoneNumberId) {
    return ok({
      received: true,
      handled: false,
      reason: "whatsapp_not_ready",
    });
  }

  const priorThreadId = config.chats?.[firstSender]?.threadId;
  const chatRequest = new Request("http://internal/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: firstText,
      mode: "auto",
      threadId: priorThreadId,
    }),
  });
  const chatResponse = await chatPost(chatRequest);
  const chatPayload = (await chatResponse.json().catch(() => ({}))) as {
    data?: { reply?: string; blocks?: unknown[]; threadId?: string; messageId?: string };
    error?: string;
  };
  const replyText =
    chatPayload.data?.reply?.trim() ||
    (chatPayload.error ? `I hit an error: ${chatPayload.error}` : "I didn't catch that — try again?");
  const replyBlocks = Array.isArray(chatPayload.data?.blocks)
    ? chatPayload.data.blocks
    : undefined;

  await sendToChannel({
    provider: "whatsapp",
    accessToken: whatsapp.accessToken,
    recipientId: firstSender,
    phoneNumberId: effectivePhoneNumberId,
    assistantMessageId: chatPayload.data?.messageId,
    message: {
      text: replyText,
      blocks: replyBlocks as RichBlock[] | undefined,
    },
  });

  const nextThreadId = chatPayload.data?.threadId;
  if (nextThreadId && rawWhatsApp) {
    const nextChats = {
      ...(config.chats ?? {}),
      [firstSender]: { threadId: nextThreadId },
    };
    await db.integrationConnection.update({
      where: { provider: "whatsapp" },
      data: {
        configJson: JSON.stringify({
          ...config,
          chats: nextChats,
        }),
      },
    });
  }

  return ok({
    received: true,
    handled: true,
    messageCount: messageEvents.length,
    statusCount: statusEvents.length,
  });
}
