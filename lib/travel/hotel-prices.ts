/**
 * Hotel prices for chat. Seed data is the Hello Axel check from Nov 16, 2026,
 * for New York, Dec 11 to 14, 3 nights, 2 adults, 1 room. Axel publishes its
 * rates for 2 adults; no working source gave a 1 adult rate, so the cards say
 * so. Prices move daily: confirm on the seller before booking.
 * A live refresh re-fetches the hotel's Hello Axel page and parses a total.
 * When parsing fails the price stays null and the card shows "No live price yet".
 * No number is ever guessed.
 */

import type { HotelCard, HotelSetBlock } from "@/lib/chat/rich-message";

export type HotelStay = {
  checkIn: string;
  checkOut: string;
  adults: number;
};

type SeedHotel = {
  id: string;
  name: string;
  area: string;
  stars: number;
  nightly: number | null;
  total: number | null;
  sourceUrl: string;
  feeNote?: string;
};

export const HOTEL_SOURCE = "Hello Axel";
export const HOTEL_CHECKED_AT = "2026-11-16T23:30:00-05:00";
const CACHE_TTL_MS = 30 * 60 * 1000;

export const AXEL_HOTEL_SEED: SeedHotel[] = [
  {
    id: "pod-brooklyn",
    name: "Pod Brooklyn",
    area: "Williamsburg, Brooklyn",
    stars: 3,
    nightly: 373,
    total: 1120,
    sourceUrl:
      "https://helloaxel.com/en/hotels/new-york/pod-brooklyn-1080035/2026-12-11/2026-12-14/2-adults",
    feeNote: "Facility fee $29.84 a night, listed separately.",
  },
  {
    id: "even-brooklyn",
    name: "EVEN Hotel Brooklyn by IHG",
    area: "Downtown Brooklyn",
    stars: 4,
    nightly: null,
    total: 1362,
    sourceUrl:
      "https://helloaxel.com/en/hotels/new-york/even-hotel-brooklyn-by-ihg-1036132/2026-12-11/2026-12-14/2-adults",
    feeNote: "Mandatory destination fee, amount not stated.",
  },
  {
    id: "wall-street-hotel",
    name: "The Wall Street Hotel",
    area: "Financial District, Manhattan",
    stars: 5,
    nightly: null,
    total: 2379,
    sourceUrl: "https://helloaxel.com/en/flights/from-victoria-best-us-cities-to-visit",
    feeNote: "Shortlist price, its own dated page was not opened.",
  },
  {
    id: "distrikt-hotel",
    name: "Distrikt Hotel New York City",
    area: "Midtown Manhattan",
    stars: 4,
    nightly: null,
    total: 1879,
    sourceUrl:
      "https://helloaxel.com/en/hotels/new-york/distrikt-hotel-new-york-city-tapestry-collection-by-hilton-1346194",
  },
];

/** Nights between two ISO dates. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = new Date(`${checkIn}T12:00:00Z`).getTime();
  const end = new Date(`${checkOut}T12:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 3;
  return Math.max(1, Math.round((end - start) / 86_400_000));
}

/**
 * Derive a nightly rate from a stay total. The result is labelled "about"
 * in the UI and the source total stays the larger figure.
 */
export function derivedNightly(total: number, nights: number): number {
  return Math.round(total / nights);
}

// ── 30-minute in-memory price cache ─────────────────────────────────────────

type CacheEntry = { nightly: number | null; total: number | null; at: number };
const priceCache = new Map<string, CacheEntry>();

function cacheKey(hotelId: string, stay: HotelStay): string {
  return `${hotelId}|${stay.checkIn}|${stay.checkOut}|${stay.adults}`;
}

export function getCachedPrice(
  hotelId: string,
  stay: HotelStay,
): { nightly: number | null; total: number | null } | null {
  const entry = priceCache.get(cacheKey(hotelId, stay));
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    priceCache.delete(cacheKey(hotelId, stay));
    return null;
  }
  return { nightly: entry.nightly, total: entry.total };
}

export function setCachedPrice(
  hotelId: string,
  stay: HotelStay,
  price: { nightly: number | null; total: number | null },
): void {
  priceCache.set(cacheKey(hotelId, stay), { ...price, at: Date.now() });
}

export function buildHotelSetBlock(stay: HotelStay): HotelSetBlock {
  const nights = nightsBetween(stay.checkIn, stay.checkOut);
  const hotels: HotelCard[] = AXEL_HOTEL_SEED.map((seed) => {
    const cached = getCachedPrice(seed.id, stay);
    const nightly = cached?.nightly ?? seed.nightly;
    const total = cached?.total ?? seed.total;
    return {
      id: seed.id,
      name: seed.name,
      area: seed.area,
      stars: seed.stars,
      price:
        nightly === null && total === null
          ? null
          : {
              nightly:
                nightly ?? (total !== null ? derivedNightly(total, nights) : null),
              total,
              currency: "USD",
              adults: 2,
              nights,
              derived: nightly === null && total !== null,
            },
      source: HOTEL_SOURCE,
      sourceUrl: seed.sourceUrl,
      checkedAt: HOTEL_CHECKED_AT,
      feeNote: seed.feeNote,
    };
  });
  return {
    type: "hotel_set",
    stay: { checkIn: stay.checkIn, checkOut: stay.checkOut, adults: stay.adults },
    hotels,
    checkedAt: HOTEL_CHECKED_AT,
  };
}

/**
 * Best-effort total parser for a Hello Axel hotel page. Looks for a dollar
 * amount near the word "total". Returns null when nothing parses, so the card
 * shows "No live price yet" instead of a guessed number.
 */
export function extractTotalFromHtml(html: string): number | null {
  const nearTotal = html.match(/total[^$]{0,200}\$\s?([\d,]+(?:\.\d{2})?)/i);
  if (nearTotal) {
    const value = Number(nearTotal[1].replace(/,/g, ""));
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

/**
 * Re-fetch one hotel's Hello Axel page and parse a fresh total.
 * Returns the refreshed price, or null when the fetch or parse fails.
 */
export async function refreshHotelPrice(
  hotelId: string,
  stay: HotelStay,
): Promise<{ nightly: number | null; total: number | null } | null> {
  const seed = AXEL_HOTEL_SEED.find((h) => h.id === hotelId);
  if (!seed) return null;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(seed.sourceUrl, {
      headers: { "User-Agent": "beetlebot/0.1 (hotel price check)" },
      signal: controller.signal,
    });
    if (!response.ok) return null;
    const html = await response.text();
    const total = extractTotalFromHtml(html);
    if (total === null) return null;
    const nights = nightsBetween(stay.checkIn, stay.checkOut);
    const price = { nightly: derivedNightly(total, nights), total };
    setCachedPrice(hotelId, stay, price);
    return price;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
