/**
 * Bali vs Maldives vs Palawan beach compare.
 *
 * Geography is fixed and checked by test: Bali is in Indonesia, the
 * Maldives is its own country in the Indian Ocean, Palawan is an island
 * in the Philippines.
 *
 * Prices are Sample, not live. The Hello Axel seed in lib/travel/hotel-prices
 * holds New York hotels only, so no Axel price exists for these three
 * hotels and none is claimed. The hotel names are real properties and the
 * nightly and flight figures are the labelled Sample figures from the
 * approved compare mockup, shown so the layout can be read. Beetlebot
 * does not book. Every card says Sample next to its price.
 *
 * Photos come from Bousier and Wikipedia at resolve time. When no photo
 * resolves, the card keeps an empty imageUrl and the UI shows the named
 * fallback icon, never a generated image and never a placehold.co image.
 */

import type {
  HotelCard,
  ImageCard,
  OptionSet,
} from "@/lib/chat/rich-message";
import { resolveImageBatch } from "@/lib/media/bousier";
import { resolveHotelPhoto } from "@/lib/media/hotel-photo";

export const BEACH_COMPARE_CAP = 3;
export const BEACH_COMPARE_PROMPT = "Which beach?";
export const BEACH_COMPARE_PRICE_LABEL = "Sample, not live";

/** Fixed country lookup, checked against the geography rule. */
export const BEACH_COUNTRY: Record<string, string> = {
  Bali: "Indonesia",
  Maldives: "Maldives",
  Palawan: "Philippines",
};

export type BeachDestination = {
  title: string;
  country: string;
  hotelName: string;
  hotelArea: string;
  /** Sample nightly rate in USD, labelled Sample everywhere it shows. */
  sampleNightlyUsd: number;
  /** Sample round-trip flight price in CAD, labelled Sample. */
  sampleFlightCad: number;
  wikiUrl: string;
};

export const BEACH_DESTINATIONS: BeachDestination[] = [
  {
    title: "Bali",
    country: "Indonesia",
    hotelName: "Alila Villas Uluwatu",
    hotelArea: "Uluwatu, Bali",
    sampleNightlyUsd: 420,
    sampleFlightCad: 1240,
    wikiUrl: "https://en.wikipedia.org/wiki/Bali",
  },
  {
    title: "Maldives",
    country: "Maldives",
    hotelName: "Soneva Fushi",
    hotelArea: "Baa Atoll, Maldives",
    sampleNightlyUsd: 890,
    sampleFlightCad: 1480,
    wikiUrl: "https://en.wikipedia.org/wiki/Maldives",
  },
  {
    title: "Palawan",
    country: "Philippines",
    hotelName: "Pangulasian Island Resort",
    hotelArea: "El Nido, Palawan",
    sampleNightlyUsd: 310,
    sampleFlightCad: 1320,
    wikiUrl: "https://en.wikipedia.org/wiki/Palawan",
  },
];

function moneyUsd(amount: number): string {
  return `$${amount}`;
}

function moneyCad(amount: number): string {
  return `CA$${amount.toLocaleString("en-US")}`;
}

function cardFor(
  dest: BeachDestination,
  photoUrl: string,
  sourceName?: string,
): ImageCard {
  return {
    type: "image_card",
    title: dest.title,
    subtitle: dest.country,
    imageUrl: photoUrl,
    alt: `${dest.title} beach, ${dest.country}`,
    category: "Beach",
    compareRows: [
      { label: "Country", value: dest.country },
      { label: "Hotel", value: dest.hotelName },
      { label: "Flight", value: `${moneyCad(dest.sampleFlightCad)} (Sample)` },
      { label: "Per night", value: `${moneyUsd(dest.sampleNightlyUsd)} (Sample)` },
    ],
    meta: {
      hotel: dest.hotelName,
      flight: `${moneyCad(dest.sampleFlightCad)} Sample`,
      nightly: `${moneyUsd(dest.sampleNightlyUsd)} a night, Sample`,
    },
    actionUrl: dest.wikiUrl,
    sourceName,
  };
}

/**
 * Build the compare OptionSet with no photos attached. Use
 * resolveBeachComparePhotos when a real photo per option is wanted.
 * Order is fixed as listed, never re-sorted by price.
 */
