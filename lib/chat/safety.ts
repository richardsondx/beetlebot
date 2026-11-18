/**
 * URL validation and block sanitisation.
 * Prevents open redirects, private-network leaks, and oversized payloads.
 */

import type { ImageCard, RichBlock } from "./rich-message";
import {
  isDestinationPreviewBlock,
  isFlightCompareBlock,
  isHotelSetBlock,
  isItineraryTimelineBlock,
  isMapStripBlock,
  isNearbyRowBlock,
} from "./rich-message";

// ── Constants ──────────────────────────────────────────────────────────────

export const MAX_IMAGE_URL_LENGTH = 2048;
export const MAX_CARDS_PER_GALLERY = 5;
export const MAX_BLOCKS = 10;
export const MAX_META_ENTRIES = 8;

/** Private / link-local IP patterns */
const PRIVATE_PATTERNS = [
  /localhost/i,
  /127\.\d+\.\d+\.\d+/,
  /0\.0\.0\.0/,
  /::1/,
  /192\.168\.\d+\.\d+/,
  /10\.\d+\.\d+\.\d+/,
  /172\.(1[6-9]|2[0-9]|3[0-1])\.\d+\.\d+/,
];

// ── URL validators ─────────────────────────────────────────────────────────

export function isValidImageUrl(url: string): boolean {
  if (!url || url.length > MAX_IMAGE_URL_LENGTH) return false;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:") return false;
  const host = parsed.hostname;
  for (const pattern of PRIVATE_PATTERNS) {
    if (pattern.test(host)) return false;
  }
  return true;
}

export function isValidActionUrl(url: string): boolean {
  if (!url || url.length > MAX_IMAGE_URL_LENGTH) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

// ── Block sanitiser ────────────────────────────────────────────────────────

/** Sanitise an array of raw (possibly LLM-produced) block objects. */
export function sanitiseBlocks(raw: unknown[]): RichBlock[] {
  const safe: RichBlock[] = [];

  for (const item of raw.slice(0, MAX_BLOCKS)) {
    const b = item as Record<string, unknown>;

    switch (b.type) {
      case "text_block": {
        if (typeof b.text === "string" && b.text.trim()) {
          safe.push({ type: "text_block", text: b.text.slice(0, 4000) });
        }
        break;
      }

      case "image_card": {
        const card = sanitiseCard(b);
        if (card) safe.push(card);
        break;
      }

      case "image_gallery": {
        if (!Array.isArray(b.items)) break;
        const items = (b.items as unknown[])
          .slice(0, MAX_CARDS_PER_GALLERY)
          .map((c) => sanitiseCard(c as Record<string, unknown>))
          .filter((c): c is ImageCard => c !== null);
        if (items.length > 0) safe.push({ type: "image_gallery", items });
        break;
      }

      case "option_set": {
        if (!Array.isArray(b.items)) break;
        const items = (b.items as unknown[])
          .slice(0, MAX_CARDS_PER_GALLERY)
          .map((rawItem) => {
            const i = rawItem as Record<string, unknown>;
            const card = sanitiseCard(
              (i.card ?? i) as Record<string, unknown>,
            );
            if (!card) return null;
            return { index: Number(i.index) || 0, card };
          })
          .filter((i): i is { index: number; card: ImageCard } => i !== null);
        if (items.length > 0) {
          safe.push({
            type: "option_set",
            prompt:
              typeof b.prompt === "string"
                ? b.prompt.slice(0, 500)
                : undefined,
            variant: b.variant === "compare" ? "compare" : undefined,
            items,
          });
        }
        break;
      }

      case "flight_compare": {
        const block = isFlightCompareBlock(b);
        if (block) safe.push(block);
        break;
      }

      case "hotel_set": {
        const block = isHotelSetBlock(b);
        if (block) safe.push(block);
        break;
      }

      case "map_strip": {
        const block = isMapStripBlock(b);
        if (block) safe.push(block);
        break;
      }

      case "nearby_row": {
        const block = isNearbyRowBlock(b);
        if (block) safe.push(block);
        break;
      }

      case "itinerary_timeline": {
        const block = isItineraryTimelineBlock(b);
        if (block) safe.push(block);
        break;
      }

      case "destination_preview": {
        const block = isDestinationPreviewBlock(b);
        if (block) safe.push(block);
        break;
      }
    }
  }

  return safe;
}

// ── Internal helpers ───────────────────────────────────────────────────────

function sanitiseCard(b: Record<string, unknown>): ImageCard | null {
  if (typeof b.title !== "string" || !b.title.trim()) return null;

  const rawImageUrl = typeof b.imageUrl === "string" ? b.imageUrl : "";
  // Drop placehold.co images to an empty URL (card renders the named
  // fallback icon instead of a placeholder image).
  const imageUrl = rawImageUrl.includes("placehold.co") ? "" : rawImageUrl;
  // Allow empty imageUrl (card renders with placeholder); block invalid URLs
  if (imageUrl && !isValidImageUrl(imageUrl)) return null;

  const actionUrl =
    typeof b.actionUrl === "string" && isValidActionUrl(b.actionUrl)
      ? b.actionUrl
      : undefined;

  const rawMeta =
    typeof b.meta === "object" && b.meta !== null
      ? Object.entries(b.meta as Record<string, unknown>)
          .slice(0, MAX_META_ENTRIES)
          .reduce<Record<string, string>>((acc, [k, v]) => {
            acc[String(k).slice(0, 50)] = String(v).slice(0, 100);
            return acc;
          }, {})
      : undefined;

  const compareRows = Array.isArray(b.compareRows)
    ? (b.compareRows as unknown[])
        .slice(0, 6)
        .map((r) => {
          const row = r as Record<string, unknown>;
          if (typeof row?.label !== "string" || typeof row?.value !== "string") return null;
          return {
            label: row.label.slice(0, 50),
            value: row.value.slice(0, 120),
          };
        })
        .filter((r): r is { label: string; value: string } => r !== null)
    : undefined;

  // Extra gallery photos of the same place, at most 5 total with the hero.
  const gallery = Array.isArray(b.gallery)
    ? (b.gallery as unknown[])
        .slice(0, MAX_CARDS_PER_GALLERY)
        .map((g): { imageUrl: string; sourceName?: string } | null => {
          const item = g as Record<string, unknown>;
          if (typeof item?.imageUrl !== "string") return null;
          if (item.imageUrl.includes("placehold.co")) return null;
          if (!isValidImageUrl(item.imageUrl)) return null;
          return {
            imageUrl: item.imageUrl.slice(0, MAX_IMAGE_URL_LENGTH),
            sourceName:
              typeof item.sourceName === "string"
                ? item.sourceName.slice(0, 100)
                : undefined,
          };
        })
        .filter(
          (g): g is { imageUrl: string; sourceName?: string } => g !== null,
        )
    : undefined;

  return {
    type: "image_card",
    title: b.title.slice(0, 200),
    subtitle:
      typeof b.subtitle === "string" ? b.subtitle.slice(0, 400) : undefined,
    imageUrl,
    alt: typeof b.alt === "string" ? b.alt.slice(0, 200) : undefined,
    category:
      typeof b.category === "string" ? b.category.slice(0, 50) : undefined,
    compareRows: compareRows?.length ? compareRows : undefined,
    meta: rawMeta,
    actionUrl,
    sourceName:
      typeof b.sourceName === "string" ? b.sourceName.slice(0, 100) : undefined,
    pricePending: b.pricePending === true ? true : undefined,
    gallery: gallery?.length ? gallery : undefined,
  };
}
