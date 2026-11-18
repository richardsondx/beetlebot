/**
 * Visual itinerary timeline: one card per day, stops listed vertically.
 *
 * Design (opus_pass1.md section 7, kit/timeline-checklist.md):
 * - One card per day: "Day 2 · Tue". Stops list vertically.
 * - Each stop row shows a time, a thumbnail photo, a name, a line like
 *   "1.2 km from hotel · ~14 min walk", and a pin number that matches
 *   the map strip. Pin numbers are assigned in the same order as
 *   buildMapStrip, so the two agree: pinned stops in input order get
 *   1 to 9, stops past 9 and stops without coordinates get no pin.
 * - Times are suggestions, labelled "suggested" in the UI and in text.
 * - A day with no photos uses the compact text layout: time, category
 *   icon, name, distance line. No stock or generated images.
 * - Plain-text fallback: "Day 2: 09:00 Beach X (~10 min walk) <maps url>".
 * - Days collapse after Day 3 behind "Show all days".
 *
 * Distances are straight line (haversine) from the hotel at 5 km/h,
 * always shown with "~". No routing is used. Photos resolve through
 * Bousier and Wikipedia; a stop with no photo keeps a null photoUrl
 * and renders the compact text row.
 */

import {
  formatDistanceKm,
  formatWalkTime,
  googleMapsPointUrl,
  googleMapsTextSearchUrl,
  haversineKm,
  type LatLng,
} from "@/lib/travel/geo";
import { MAP_STRIP_MAX_PINS } from "@/lib/travel/map-strip";
import { resolveItineraryStopPhoto } from "@/lib/media/itinerary-photo";

/** Days shown before the "Show all days" collapse. */
export const TIMELINE_COLLAPSE_AFTER_DAY = 3;

export const TIMELINE_SHOW_ALL_LABEL = "Show all days";

/** Suggested times used when a stop carries no time of its own. */
export const TIMELINE_DEFAULT_TIMES = ["09:00", "13:00", "17:00"];

export type ItineraryStopInput = {
  name: string;
  lat?: number;
  lng?: number;
  /** Day the stop belongs to, 1-based. */
  day: number;
  /** Suggested start time, for example "09:00". Defaults by order in the day. */
  time?: string;
  /** Short category label, for example "Beach". Shown on the compact row. */
  category?: string;
  sourceUrl?: string;
};

export type ItineraryTimelineStop = {
  /** Pin number, 1-based, matching the map strip. Null when unpinned. */
  pin: number | null;
  name: string;
  /** Suggested time, for example "09:00". */
  time: string;
  category?: string;
  /** From-hotel distance line, for example "1.2 km from hotel · ~14 min walk". */
  distanceLine: string | null;
  mapsUrl: string;
  photoUrl: string | null;
  photoSourceName: string | null;
  photoFallback: string;
};

export type ItineraryTimelineDay = {
  day: number;
  /** "Day 2 · Tue" when a start date is known, else "Day 2". */
  label: string;
  stops: ItineraryTimelineStop[];
};

export type ItineraryTimelineData = {
  hotelName: string;
  hotel: LatLng;
  days: ItineraryTimelineDay[];
};

function hasCoords(stop: ItineraryStopInput): stop is ItineraryStopInput & {
  lat: number;
  lng: number;
} {
  return (
    typeof stop.lat === "number" &&
    typeof stop.lng === "number" &&
    Number.isFinite(stop.lat) &&
    Number.isFinite(stop.lng)
  );
}

function dayLabel(day: number, startDate?: string): string {
  if (!startDate) return `Day ${day}`;
  const start = new Date(`${startDate}T12:00:00`);
  if (Number.isNaN(start.getTime())) return `Day ${day}`;
  const date = new Date(start);
  date.setDate(start.getDate() + (day - 1));
  const weekday = new Intl.DateTimeFormat("en-US", { weekday: "short" }).format(date);
  return `Day ${day} · ${weekday}`;
}

/**
 * Build the timeline structure for a hotel plus day stops. Photos stay
 * null here; call resolveItineraryTimelinePhotos to fill them. Pin
 * numbers match buildMapStrip for the same stops in the same order.
 */