export function buildBeachCompareOptionSet(): OptionSet {
  return {
    type: "option_set",
    prompt: BEACH_COMPARE_PROMPT,
    variant: "compare",
    items: BEACH_DESTINATIONS.slice(0, BEACH_COMPARE_CAP).map((dest, i) => ({
      index: i + 1,
      card: cardFor(dest, ""),
    })),
  };
}

/**
 * Resolve a real destination photo per option through Bousier and
 * Wikipedia, then return the compare with photos attached. A photo
 * that does not resolve stays empty and renders the named fallback.
 */
export async function resolveBeachComparePhotos(
  optionSet: OptionSet = buildBeachCompareOptionSet(),
): Promise<OptionSet> {
  const resolved = await resolveImageBatch(
    BEACH_DESTINATIONS.slice(0, BEACH_COMPARE_CAP).map((dest) => ({
      title: dest.title,
      actionUrl: dest.wikiUrl,
    })),
    { mode: "balanced", timeoutMs: 2200 },
  );
  return {
    ...optionSet,
    items: optionSet.items.map((item, i) => {
      const dest = BEACH_DESTINATIONS[i];
      const photo = resolved[i];
      return {
        ...item,
        card: cardFor(
          dest,
          photo?.selectedImageUrl ?? "",
          photo?.selectedSourceName === "wikipedia_summary"
            ? "Wikipedia"
            : photo?.selectedSourceName,
        ),
      };
    }),
  };
}

/**
 * Build one HotelCard per beach destination, with a Sample price and a
 * hotel photo resolved through Bousier. A hotel with no photo gets
 * photoUrl undefined and the named fallback "No hotel photo found".
 */
export async function buildBeachHotelCards(): Promise<HotelCard[]> {
  const cards: HotelCard[] = [];
  for (const dest of BEACH_DESTINATIONS) {
    const photo = await resolveHotelPhoto({
      name: dest.hotelName,
      area: dest.hotelArea,
      sourceUrl: dest.wikiUrl,
    });
    cards.push({
      id: `beach-${dest.title.toLowerCase()}`,
      name: dest.hotelName,
      area: dest.hotelArea,
      stars: null,
      price: {
        nightly: dest.sampleNightlyUsd,
        total: dest.sampleNightlyUsd * 5,
        currency: "USD",
        adults: 2,
        nights: 5,
        derived: false,
      },
      source: "Sample",
      sourceUrl: dest.wikiUrl,
      checkedAt: null,
      feeNote: "Sample price, not live. Confirm on the seller before booking.",
      photoUrl: photo.photoUrl ?? undefined,
      photoSourceName: photo.photoSourceName ?? undefined,
      photoFallback: photo.photoUrl ? undefined : photo.photoFallback,
    });
  }
  return cards;
}

/**
 * True when the three card titles are Bali, Maldives, and Palawan in
 * any order. The enricher uses this to spot a beach compare in the
 * normal model options flow, without a route change.
 */
export function isBeachCompareTitles(titles: string[]): boolean {
  const wanted = new Set(BEACH_DESTINATIONS.map((d) => d.title.toLowerCase()));
  const got = new Set(titles.map((t) => t.trim().toLowerCase()));
  return wanted.size === got.size && [...wanted].every((t) => got.has(t));
}

/**
 * Overlay the fixed compare rows, Beach category, and wiki link onto
 * enriched cards, keeping the resolved photo and source name. A
 * placehold.co image is dropped to an empty URL so the card shows the
 * named fallback icon instead of a placeholder image.
 */
export function applyBeachCompareRows(cards: ImageCard[]): ImageCard[] {
  return cards.map((card) => {
    const dest = BEACH_DESTINATIONS.find(
      (d) => d.title.toLowerCase() === card.title.trim().toLowerCase(),
    );
    if (!dest) return card;
    const base = cardFor(dest, "");
    return {
      ...card,
      subtitle: dest.country,
      imageUrl: card.imageUrl.includes("placehold.co") ? "" : card.imageUrl,
      category: "Beach",
      compareRows: base.compareRows,
      meta: base.meta,
      actionUrl: dest.wikiUrl,
    };
  });
}
