/**
 * Price-pending destination suggestion card.
 *
 * When Beetlebot suggests a new destination and no price exists at all,
 * the suggestion still renders as a photo-first card, never a text-only
 * card. The price slot shows a plain "Price coming soon" state, never a
 * blank area and never an invented price.
 *
 * Photos come from Bousier and Wikipedia at resolve time (see
 * lib/chat/visual-enricher.ts). No Google call, no generated image,
 * no stock filler, no placehold.co image. When no photo resolves, the
 * card keeps an empty imageUrl and the UI shows the named fallback
 * icon plus the destination name.
 *
 * Geography is checked against the fixed rule: Bali is in Indonesia,
 * the Maldives is its own country in the Indian Ocean, Palawan is an
 * island in the Philippines. This table is kept in step with
 * BEACH_COUNTRY in lib/travel/beach-compare.ts, and the test checks
 * that the two agree.
 */

import type { ImageCard } from "@/lib/chat/rich-message";

/** Plain state shown where the price would go. */
export const PRICE_PENDING_LABEL = "Price coming soon";

/** Fixed country lookup for the known destinations, checked by test. */
export const DESTINATION_COUNTRY: Record<string, string> = {
  Bali: "Indonesia",
  Maldives: "Maldives",
  Palawan: "Philippines",
};

/** Wikipedia detail URL per known destination, used as the Bousier tier 1 source. */
export const DESTINATION_WIKI_URL: Record<string, string> = {
  Bali: "https://en.wikipedia.org/wiki/Bali",
  Maldives: "https://en.wikipedia.org/wiki/Maldives",
  Palawan: "https://en.wikipedia.org/wiki/Palawan",
};

/** Categories the LLM uses for a destination suggestion. */
export const DESTINATION_CATEGORIES = new Set(["destination", "beach"]);

const PRICE_LABELS = new Set(["price", "per night", "flight", "nightly", "total"]);

function normalise(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

/**
 * Bare destination name: the part before the first comma, trimmed.
 * The model writes "Bali, Indonesia", Wikipedia needs "Bali".
 */
export function normaliseDestinationTitle(title: string | undefined): string {
  return (title ?? "").split(",")[0].trim();
}

function knownDestination(title: string | undefined): string | undefined {
  const wanted = normalise(normaliseDestinationTitle(title));
  if (!wanted) return undefined;
  return Object.keys(DESTINATION_COUNTRY).find(
    (name) => name.toLowerCase() === wanted,
  );
}

/** True when the card is a destination suggestion, not a hotel, event, or restaurant. */
export function isDestinationSuggestion(card: {
  category?: string;
  title?: string;
}): boolean {
  if (DESTINATION_CATEGORIES.has(normalise(card.category))) return true;
  return knownDestination(card.title) !== undefined;
}

/**
 * A value counts as a price only when it looks like money: a currency
 * symbol or code with a number. A flight time such as "~4.5h from YYZ"
 * under a "flight" key is travel time, not a price, and must not block
 * the price-pending state.
 */
const MONEY_PATTERN = /[$€£]|USD|CAD|EUR|GBP/i;

/** True when the card already carries a price in a meta chip or a compare row. */
export function cardHasPrice(card: ImageCard): boolean {
  const metaHasPrice = Object.entries(card.meta ?? {}).some(
    ([key, value]) =>
      /price|nightly|flight|total/i.test(key) && MONEY_PATTERN.test(value),
  );
  if (metaHasPrice) return true;
  return (card.compareRows ?? []).some(
    (row) =>
      PRICE_LABELS.has(normalise(row.label)) && MONEY_PATTERN.test(row.value),
  );
}

/**
 * Mark a price-less destination suggestion as price-pending. Cards with
 * a price, and cards that are not destination suggestions, pass through
 * unchanged. The UI renders the pending state from the flag, and the
 * plain-text fallback prints "Price: Price coming soon".
 */
export function applyPricePending(card: ImageCard): ImageCard {
  if (card.pricePending) return card;
  if (!isDestinationSuggestion(card)) return card;
  if (cardHasPrice(card)) return card;
  return { ...card, pricePending: true };
}

/** Wikipedia detail URL for a known destination, or undefined. */
export function wikiUrlForDestination(title: string): string | undefined {
  const name = knownDestination(title);
  return name ? DESTINATION_WIKI_URL[name] : undefined;
}

/**
 * Correct the country label for a known destination. Only a subtitle
 * that is itself a place label (a bare country name, or missing) is
 * corrected; a one-sentence pitch subtitle is kept as the "why it fits"
 * line. A wrong Country compare row is corrected too.
 */
export function correctDestinationCountry(card: ImageCard): ImageCard {
  const name = knownDestination(card.title);
  if (!name) return card;
  const country = DESTINATION_COUNTRY[name];
  let next = card;
  const subtitle = (card.subtitle ?? "").trim();
  const knownCountries = new Set(
    Object.values(DESTINATION_COUNTRY).map((c) => c.toLowerCase()),
  );
  if (!subtitle || knownCountries.has(subtitle.toLowerCase())) {
    if (subtitle.toLowerCase() !== country.toLowerCase()) {
      next = { ...next, subtitle: country };
    }
  }
  const rows = card.compareRows;
  const countryRow = rows?.find((r) => normalise(r.label) === "country");
  if (countryRow && countryRow.value.trim().toLowerCase() !== country.toLowerCase()) {
    next = {
      ...next,
      compareRows: rows!.map((r) =>
        normalise(r.label) === "country" ? { ...r, value: country } : r,
      ),
    };
  }
  return next;
}
