/**
 * Near your hotel row: places within 800 m of the hotel.
 *
 * Design (opus_pass1.md section 6):
 * - Data source is Google Places Nearby Search, types restaurant, cafe,
 *   tourist_attraction, within an 800 m radius (about 10 min at 5 km/h).
 *   No key exists, so no Places call is made; the builder below works on
 *   caller-supplied places and the Google step stays queued.
 * - Each item shows a photo (Places Photos, otherwise fallback icon),
 *   name, rating when Places returns one, "~N min walk", category badge.
 * - Order is walk time ascending. Ties go to the higher rating.
 * - Cap is 5 items. Mix rule: at least 1 of each type when available.
 * - Empty state reads "Nothing found within a 10 min walk". No padding
 *   from farther results.
 * - A place with no photo shows the fallback icon, never a generated
 *   image. A place with no rating shows no rating chip.
 * - Tap opens Google Maps for that place.
 */

import { resolveNearbyPhoto } from "@/lib/media/nearby-photo";
import {
  formatWalkTime,
  googleMapsPointUrl,
  haversineKm,
  type LatLng,
} from "@/lib/travel/geo";

/** Nearby radius in metres, about a 10 min walk at 5 km/h. */
export const NEARBY_RADIUS_M = 800;

/** Most places the row shows. */
export const NEARBY_CAP = 5;

export const NEARBY_EMPTY_TEXT = "Nothing found within a 10 min walk";

export const NEARBY_GOOGLE_STATUS =
  "Queued: Google Places Nearby Search needs a server-side API key and a spend limit from Richardson. No billable Google call is made.";

export type NearbyCategory = "restaurant" | "cafe" | "tourist_attraction";

export const NEARBY_CATEGORIES: NearbyCategory[] = [
  "restaurant",
  "cafe",
  "tourist_attraction",
];

export type NearbyPlaceInput = {
  name: string;
  category: NearbyCategory;
  lat: number;
  lng: number;
  /** Rating from Places, omitted when Places returns none. */
  rating?: number | null;
  sourceUrl?: string;
};

export type NearbyPlace = {
  name: string;
  category: NearbyCategory;
  rating: number | null;
  distanceKm: number;
  walkText: string;
  mapsUrl: string;
  photoUrl: string | null;
  photoSourceName: string | null;
  photoFallback: string;
};

/** Category badge text shown on the card. */
export function nearbyCategoryLabel(category: NearbyCategory): string {
  if (category === "tourist_attraction") return "Attraction";
  if (category === "cafe") return "Cafe";
  return "Restaurant";
}

/**
 * Filter to places within 800 m, sort by walk time ascending with ties
 * to the higher rating, then cap at 5 keeping at least 1 of each type
 * when available. Places past 800 m are never used as padding.
 */
export function filterNearbyPlaces(
  hotel: LatLng,
  places: NearbyPlaceInput[],
): Array<NearbyPlaceInput & { distanceKm: number }> {
  const within = places
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng))
    .map((p) => ({
      ...p,
      distanceKm: haversineKm(hotel, { lat: p.lat, lng: p.lng }),
    }))
    .filter((p) => p.distanceKm * 1000 <= NEARBY_RADIUS_M);
  within.sort((a, b) => {
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    return (b.rating ?? 0) - (a.rating ?? 0);
  });
  if (within.length <= NEARBY_CAP) return within;
  const picked: Array<(typeof within)[number]> = [];
  const pickedNames = new Set<string>();
  for (const category of NEARBY_CATEGORIES) {
    const first = within.find(
      (p) => p.category === category && !pickedNames.has(p.name),
    );
    if (first) {
      picked.push(first);
      pickedNames.add(first.name);
    }
  }
  for (const p of within) {
    if (picked.length >= NEARBY_CAP) break;
    if (!pickedNames.has(p.name)) {
      picked.push(p);
      pickedNames.add(p.name);
    }
  }
  picked.sort((a, b) => {
    if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
    return (b.rating ?? 0) - (a.rating ?? 0);
  });
  return picked;
}

/**
 * Build the nearby row for a hotel from caller-supplied places. Photos
 * resolve through Bousier and Wikipedia; a place with no photo keeps
 * the named fallback. Returns an empty list when nothing is within
 * 800 m, and the UI shows the empty state.
 */
export async function buildNearbyRow(
  hotel: LatLng,
  places: NearbyPlaceInput[],
): Promise<NearbyPlace[]> {
  const picked = filterNearbyPlaces(hotel, places);
  const out: NearbyPlace[] = [];
  for (const place of picked) {
    const photo = await resolveNearbyPhoto({
      name: place.name,
      sourceUrl: place.sourceUrl,
    });
    out.push({
      name: place.name,
      category: place.category,
      rating:
        typeof place.rating === "number" && Number.isFinite(place.rating)
          ? place.rating
          : null,
      distanceKm: place.distanceKm,
      walkText: formatWalkTime(place.distanceKm),
      mapsUrl: googleMapsPointUrl({ lat: place.lat, lng: place.lng }),
      photoUrl: photo.photoUrl,
      photoSourceName: photo.photoSourceName,
      photoFallback: photo.photoFallback,
    });
  }
  return out;
}

/** Plain-text line for one nearby place. */
export function nearbyPlaceToText(place: NearbyPlace): string {
  const rating = place.rating !== null ? `, ${place.rating} stars` : "";
  return `${place.name} (${nearbyCategoryLabel(place.category)}${rating}) · ${place.walkText} · ${place.mapsUrl}`;
}

/** Convert a built nearby row into the chat NearbyRowBlock shape. */
export function toNearbyRowBlock(
  hotelName: string,
  places: NearbyPlace[],
): import("@/lib/chat/rich-message").NearbyRowBlock {
  return {
    type: "nearby_row",
    hotelName,
    places: places.map((p) => ({
      name: p.name,
      category: nearbyCategoryLabel(p.category),
      rating: p.rating,
      walkText: p.walkText,
      mapsUrl: p.mapsUrl,
      photoUrl: p.photoUrl,
      photoSourceName: p.photoSourceName,
      photoFallback: p.photoFallback,
    })),
    emptyText: NEARBY_EMPTY_TEXT,
  };
}
