/**
 * Channel-specific message sender.
 *
 * Transforms a canonical AssistantMessage into provider-native payloads and
 * delivers them.  Each provider adapter declares its capabilities so the
 * transformer can pick the richest representation it supports, with a clean
 * text+URL fallback when rich media is not possible.
 *
 * Providers implemented:
 *   - Telegram  (bot token, supports photo+caption, inline keyboard buttons)
 *   - WhatsApp  (Cloud API, supports image message + text)
 */

import type { AssistantMessage, ImageCard } from "./rich-message";
import { cardToText, toPlainText } from "./rich-message";
import { isValidImageUrl } from "./safety";

// ── Provider capability flags ──────────────────────────────────────────────

type ProviderCapabilities = {
  /** Can send a single photo with a text caption */
  photo: boolean;
  /** Max caption / message length (chars) */
  captionMaxLen: number;
  /** Supports sending multiple photos in one API call */
  mediaGroup: boolean;
  /** Supports inline URL buttons */
  buttons: boolean;
};

const CAPABILITIES: Record<string, ProviderCapabilities> = {
  telegram: {
    photo: true,
    captionMaxLen: 1024,
    mediaGroup: true,
    buttons: true,
  },
  whatsapp: {
    photo: true,
    captionMaxLen: 1024,
    mediaGroup: false,
    buttons: false,
  },
};

// ── Public API ─────────────────────────────────────────────────────────────

export type ChannelSendInput = {
  provider: string;
  /** Access token / bot token stored in IntegrationConnection */
  accessToken: string;
  /** Telegram: chat_id | WhatsApp: recipient phone number id */
  recipientId: string;
  /** WhatsApp phone-number-id (different from recipientId) */
  phoneNumberId?: string;
  message: AssistantMessage;
};

export type ChannelSendResult =
  | { ok: true; messageIds: string[] }
  | { ok: false; error: string };

/** Dispatch a rich message to the specified channel provider. */
export async function sendToChannel(
  input: ChannelSendInput,
): Promise<ChannelSendResult> {
  switch (input.provider) {
    case "telegram":
      return sendViaTelegram(input);
    case "whatsapp":
      return sendViaWhatsApp(input);
    default:
      return sendTextFallback(input);
  }
}

// ── Helpers shared across providers ───────────────────────────────────────

/** Extract the first usable image card from the blocks, if any. */
function firstImageCard(msg: AssistantMessage): ImageCard | null {
  if (!msg.blocks) return null;
  for (const block of msg.blocks) {
    if (block.type === "image_card" && isValidImageUrl(block.imageUrl)) {
      return block;
    }
    if (block.type === "image_gallery" && block.items[0]) {
      const item = block.items[0];
      if (isValidImageUrl(item.imageUrl)) return item;
    }
    if (block.type === "option_set" && block.items[0]) {
      const card = block.items[0].card;
      if (isValidImageUrl(card.imageUrl)) return card;
    }
  }
  return null;
}

