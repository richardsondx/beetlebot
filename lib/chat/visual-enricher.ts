/**
 * Visual enrichment pipeline.
 *
 * Takes structured LLM output (text + raw option list) and attaches real
 * image URLs. Uses Bousier's tiered resolver first (metadata + open datasets),
 * then leaves the image empty so the UI shows the named fallback icon when
 * no trusted image is available within the latency budget. Never a
 * placehold.co image, never a generated image.
 *
 * A destination suggestion with no price at all is marked price-pending
 * (see lib/travel/destination-suggestion.ts) so it still renders as a
 * photo-first card with a plain "Price coming soon" state.
 *
 * The module is intentionally tolerant: any fetch failure results in a
 * graceful fallback rather than a thrown error.
 */

import type { AssistantMessage, ImageCard, RichBlock } from "./rich-message";
import { sanitiseBlocks } from "./safety";
import {
  applyBeachCompareRows,
  isBeachCompareTitles,
  mentionsBeachCompare,
  resolveBeachComparePhotos,
} from "@/lib/travel/beach-compare";
import {
  applyPricePending,
  correctDestinationCountry,
  normaliseDestinationTitle,
  wikiUrlForDestination,
} from "@/lib/travel/destination-suggestion";
import {
  type BousierEntityInput,
  resolveImageBatch,
} from "@/lib/media/bousier";

// ── Raw LLM option (before enrichment) ────────────────────────────────────

export type RawOption = {
  title: string;
  subtitle?: string;
  category?: string; // e.g. "hotel", "restaurant", "park"
  meta?: Record<string, string>;
  compareRows?: Array<{ label: string; value: string }>;
  actionUrl?: string;
  sourceName?: string;
};

export type RawLlmPayload = {
  text: string;
  options?: RawOption[];
  /** Pre-built blocks (advanced: LLM emits them directly) */
  blocks?: unknown[];
};

type EnrichOptions = {
  /** Run a non-blocking second pass for cards that had no photo yet. */
  asyncUpgrade?: boolean;
  /** Optional callback when upgraded cards are found in background pass. */
  onAsyncUpgrade?: (cards: ImageCard[]) => Promise<void> | void;
  /** The user's message, so a compare ask can be answered visually even
   * when the model replies in prose with no options. */
  userMessage?: string;
};

// ── Enrichment entry point ─────────────────────────────────────────────────

/**
 * Parse an LLM reply string, extract structured options, enrich with images,
 * and return a canonical AssistantMessage.
 */
export async function enrichLlmReply(
  raw: string,
  options: EnrichOptions = {},
): Promise<AssistantMessage> {
  const payload = parseLlmPayload(raw);

  // If LLM supplied pre-built blocks, sanitise and use them directly
  if (payload.blocks?.length) {
    return {
      text: payload.text,
      blocks: sanitiseBlocks(payload.blocks as unknown[]),
    };
  }

  // No visual options → plain message, unless the user asked for a
  // beach compare. The model sometimes answers a compare ask in prose
  // with no options JSON; the ask already names the three options, so
  // the compare is built directly instead of showing text only.
  if (!payload.options?.length) {
    if (mentionsBeachCompare(options.userMessage ?? "")) {
      const compare = await resolveBeachComparePhotos();
      return { text: payload.text, blocks: [compare] };
    }
    return { text: payload.text };
  }

  // Enrich each option with an image URL
  const enriched = await enrichOptionsWithBousier(payload.options);
  const isBeachCompare = isBeachCompareTitles(
    enriched.map((card) => card.title),
  );
  const compared = isBeachCompare ? applyBeachCompareRows(enriched) : enriched;
  // Price-pending runs after the compare overlay, so a Sample price on a
  // compare card is never also marked pending.
  const cards = compared.map((card) =>
    applyPricePending(correctDestinationCountry(card)),
  );

  const blocks: RichBlock[] =
    cards.length === 1
      ? [cards[0]]
      : [
          {
            type: "option_set",
            prompt: isBeachCompare
              ? "Which beach?"
              : "Here are your options — tap one to explore further:",
            variant: isBeachCompare ? "compare" : undefined,
            items: cards.map((card, i) => ({ index: i + 1, card })),
          },
        ];

  if (options.asyncUpgrade && options.onAsyncUpgrade) {
    void runAsyncCardUpgrade(cards, payload.options, options.onAsyncUpgrade);
  }

  return { text: payload.text, blocks };
}

