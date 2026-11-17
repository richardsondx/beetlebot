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
import { buildMapStrip, type MapStopInput, type MapStripData } from "@/lib/travel/map-strip";
import type { ItineraryStopInput } from "@/lib/travel/itinerary-timeline";
import {
  buildNearbyRow,
  type NearbyPlace,
  type NearbyPlaceInput,
} from "@/lib/travel/nearby";
import { normaliseDestinationTitle } from "@/lib/travel/destination-suggestion";

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
  /** Hotel coordinates, checked against public listings. */
  hotelLat: number;
  hotelLng: number;
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
    hotelLat: -8.8456,
    hotelLng: 115.1372,
    sampleNightlyUsd: 420,
    sampleFlightCad: 1240,
    wikiUrl: "https://en.wikipedia.org/wiki/Bali",
  },
  {
    title: "Maldives",
    country: "Maldives",
    hotelName: "Soneva Fushi",
    hotelArea: "Baa Atoll, Maldives",
    hotelLat: 5.1121,
    hotelLng: 73.078,
    sampleNightlyUsd: 890,
    sampleFlightCad: 1480,
    wikiUrl: "https://en.wikipedia.org/wiki/Maldives",
  },
  {
    title: "Palawan",
    country: "Philippines",
    hotelName: "Pangulasian Island Resort",
    hotelArea: "El Nido, Palawan",
    hotelLat: 11.1132,
    hotelLng: 119.3358,
    sampleNightlyUsd: 310,
    sampleFlightCad: 1320,
    wikiUrl: "https://en.wikipedia.org/wiki/Palawan",
  },
];

/**
 * Sample day stops per destination, for the map strip. Bali stops are
 * real places near Uluwatu with public coordinates. The Maldives and
 * Palawan stops sit on the resort island itself, at the hotel
 * coordinates, because the resorts occupy their own islands.
 */
export const BEACH_SAMPLE_STOPS: Record<string, MapStopInput[]> = {
  Bali: [
    { name: "Uluwatu Temple", lat: -8.8192, lng: 115.0845, day: 1 },
    { name: "Padang Padang Beach", lat: -8.8135, lng: 115.103, day: 2 },
  ],
  Maldives: [
    { name: "House reef, Kunfunadhoo Island", lat: 5.1121, lng: 73.078, day: 1 },
  ],
  Palawan: [
    { name: "Pangulasian Island Beach", lat: 11.1132, lng: 119.3358, day: 1 },
  ],
};

/**
 * Sample nearby places per destination, all on the resort grounds, so
 * within 800 m of the hotel. Offsets are small on-site approximations,
 * about 50 to 100 m from the hotel pin. No rating is claimed: none is
 * published for these venues, so the row shows no rating chip.
 */
export const BEACH_SAMPLE_NEARBY: Record<string, NearbyPlaceInput[]> = {
  Bali: [
    { name: "CIRE", category: "restaurant", lat: -8.8451, lng: 115.1372 },
    { name: "The Warung", category: "restaurant", lat: -8.8456, lng: 115.1377 },
    { name: "Spa Alila", category: "tourist_attraction", lat: -8.8461, lng: 115.1372 },
  ],
  Maldives: [
    { name: "Fresh in the Garden", category: "restaurant", lat: 5.1126, lng: 73.078 },
    { name: "Out of the Blue", category: "restaurant", lat: 5.1121, lng: 73.0785 },
  ],
  Palawan: [
    { name: "Pangulasian Island Beach", category: "tourist_attraction", lat: 11.1137, lng: 119.3358 },
  ],
};

/**
 * Suggested start times per sample stop, in the order the stops are
 * listed. Times are suggestions, labelled "suggested" where they show.
 */
export const BEACH_SAMPLE_STOP_TIMES: Record<string, string[]> = {
  Bali: ["09:00", "10:00"],
  Maldives: ["09:00"],
  Palawan: ["09:00"],
};

/** Day stops for a beach destination, with suggested times attached. */
export function beachItineraryStops(title: string): ItineraryStopInput[] {
  const dest = BEACH_DESTINATIONS.find(
    (d) => d.title.toLowerCase() === title.trim().toLowerCase(),
  );
  if (!dest) return [];
  const times = BEACH_SAMPLE_STOP_TIMES[dest.title] ?? [];
  return (BEACH_SAMPLE_STOPS[dest.title] ?? []).map((stop, i) => ({
    ...stop,
    day: stop.day ?? 1,
    time: times[i],
    category: "Beach",
    sourceUrl: dest.wikiUrl,
  }));
}

/** Build the map strip for a beach destination, or null for an unknown title. */
export function buildBeachMapStrip(title: string): MapStripData | null {
  const dest = BEACH_DESTINATIONS.find(
    (d) => d.title.toLowerCase() === title.trim().toLowerCase(),
  );
  if (!dest) return null;
  return buildMapStrip({
    hotelName: dest.hotelName,
    hotel: { lat: dest.hotelLat, lng: dest.hotelLng },
    stops: BEACH_SAMPLE_STOPS[dest.title] ?? [],
  });
}

/** Build the nearby row for a beach destination from its sample places. */
export async function buildBeachNearbyRow(title: string): Promise<NearbyPlace[]> {
  const dest = BEACH_DESTINATIONS.find(
    (d) => d.title.toLowerCase() === title.trim().toLowerCase(),
  );
  if (!dest) return [];
  return buildNearbyRow(
    { lat: dest.hotelLat, lng: dest.hotelLng },
    BEACH_SAMPLE_NEARBY[dest.title] ?? [],
  );
}

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
    // 5500ms so the tier caps (3000 + 2000) are not clipped: the
    // Wikipedia page takes about 1.6s, the summary about 1.0s, and
    // three parallel page fetches contend for the proxy.
    { mode: "balanced", timeoutMs: 5500 },
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
 * True when the message names at least two of the three beach
 * destinations. A compare ask names its options, so it never needs
 * a web research pass: research returns Toronto events for a beach
 * trip ask, while the recommendation path returns the three options
 * the compare overlays. The route uses this to skip research mode.
 */
export function mentionsBeachCompare(message: string): boolean {
  const text = (message ?? "").toLowerCase();
  const found = BEACH_DESTINATIONS.filter((d) =>
    new RegExp(`\\b${d.title.toLowerCase()}\\b`).test(text),
  );
  return found.length >= 2;
}

/**
 * True when the three card titles Bali, Maldives, and Palawan are all
 * present, in any order. Titles are normalised first, so "Bali, Indonesia"
 * counts as Bali, and extra cards, such as a backup, do not break the match.
 * The enricher uses this to spot a beach compare in the normal model
 * options flow, without a route change.
 */
export function isBeachCompareTitles(titles: string[]): boolean {
  const wanted = new Set(BEACH_DESTINATIONS.map((d) => d.title.toLowerCase()));
  const got = new Set(
    titles.map((t) => normaliseDestinationTitle(t).toLowerCase()),
  );
  return [...wanted].every((t) => got.has(t));
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
      (d) =>
        d.title.toLowerCase() ===
        normaliseDestinationTitle(card.title).toLowerCase(),
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
