/**
 * Tappable follow-ups: rule chips from the block that was shown, merged with
 * model chips from the <followups> tag in the reply. At most 4 chips, under
 * the latest assistant reply only.
 */

import type { FollowUp, RichBlock } from "./rich-message";

const MAX_CHIPS = 4;

const FLIGHT_CHIPS: FollowUp[] = [
  { label: "Show hotels in Brooklyn", message: "Show hotels in Brooklyn" },
  { label: "Only nonstop flights", message: "Only nonstop flights" },
  { label: "Leave Saturday instead", message: "Leave Saturday instead" },
  { label: "Set the vibe: food and music", message: "Set the vibe: food and music" },
];

const HOTEL_CHIPS: FollowUp[] = [
  { label: "Find dinner near the hotel Friday", message: "Find dinner near the hotel Friday" },
  { label: "Check the weather", message: "Check the weather in New York for Dec 11 to 14" },
  { label: "Add this to my calendar", message: "Add this trip to my calendar" },
];

/**
 * Chips under a set of destination previews: one "Tell me more"
 * per place, plus the February question. Kept as listed in the
 * design for now; the February chip asks for a ranking and is
 * B3's to replace.
 */
function previewChips(blocks: RichBlock[]): FollowUp[] {
  const previews = blocks.filter(
    (b): b is Extract<RichBlock, { type: "destination_preview" }> =>
      b.type === "destination_preview",
  );
  if (previews.length < 2) return [];
  const chips: FollowUp[] = previews.map((p) => {
    const name = p.place === "Maldives" ? "the Maldives" : p.place;
    return {
      label: `Tell me more about ${name}`,
      message: `Tell me more about ${name}`,
    };
  });
  chips.push({
    label: "Which is best in February?",
    message: "Which is best in February?",
  });
  return chips;
}

/** Rule chips from the blocks in the latest reply. */
export function ruleFollowUps(blocks: RichBlock[] | undefined): FollowUp[] {
  if (!blocks?.length) return [];
  const out: FollowUp[] = [];
  for (const block of blocks) {
    if (block.type === "flight_compare") out.push(...FLIGHT_CHIPS);
    if (block.type === "hotel_set") out.push(...HOTEL_CHIPS);
  }
  out.push(...previewChips(blocks));
  return out;
}

/**
 * Strip a <followups> JSON list from the reply text and return it.
 * Bad JSON is dropped quietly. Also handles a JSON reply body with a
 * "followups" field. The tag never reaches the user.
 */
export function extractFollowUps(text: string): { text: string; items: FollowUp[] } {
  const tagMatch = text.match(/<followups>\s*([\s\S]*?)\s*<\/followups>/i);
  if (tagMatch) {
    const items = parseFollowUpList(tagMatch[1]);
    return { text: text.replace(tagMatch[0], "").trim(), items };
  }
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      if (Array.isArray(parsed.followups)) {
        const items = parseFollowUpList(JSON.stringify(parsed.followups));
        const { followups: _dropped, ...rest } = parsed;
        void _dropped;
        return { text: JSON.stringify(rest), items };
      }
    } catch {
      // Not JSON, fall through.
    }
  }
  return { text, items: [] };
}

function parseFollowUpList(raw: string): FollowUp[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: FollowUp[] = [];
    for (const item of parsed.slice(0, 2)) {
      if (typeof item === "string" && item.trim()) {
        out.push({ label: item.trim().slice(0, 80), message: item.trim().slice(0, 200) });
      } else if (item && typeof item === "object") {
        const obj = item as Record<string, unknown>;
        const message = typeof obj.message === "string" ? obj.message : typeof obj.label === "string" ? obj.label : "";
        const label = typeof obj.label === "string" ? obj.label : message;
        if (message.trim()) {
          out.push({ label: label.trim().slice(0, 80), message: message.trim().slice(0, 200) });
        }
      }
    }
    return out;
  } catch {
    return [];
  }
}

/** Merge rule chips first, then model chips, deduped by message, capped at 4. */
export function mergeFollowUps(input: {
  model: FollowUp[];
  blocks: RichBlock[] | undefined;
}): FollowUp[] {
  const seen = new Set<string>();
  const out: FollowUp[] = [];
  for (const chip of [...ruleFollowUps(input.blocks), ...input.model]) {
    const key = chip.message.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(chip);
    if (out.length >= MAX_CHIPS) break;
  }
  return out;
}