// ── LLM payload parser ─────────────────────────────────────────────────────

/**
 * Attempt to extract a structured payload from the LLM reply.
 * The LLM is prompted to return JSON; we fall back gracefully if it doesn't.
 */
export function parseLlmPayload(raw: string): RawLlmPayload {
  const trimmed = raw.trim();

  // 1. Try full-string JSON parse (ideal case — LLM returned pure JSON)
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as RawLlmPayload;
      if (typeof parsed.text === "string") return parsed;
    } catch {
      // fall through
    }
  }

  // 2. Extract a ```json ... ``` fenced block
  const jsonFence = trimmed.match(/```json\s*([\s\S]+?)```/);
  if (jsonFence) {
    try {
      const parsed = JSON.parse(jsonFence[1]) as RawLlmPayload;
      if (typeof parsed.text === "string") return parsed;
    } catch {
      // fall through
    }
  }

  // 3. LLM often prepends conversational prose before the JSON object.
  //    Find the first `{` and attempt to extract a balanced JSON object.
  const braceIdx = trimmed.indexOf("{");
  if (braceIdx !== -1) {
    const preamble = trimmed.slice(0, braceIdx).trim();
    const candidate = trimmed.slice(braceIdx);
    try {
      const parsed = JSON.parse(candidate) as RawLlmPayload;
      if (typeof parsed.text === "string") {
        // Merge preamble into the structured text when it adds context
        if (preamble && !parsed.text.startsWith(preamble)) {
          parsed.text = `${preamble}\n\n${parsed.text}`;
        }
        return parsed;
      }
    } catch {
      // fall through — try to find the balanced object manually
    }

    // Balanced-brace extraction for cases where trailing text follows the JSON
    let depth = 0;
    let end = -1;
    for (let i = braceIdx; i < trimmed.length; i++) {
      if (trimmed[i] === "{") depth++;
      else if (trimmed[i] === "}") {
        depth--;
        if (depth === 0) { end = i; break; }
      }
    }
    if (end !== -1) {
      try {
        const parsed = JSON.parse(trimmed.slice(braceIdx, end + 1)) as RawLlmPayload;
        if (typeof parsed.text === "string") {
          if (preamble && !parsed.text.startsWith(preamble)) {
            parsed.text = `${preamble}\n\n${parsed.text}`;
          }
          return parsed;
        }
      } catch {
        // fall through
      }
    }
  }

  // 4. Plain text fallback
  return { text: trimmed };
}

// ── Per-option image enrichment ────────────────────────────────────────────

const FRIENDLY_SOURCE_NAMES: Record<string, string> = {
  canonical_metadata: "Official site",
  wikipedia_summary: "Wikipedia",
};

function friendlySourceName(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  return FRIENDLY_SOURCE_NAMES[raw] ?? raw;
}