export function buildItineraryTimeline(input: {
  hotelName: string;
  hotel: LatLng;
  stops: ItineraryStopInput[];
  /** ISO start date, for example "2026-12-11". Without it, days have no weekday. */
  startDate?: string;
}): ItineraryTimelineData {
  let pinCounter = 0;
  const byDay = new Map<number, ItineraryTimelineStop[]>();
  const dayOrder: number[] = [];
  for (const stop of input.stops) {
    const dayStops = byDay.get(stop.day) ?? [];
    if (!byDay.has(stop.day)) {
      byDay.set(stop.day, dayStops);
      dayOrder.push(stop.day);
    }
    const time =
      stop.time ??
      TIMELINE_DEFAULT_TIMES[dayStops.length % TIMELINE_DEFAULT_TIMES.length];
    if (hasCoords(stop) && pinCounter < MAP_STRIP_MAX_PINS) {
      pinCounter += 1;
      const km = haversineKm(input.hotel, { lat: stop.lat, lng: stop.lng });
      dayStops.push({
        pin: pinCounter,
        name: stop.name,
        time,
        category: stop.category,
        distanceLine: `${formatDistanceKm(km)} from hotel · ${formatWalkTime(km)}`,
        mapsUrl: googleMapsPointUrl({ lat: stop.lat, lng: stop.lng }),
        photoUrl: null,
        photoSourceName: null,
        photoFallback: "No photo found",
      });
    } else {
      dayStops.push({
        pin: null,
        name: stop.name,
        time,
        category: stop.category,
        distanceLine: null,
        mapsUrl: hasCoords(stop)
          ? googleMapsPointUrl({ lat: stop.lat, lng: stop.lng })
          : googleMapsTextSearchUrl(stop.name),
        photoUrl: null,
        photoSourceName: null,
        photoFallback: "No photo found",
      });
    }
  }
  dayOrder.sort((a, b) => a - b);
  return {
    hotelName: input.hotelName,
    hotel: input.hotel,
    days: dayOrder.map((day) => ({
      day,
      label: dayLabel(day, input.startDate),
      stops: byDay.get(day) ?? [],
    })),
  };
}

/**
 * Fill one real photo per stop through Bousier and Wikipedia. A stop
 * with no photo keeps a null photoUrl and renders the compact text row.
 */
export async function resolveItineraryTimelinePhotos(
  timeline: ItineraryTimelineData,
  stops: ItineraryStopInput[],
): Promise<ItineraryTimelineData> {
  const photoByKey = new Map<string, { photoUrl: string | null; photoSourceName: string | null; photoFallback: string }>();
  for (const stop of stops) {
    const key = `${stop.day}:${stop.name}`;
    if (photoByKey.has(key)) continue;
    photoByKey.set(
      key,
      await resolveItineraryStopPhoto({ name: stop.name, sourceUrl: stop.sourceUrl }),
    );
  }
  return {
    ...timeline,
    days: timeline.days.map((day) => ({
      ...day,
      stops: day.stops.map((stop) => {
        const photo = photoByKey.get(`${day.day}:${stop.name}`);
        if (!photo) return stop;
        return {
          ...stop,
          photoUrl: photo.photoUrl,
          photoSourceName: photo.photoSourceName,
          photoFallback: photo.photoFallback,
        };
      }),
    })),
  };
}

/** Plain-text line for one stop, in the checklist format. */
export function timelineStopToText(day: number, stop: ItineraryTimelineStop): string {
  const walk = stop.distanceLine
    ? (stop.distanceLine.split(" · ").pop() ?? stop.distanceLine)
    : "location unknown";
  return `Day ${day}: ${stop.time} ${stop.name} (${walk}) ${stop.mapsUrl}`;
}

/** Convert timeline data into the chat ItineraryTimelineBlock shape. */
export function toItineraryTimelineBlock(
  data: ItineraryTimelineData,
): import("@/lib/chat/rich-message").ItineraryTimelineBlock {
  return {
    type: "itinerary_timeline",
    hotelName: data.hotelName,
    days: data.days.map((day) => ({
      day: day.day,
      label: day.label,
      stops: day.stops.map((s) => ({
        pin: s.pin,
        name: s.name,
        time: s.time,
        category: s.category,
        distanceLine: s.distanceLine,
        mapsUrl: s.mapsUrl,
        photoUrl: s.photoUrl,
        photoSourceName: s.photoSourceName,
        photoFallback: s.photoFallback,
      })),
    })),
  };
}