/** Extract all image cards (for media group sends), max 10. */
function allImageCards(msg: AssistantMessage): ImageCard[] {
  if (!msg.blocks) return [];
  const cards: ImageCard[] = [];
  for (const block of msg.blocks) {
    if (block.type === "image_card" && isValidImageUrl(block.imageUrl)) {
      cards.push(block);
    } else if (block.type === "image_gallery") {
      cards.push(...block.items.filter((c) => isValidImageUrl(c.imageUrl)));
    } else if (block.type === "option_set") {
      cards.push(
        ...block.items
          .map((i) => i.card)
          .filter((c) => isValidImageUrl(c.imageUrl)),
      );
    }
    if (cards.length >= 10) break;
  }
  return cards;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

// ── Telegram ───────────────────────────────────────────────────────────────

const TELEGRAM_API = "https://api.telegram.org";

async function sendViaTelegram(
  input: ChannelSendInput,
): Promise<ChannelSendResult> {
  const { accessToken, recipientId, message } = input;
  const caps = CAPABILITIES.telegram;
  const base = `${TELEGRAM_API}/bot${accessToken}`;
  const messageIds: string[] = [];

  // Exclude placeholder images — Telegram's bot API cannot render them,
  // causing silent media group failures that swallow the entire option list.
  const cards = allImageCards(message).filter(
    (c) => !c.imageUrl.includes("placehold.co"),
  );

  // The full plain-text representation always includes the option list.
  const fullText = truncate(toPlainText(message), caps.captionMaxLen * 4);

  try {
    if (cards.length > 1 && caps.mediaGroup) {
      // Send the full option list as text first (always visible), then images as bonus
      const textResult = await telegramSendMessage(base, recipientId, fullText, caps);
      if (textResult) messageIds.push(textResult);

      const mediaGroupResult = await telegramSendMediaGroup(
        base,
        recipientId,
        cards,
        caps,
      );
      messageIds.push(...mediaGroupResult);
    } else if (cards.length === 1) {
      // Single photo with caption
      const card = cards[0];
      const caption = buildTelegramCaption(message.text, card, caps.captionMaxLen);
      const result = await telegramSendPhoto(
        base,
        recipientId,
        card.imageUrl,
        caption,
        card.actionUrl,
        caps,
      );
      if (result) messageIds.push(result);
    } else {
      // Text-only: no real images, send full formatted text including option list
      const result = await telegramSendMessage(base, recipientId, fullText, caps);
      if (result) messageIds.push(result);
    }

    return { ok: true, messageIds };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Telegram send failed",
    };
  }
}

async function telegramSendMessage(
  base: string,
  chatId: string,
  text: string,
  caps: ProviderCapabilities,
): Promise<string | null> {
  const truncated = truncate(text, caps.captionMaxLen * 4);
  const body: Record<string, unknown> = { chat_id: chatId, text: truncated };
  const res = await fetch(`${base}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    result?: { message_id?: number };
    description?: string;
  };
  if (!data.ok) {
    throw new Error(data.description ?? "Telegram sendMessage failed");
  }
  return data.result?.message_id != null ? String(data.result.message_id) : null;
}

async function telegramSendPhoto(
  base: string,
  chatId: string,
  photoUrl: string,
  caption: string,
  actionUrl: string | undefined,
  caps: ProviderCapabilities,
): Promise<string | null> {
  const body: Record<string, unknown> = {
    chat_id: chatId,
    photo: photoUrl,
    caption: truncate(caption, caps.captionMaxLen),
    parse_mode: "HTML",
  };

  if (actionUrl && caps.buttons) {
    body.reply_markup = {
      inline_keyboard: [[{ text: "View details →", url: actionUrl }]],
    };
  }

  const res = await fetch(`${base}/sendPhoto`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    result?: { message_id?: number };
    description?: string;
  };
  if (!data.ok) {
    throw new Error(data.description ?? "Telegram sendPhoto failed");
  }
  return data.result?.message_id != null ? String(data.result.message_id) : null;
}

async function telegramSendMediaGroup(
  base: string,
  chatId: string,
  cards: ImageCard[],
  caps: ProviderCapabilities,
): Promise<string[]> {
  const media = cards.slice(0, 10).map((card, i) => ({
    type: "photo",
    media: card.imageUrl,
    caption:
      i === 0
        ? truncate(buildTelegramCaption("", card, caps.captionMaxLen), caps.captionMaxLen)
        : truncate(`${i + 1}. ${card.title}`, 200),
    parse_mode: "HTML",
  }));

  const res = await fetch(`${base}/sendMediaGroup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, media }),
  });
  const data = (await res.json()) as {
    ok?: boolean;
    result?: Array<{ message_id?: number }>;
    description?: string;
  };
  if (!data.ok) {
    console.warn(`[telegram] sendMediaGroup failed: ${data.description}`);
  }
  return (data.result ?? [])
    .map((m) => (m.message_id != null ? String(m.message_id) : null))
    .filter((id): id is string => id !== null);
}

