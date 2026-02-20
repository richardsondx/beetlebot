/**
 * Canonical rich-message types shared across web UI, CLI, and channel adapters.
 *
 * Design rule: every block MUST be representable as plain text + URL so that
 * CLI and messaging channels that cannot render images still work correctly.
 */

// ── Block types ────────────────────────────────────────────────────────────

export type ImageCard = {
  type: "image_card";
  title: string;
  subtitle?: string;
  imageUrl: string;
  alt?: string;
  /** Structured metadata chips: price, rating, neighborhood, distance, etc. */
  meta?: Record<string, string>;
  /** Deep-link to booking/detail page */
  actionUrl?: string;
  /** Attribution label (e.g. "Google Hotels", "Unsplash / @photographer") */
  sourceName?: string;
};

export type TextBlock = {
  type: "text_block";
  text: string;
};

export type ImageGallery = {
  type: "image_gallery";
  /** Maximum 5 cards */
  items: ImageCard[];
};

export type OptionSet = {
  type: "option_set";
  prompt?: string;
  items: Array<{
    index: number;
    card: ImageCard;
  }>;
};

export type RichBlock = TextBlock | ImageCard | ImageGallery | OptionSet;

// ── Top-level message ──────────────────────────────────────────────────────

export type AssistantMessage = {
  /** Always-present plain-text fallback used by CLI and simple channels */
  text: string;
  blocks?: RichBlock[];
};

// ── Plain-text serializer (CLI / channel fallback) ─────────────────────────

export function toPlainText(msg: AssistantMessage): string {
  if (!msg.blocks?.length) return msg.text;

  const parts: string[] = [msg.text];

  for (const block of msg.blocks) {
    switch (block.type) {
      case "text_block":
        parts.push(block.text);
        break;
      case "image_card":
        parts.push(cardToText(block));
        break;
      case "image_gallery":
        block.items.forEach((item, i) =>
          parts.push(`[${i + 1}] ${cardToText(item)}`),
        );
        break;
      case "option_set":
        if (block.prompt) parts.push(block.prompt);
        block.items.forEach(({ index, card }) =>
          parts.push(`[${index}] ${cardToText(card)}`),
        );
        break;
    }
  }

  return parts.filter(Boolean).join("\n\n");
}

/** Serialize a single ImageCard to readable text with URL at the end. */
export function cardToText(card: ImageCard): string {
  const lines: string[] = [card.title];
  if (card.subtitle) lines.push(card.subtitle);
  if (card.meta) {
    const chips = Object.entries(card.meta)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ");
    lines.push(chips);
  }
  if (card.actionUrl) lines.push(card.actionUrl);
  if (card.sourceName) lines.push(`via ${card.sourceName}`);
  return lines.join("\n");
}

/** Extract all navigable options from blocks for CLI `/open <n>` */
export function extractOptions(
  msg: AssistantMessage,
): Array<{ index: number; title: string; url: string }> {
  if (!msg.blocks) return [];
  const out: Array<{ index: number; title: string; url: string }> = [];
  let counter = 1;

  for (const block of msg.blocks) {
    const candidates: ImageCard[] =
      block.type === "image_gallery"
        ? block.items
        : block.type === "option_set"
          ? block.items.map((i) => i.card)
          : block.type === "image_card"
            ? [block]
            : [];

    for (const card of candidates) {
      const url = card.actionUrl ?? card.imageUrl;
      if (url) {
        out.push({ index: counter++, title: card.title, url });
      }
    }
  }

  return out;
}