async function enrichOptionsWithBousier(options: RawOption[]): Promise<ImageCard[]> {
  const inputs: BousierEntityInput[] = options.map((opt) => {
    // Resolve under the bare name: the model writes "Bali, Indonesia",
    // Wikipedia needs "Bali". The displayed card title stays as written.
    const resolveTitle = normaliseDestinationTitle(opt.title);
    return {
      title: resolveTitle,
      category: opt.category,
      // Known destinations get their Wikipedia page as the tier 1 source
      // when the LLM gave no detail URL, so a real photo can still resolve.
      actionUrl: opt.actionUrl ?? wikiUrlForDestination(opt.title),
      query: `${opt.category ?? ""} ${resolveTitle}`.trim(),
    };
  });
  const resolved = await resolveImageBatch(inputs, {
    mode: "balanced",
    timeoutMs: Number(process.env.BOUSIER_TIMEOUT_MS ?? 1500),
  });

  return options.map((opt, idx) => {
    const result = resolved[idx];
    // No trusted photo: empty URL, so the card shows the named fallback
    // icon. Never a placehold.co image.
    const imageUrl = result?.selectedImageUrl ?? "";
    const friendly = friendlySourceName(result?.selectedSourceName);
    const sourceName = friendly
      ? opt.sourceName
        ? `${opt.sourceName} · ${friendly}`
        : friendly
      : opt.sourceName;

    // Extra real photos of the same place, from the ranked Bousier
    // candidates. Hero plus extras cap at 5, the ImageGallery maximum.
    // A tap on the photo opens the gallery; a card with no extra
    // candidates keeps the single-photo expand.
    const gallery = (result?.imageCandidates ?? [])
      .filter(
        (c) =>
          c.imageUrl !== imageUrl &&
          !c.imageUrl.includes("placehold.co") &&
          c.imageUrl.startsWith("https://"),
      )
      .slice(0, 4)
      .map((c) => ({
        imageUrl: c.imageUrl,
        sourceName:
          c.sourceName === "wikipedia_summary"
            ? "Wikipedia"
            : c.sourceName === "canonical_metadata"
              ? "Official site"
              : c.sourceName,
      }));

    const meta: Record<string, string> = { ...(opt.meta ?? {}) };

    return {
      type: "image_card" as const,
      title: opt.title,
      subtitle: opt.subtitle,
      imageUrl,
      alt: opt.title,
      category: opt.category,
      compareRows: opt.compareRows,
      meta: Object.keys(meta).length > 0 ? meta : undefined,
      actionUrl: opt.actionUrl ?? wikiUrlForDestination(opt.title),
      sourceName,
      gallery: gallery.length > 0 ? gallery : undefined,
    };
  });
}

async function runAsyncCardUpgrade(
  cards: ImageCard[],
  options: RawOption[],
  onAsyncUpgrade: (cards: ImageCard[]) => Promise<void> | void,
) {
  const targets = options
    .map((opt, idx) => ({ opt, idx }))
    .filter(({ idx }) => !cards[idx]?.imageUrl);

  if (targets.length === 0) return;

  const upgraded = await resolveImageBatch(
    targets.map(({ opt }) => {
      const resolveTitle = normaliseDestinationTitle(opt.title);
      return {
        title: resolveTitle,
        category: opt.category,
        actionUrl: opt.actionUrl ?? wikiUrlForDestination(opt.title),
        query: `${opt.category ?? ""} ${resolveTitle}`.trim(),
      };
    }),
    { mode: "balanced", timeoutMs: Number(process.env.BOUSIER_ASYNC_TIMEOUT_MS ?? 3500) },
  );

  const nextCards = [...cards];
  let changed = false;
  targets.forEach(({ idx }, i) => {
    const best = upgraded[i]?.selectedImageUrl;
    if (!best) return;
    if (best.includes("placehold.co")) return;
    nextCards[idx] = { ...nextCards[idx], imageUrl: best };
    changed = true;
  });
  if (!changed) return;
  await onAsyncUpgrade(nextCards);
}

export function applyUpgradedCardsToBlocks(
  blocks: RichBlock[] | undefined,
  upgradedCards: ImageCard[],
): RichBlock[] | undefined {
  if (!blocks?.length || upgradedCards.length === 0) return blocks;
  let cursor = 0;
  const mapped: RichBlock[] = blocks.map((block) => {
    if (block.type === "image_card") {
      const next = upgradedCards[cursor++];
      return next ? { ...block, imageUrl: next.imageUrl } : block;
    }
    if (block.type === "image_gallery") {
      const items = block.items.map((item) => {
        const next = upgradedCards[cursor++];
        return next ? { ...item, imageUrl: next.imageUrl } : item;
      });
      return { ...block, items };
    }
    if (block.type === "option_set") {
      const items = block.items.map((entry) => {
        const next = upgradedCards[cursor++];
        return next ? { ...entry, card: { ...entry.card, imageUrl: next.imageUrl } } : entry;
      });
      return { ...block, items };
    }
    return block;
  });
  return mapped;
}