function buildTelegramCaption(
  text: string,
  card: ImageCard,
  maxLen: number,
): string {
  const parts: string[] = [];
  if (text) parts.push(text);
  parts.push(`<b>${card.title}</b>`);
  if (card.subtitle) parts.push(card.subtitle);
  if (card.meta) {
    const chips = Object.values(card.meta).join(" · ");
    if (chips) parts.push(chips);
  }
  if (card.actionUrl) parts.push(card.actionUrl);
  return truncate(parts.join("\n"), maxLen);
}

// ── WhatsApp ───────────────────────────────────────────────────────────────

const WA_GRAPH_VERSION = process.env.WHATSAPP_GRAPH_VERSION ?? "v22.0";
const WA_API = `https://graph.facebook.com/${WA_GRAPH_VERSION}`;

async function sendViaWhatsApp(
  input: ChannelSendInput,
): Promise<ChannelSendResult> {
  const { accessToken, recipientId, phoneNumberId, message } = input;
  const caps = CAPABILITIES.whatsapp;

  if (!phoneNumberId) {
    return { ok: false, error: "phoneNumberId required for WhatsApp sends" };
  }

  const messageIds: string[] = [];
  const card = firstImageCard(message);

  try {
    if (card) {
      // Send image + caption
      const caption = buildWaCaption(message.text, card, caps.captionMaxLen);
      const imgId = await waSendImage(
        accessToken,
        phoneNumberId,
        recipientId,
        card.imageUrl,
        caption,
      );
      if (imgId) messageIds.push(imgId);

      // If there are more cards, send their URLs as a text list
      const extraCards = allImageCards(message).slice(1, 5);
      if (extraCards.length > 0) {
        const lines = [
          "More options:",
          ...extraCards.map((c, i) => {
            const line = `${i + 2}. ${c.title}`;
            return c.actionUrl ? `${line}\n${c.actionUrl}` : line;
          }),
        ];
        const textId = await waSendText(
          accessToken,
          phoneNumberId,
          recipientId,
          lines.join("\n"),
        );
        if (textId) messageIds.push(textId);
      }
    } else {
      // Plain text fallback
      const plain = truncate(toPlainText(message), caps.captionMaxLen * 4);
      const textId = await waSendText(
        accessToken,
        phoneNumberId,
        recipientId,
        plain,
      );
      if (textId) messageIds.push(textId);
    }

    return { ok: true, messageIds };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "WhatsApp send failed",
    };
  }
}

async function waSendText(
  token: string,
  phoneNumberId: string,
  to: string,
  text: string,
): Promise<string | null> {
  const res = await fetch(`${WA_API}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text, preview_url: true },
    }),
  });
  const data = (await res.json()) as {
    messages?: Array<{ id?: string }>;
  };
  return data.messages?.[0]?.id ?? null;
}

async function waSendImage(
  token: string,
  phoneNumberId: string,
  to: string,
  imageUrl: string,
  caption: string,
): Promise<string | null> {
  const res = await fetch(`${WA_API}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: imageUrl, caption },
    }),
  });
  const data = (await res.json()) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  };
  if (data.error) throw new Error(data.error.message ?? "WhatsApp image send failed");
  return data.messages?.[0]?.id ?? null;
}

function buildWaCaption(
  text: string,
  card: ImageCard,
  maxLen: number,
): string {
  const parts: string[] = [];
  if (text) parts.push(text);
  parts.push(`*${card.title}*`);
  if (card.subtitle) parts.push(card.subtitle);
  if (card.meta) {
    const chips = Object.values(card.meta).join(" · ");
    if (chips) parts.push(chips);
  }
  if (card.actionUrl) parts.push(card.actionUrl);
  return truncate(parts.join("\n"), maxLen);
}

// ── Generic text fallback ──────────────────────────────────────────────────

async function sendTextFallback(
  input: ChannelSendInput,
): Promise<ChannelSendResult> {
  // For providers without a dedicated adapter, log and return a no-op success
  // so the caller can continue without crashing.
  const plain = toPlainText(input.message);
  console.warn(
    `[channel-sender] No adapter for provider "${input.provider}". Plain text (${plain.length} chars) not delivered.`,
  );
  return { ok: true, messageIds: [] };
}

// ── Serialise card as text for card-to-text utility (re-export) ──────────

export { cardToText };
