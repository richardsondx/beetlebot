/**
 * Visual enrichment pipeline.
 *
 * Takes structured LLM output (text + raw option list) and attaches real
 * image URLs.  Supports:
 *   1. Unsplash API  — set UNSPLASH_ACCESS_KEY in .env
 *   2. Pexels API    — set PEXELS_API_KEY in .env
 *   3. Placeholder   — automatic fallback, always works, no keys required
 *
 * The module is intentionally tolerant: any fetch failure results in a
 * graceful fallback rather than a thrown error.
 */

import type { AssistantMessage, ImageCard, RichBlock } from "./rich-message";
import { sanitiseBlocks } from "./safety";
import { getBestEventImageUrl } from "@/lib/media/cache";

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

// ── Enrichment entry point ─────────────────────────────────────────────────

/**
 * Parse an LLM reply string, extract structured options, enrich with images,
 * and return a canonical AssistantMessage.
 */
export async function enrichLlmReply(raw: string): Promise<AssistantMessage> {
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
  const cards = await Promise.all(
    payload.options.map((opt) => enrichOption(opt)),
  );

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

async function enrichOption(opt: RawOption): Promise<ImageCard> {
  const query = `${opt.category ?? ""} ${opt.title}`.trim();
  const imageUrl = await fetchBestImageUrl({
    query,
    actionUrl: opt.actionUrl,
  });

  return {
    type: "image_card",
    title: opt.title,
    subtitle: opt.subtitle,
    imageUrl,
    alt: opt.title,
    meta: opt.meta,
    actionUrl: opt.actionUrl,
    sourceName: opt.sourceName,
  };
}

// ── Image fetch helpers ────────────────────────────────────────────────────

async function fetchBestImageUrl(input: {
  query: string;
  actionUrl?: string;
}): Promise<string> {
  if (input.actionUrl) {
    const best = await getBestEventImageUrl({ actionUrl: input.actionUrl });
    if (best?.imageUrl) return best.imageUrl;
  }
  return fetchImageUrl(input.query);
}

async function fetchImageUrl(query: string): Promise<string> {
  const unsplashKey = process.env.UNSPLASH_ACCESS_KEY;
  const pexelsKey = process.env.PEXELS_API_KEY;

  if (unsplashKey) {
    const url = await tryUnsplash(query, unsplashKey);
    if (url) return url;
  }

  if (pexelsKey) {
    const url = await tryPexels(query, pexelsKey);
    if (url) return url;
  }

  return makePlaceholder(query);
}

async function tryUnsplash(
  query: string,
  accessKey: string,
): Promise<string | null> {
  try {
    const params = new URLSearchParams({
      query,
      per_page: "1",
      orientation: "landscape",
    });
    const res = await fetch(
      `https://api.unsplash.com/search/photos?${params.toString()}`,
      {
        headers: { Authorization: `Client-ID ${accessKey}` },
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      results?: Array<{ urls?: { regular?: string } }>;
    };
    const url = data.results?.[0]?.urls?.regular;
    return url ?? null;
  } catch {
    return null;
  }
}

async function tryPexels(
  query: string,
  apiKey: string,
): Promise<string | null> {
  try {
    const params = new URLSearchParams({ query, per_page: "1" });
    const res = await fetch(
      `https://api.pexels.com/v1/search?${params.toString()}`,
      {
        headers: { Authorization: apiKey },
        signal: AbortSignal.timeout(4000),
      },
    );
    if (!res.ok) return null;
    const data = (await res.json()) as {
      photos?: Array<{ src?: { large?: string } }>;
    };
    const url = data.photos?.[0]?.src?.large;
    return url ?? null;
  } catch {
    return null;
  }
}

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
