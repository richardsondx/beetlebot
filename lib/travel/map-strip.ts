/**
 * Map strip: one static map image per trip, hotel pin plus numbered stops.
 *
 * Design (opus_pass1.md section 5):
 * - Google Static Maps image, hotel pin labeled "H", day stops as numbered
 *   pins 1 to n, at most 9 pins per strip.
 * - Under the image, rows read "1 · Beach X · 0.8 km · ~10 min walk".
 * - Distance is straight line (haversine) at 5 km/h, always shown with "~".
 *   No routing, no pan or zoom, no live traffic, no turn-by-turn.
 * - Tap a stop opens Google Maps search for that stop. Tap the strip
 *   opens the hotel location.
 * - A stop with no coordinates lists with no pin number, reads
 *   "location unknown", with no distance. It opens a Google Maps text
 *   search by name.
 *
 * No Google key exists in the working copy, so no billable Google call is
 * made. buildStaticMapsUrl returns null without a key and the strip shows
 * the named fallback instead of an image. When Richardson supplies a key
 * and a spend limit, set GOOGLE_MAPS_API_KEY and the image URL is built.
 */

import {
  formatDistanceKm,
  formatWalkTime,
  googleMapsPointUrl,
  googleMapsTextSearchUrl,
  haversineKm,
  type LatLng,
} from "@/lib/travel/geo";

/** Most numbered pins a Static Maps strip holds. */
export const MAP_STRIP_MAX_PINS = 9;

export const MAP_STRIP_NO_KEY_FALLBACK =
  "Map image not available yet: Google Static Maps needs a server-side API key and a spend limit from Richardson.";

export const MAP_STRIP_GOOGLE_STATUS =
  "Queued: Google Static Maps needs a server-side API key and a spend limit from Richardson. No billable Google call is made.";

export type MapStopInput = {
  name: string;
  lat?: number;
  lng?: number;
  /** Day the stop belongs to, when known. */
  day?: number;
};

export type MapStopRow = {
  /** Pin number, 1-based. Null when the stop has no coordinates. */
  pin: number | null;
  name: string;
  day?: number;
  distanceKm: number | null;
  distanceText: string | null;
  walkText: string | null;
  mapsUrl: string;
};

export type MapStripData = {
  hotelName: string;
  hotel: LatLng;
  hotelMapsUrl: string;
  /** Static Maps image URL, null when no key exists. */
  staticMapsUrl: string | null;
  mapFallback: string;
  stops: MapStopRow[];
};

/** Google Static Maps key, when Richardson supplies one. */
export function getStaticMapsKey(): string | null {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim();
  return key ? key : null;
}

/**
 * Build a Google Static Maps URL for the hotel pin plus numbered stops.
 * Returns null when no key exists, so no billable call is made.
 */
export function buildStaticMapsUrl(
  hotel: LatLng,
  pinnedStops: Array<LatLng & { pin: number }>,
  apiKey: string | null = getStaticMapsKey(),
): string | null {
  if (!apiKey) return null;
  const params = new URLSearchParams();
  params.set("size", "640x320");
  params.set("maptype", "roadmap");
  params.append(
    "markers",
    `color:red|label:H|${hotel.lat},${hotel.lng}`,
  );
  for (const stop of pinnedStops) {
    params.append(
      "markers",
      `color:blue|label:${stop.pin}|${stop.lat},${stop.lng}`,
    );
  }
  params.set("key", apiKey);
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;
}

/**
 * Build the map strip data for a hotel plus day stops. Stops with
 * coordinates get pin numbers 1 to 9 in order; later stops and stops
 * without coordinates list with no pin and "location unknown".
 */
export function buildMapStrip(input: {
  hotelName: string;
  hotel: LatLng;
  stops: MapStopInput[];
}): MapStripData {
  const pinned = input.stops.filter(
    (s): s is MapStopInput & { lat: number; lng: number } =>
      typeof s.lat === "number" &&
      typeof s.lng === "number" &&
      Number.isFinite(s.lat) &&
      Number.isFinite(s.lng),
  );
  const pinnedCapped = pinned.slice(0, MAP_STRIP_MAX_PINS);
  const pinnedSet = new Set(pinnedCapped);
  let pinCounter = 0;
  const rows: MapStopRow[] = input.stops.map((stop) => {
    const isPinned = pinnedSet.has(
      stop as MapStopInput & { lat: number; lng: number },
    );
    if (!isPinned) {
      return {
        pin: null,
        name: stop.name,
        day: stop.day,
        distanceKm: null,
        distanceText: null,
        walkText: null,
        mapsUrl: googleMapsTextSearchUrl(stop.name),
      };
    }
    pinCounter += 1;
    const km = haversineKm(input.hotel, { lat: stop.lat!, lng: stop.lng! });
    return {
      pin: pinCounter,
      name: stop.name,
      day: stop.day,
      distanceKm: km,
      distanceText: formatDistanceKm(km),
      walkText: formatWalkTime(km),
      mapsUrl: googleMapsPointUrl({ lat: stop.lat!, lng: stop.lng! }),
    };
  });
  const pinnedWithPins = pinnedCapped.map((stop, i) => ({
    lat: stop.lat,
    lng: stop.lng,
    pin: i + 1,
  }));
  const staticMapsUrl = buildStaticMapsUrl(input.hotel, pinnedWithPins);
  return {
    hotelName: input.hotelName,
    hotel: input.hotel,
    hotelMapsUrl: googleMapsPointUrl(input.hotel),
    staticMapsUrl,
    mapFallback: staticMapsUrl ? "" : MAP_STRIP_NO_KEY_FALLBACK,
    stops: rows,
  };
}

/** Plain-text line for one stop row, in the Opus format. */
export function mapStopRowToText(row: MapStopRow): string {
  if (row.pin === null) {
    return `${row.name} · location unknown · ${row.mapsUrl}`;
  }
  return `${row.pin} · ${row.name} · ${row.distanceText} · ${row.walkText} · ${row.mapsUrl}`;
}

/** Convert strip data into the chat MapStripBlock shape. */
export function toMapStripBlock(data: MapStripData): import("@/lib/chat/rich-message").MapStripBlock {
  return {
    type: "map_strip",
    hotelName: data.hotelName,
    hotelLat: data.hotel.lat,
    hotelLng: data.hotel.lng,
    hotelMapsUrl: data.hotelMapsUrl,
    staticMapsUrl: data.staticMapsUrl,
    mapFallback: data.mapFallback,
    stops: data.stops.map((s) => ({
      pin: s.pin,
      name: s.name,
      day: s.day,
      distanceText: s.distanceText,
      walkText: s.walkText,
      mapsUrl: s.mapsUrl,
    })),
  };
}
