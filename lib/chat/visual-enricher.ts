/**
 * Visual enrichment pipeline.
 *
 * Takes structured LLM output (text + raw option list) and attaches real
 * image URLs.  Uses Bousier's tiered resolver first (metadata + open datasets),
 * then falls back to placeholders when no trusted image is available within the
 * latency budget.
 *
 * The module is intentionally tolerant: any fetch failure results in a
 * graceful fallback rather than a thrown error.
 */

import type { AssistantMessage, ImageCard, RichBlock } from "./rich-message";
import { sanitiseBlocks } from "./safety";
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
  /** Run a non-blocking second pass for cards that had placeholders. */
  asyncUpgrade?: boolean;
  /** Optional callback when upgraded cards are found in background pass. */
  onAsyncUpgrade?: (cards: ImageCard[]) => Promise<void> | void;
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

  // No visual options → plain message
  if (!payload.options?.length) {
    return { text: payload.text };
  }

  // Enrich each option with an image URL
  const cards = await enrichOptionsWithBousier(payload.options);

  const blocks: RichBlock[] =
    cards.length === 1
      ? [cards[0]]
      : [
          {
            type: "option_set",
            prompt: "Here are your options — tap one to explore further:",
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
  const inputs: BousierEntityInput[] = options.map((opt) => ({
    title: opt.title,
    category: opt.category,
    actionUrl: opt.actionUrl,
    query: `${opt.category ?? ""} ${opt.title}`.trim(),
  }));
  const resolved = await resolveImageBatch(inputs, {
    mode: "balanced",
    timeoutMs: Number(process.env.BOUSIER_TIMEOUT_MS ?? 1500),
  });

  return options.map((opt, idx) => {
    const result = resolved[idx];
    const query = `${opt.category ?? ""} ${opt.title}`.trim();
    const imageUrl = result?.selectedImageUrl ?? makePlaceholder(query);
    const friendly = friendlySourceName(result?.selectedSourceName);
    const sourceName = friendly
      ? opt.sourceName
        ? `${opt.sourceName} · ${friendly}`
        : friendly
      : opt.sourceName;

    const meta: Record<string, string> = { ...(opt.meta ?? {}) };

    return {
      type: "image_card" as const,
      title: opt.title,
      subtitle: opt.subtitle,
      imageUrl,
      alt: opt.title,
      meta: Object.keys(meta).length > 0 ? meta : undefined,
      actionUrl: opt.actionUrl,
      sourceName,
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
    .filter(({ idx }) => cards[idx]?.imageUrl.includes("placehold.co"))
    .filter(({ opt }) => !!opt.actionUrl);

  if (targets.length === 0) return;

  const upgraded = await resolveImageBatch(
    targets.map(({ opt }) => ({
      title: opt.title,
      category: opt.category,
      actionUrl: opt.actionUrl,
      query: `${opt.category ?? ""} ${opt.title}`.trim(),
    })),
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

// ── Image fetch helpers ────────────────────────────────────────────────────

/**
 * Generate a deterministic, nice-looking placeholder using placehold.co.
 * Returns a valid https URL that always resolves — zero external dependencies.
 */
function makePlaceholder(query: string): string {
  const label = encodeURIComponent(
    query.slice(0, 30).replace(/[^a-zA-Z0-9 ]/g, " ").trim(),
  );
  return `https://placehold.co/600x360/0d1826/4a7fbd?text=${label}`;
}
