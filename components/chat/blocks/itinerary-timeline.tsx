"use client";

import { useState } from "react";
import type { ItineraryTimelineBlock } from "@/lib/chat/rich-message";

/**
 * Days shown before the "Show all days" collapse. Local copy, kept in
 * step with TIMELINE_COLLAPSE_AFTER_DAY in lib/travel/itinerary-timeline.ts:
 * importing that module here would pull the server-only photo resolver
 * (node:fs) into the client bundle.
 */
const TIMELINE_COLLAPSE_AFTER_DAY = 3;
const TIMELINE_SHOW_ALL_LABEL = "Show all days";

/**
 * Visual itinerary timeline: one card per day, stops listed vertically.
 * Each stop row shows a suggested time, a thumbnail photo, a name, a
 * from-hotel distance line, and a pin number matching the map strip.
 * A day with no photos uses the compact text layout: time, category
 * icon, name, distance line. No stock or generated images. Days after
 * Day 3 collapse behind "Show all days". A tap opens Google Maps.
 *
 * Single-day mode is the destination preview's "What a day could look
 * like": only the first day shows, under that heading, with no collapse
 * control.
 */
export function ItineraryTimelineView({
  block,
  singleDay,
}: {
  block: ItineraryTimelineBlock;
  singleDay?: boolean;
}) {
  const [showAll, setShowAll] = useState(false);
  const days = singleDay ? block.days.slice(0, 1) : block.days;
  const visibleDays = singleDay
    ? days
    : showAll
      ? block.days
      : block.days.slice(0, TIMELINE_COLLAPSE_AFTER_DAY);
  const hiddenCount = singleDay ? 0 : block.days.length - visibleDays.length;

  return (
    <div className="mt-3 space-y-3">
      <p className="text-sm font-semibold text-[#1C1B19]">
        {singleDay ? "What a day could look like" : `Itinerary near ${block.hotelName}`}
      </p>
      {visibleDays.map((day) => (
        <div
          key={day.day}
          className="overflow-hidden rounded-2xl border border-[#E7E5E0] bg-white"
        >
          <p className="border-b border-[#E7E5E0] bg-[#F2F1EE] px-4 py-2 text-sm font-semibold text-[#1C1B19]">
            {day.label}
          </p>
          <ul className="divide-y divide-[#E7E5E0]">
            {day.stops.map((stop) => (
              <li key={`${stop.pin ?? "unknown"}-${stop.name}`} className="px-4 py-3">
                <a
                  href={stop.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3"
                  aria-label={`Open ${stop.name} in Google Maps`}
                >
                  {stop.pin !== null && (
                    <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#C8811A] text-[11px] font-bold text-white">
                      {stop.pin}
                    </span>
                  )}
                  {stop.photoUrl ? (
                    <span className="relative block h-14 w-20 shrink-0 overflow-hidden rounded-xl bg-[#F2F1EE]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={stop.photoUrl}
                        alt={`${stop.name} photo`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      {stop.photoSourceName && (
                        <span className="absolute bottom-0.5 right-1 text-[9px] text-white drop-shadow">
                          Photo: {stop.photoSourceName}
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="flex h-14 w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-xl bg-[#F2F1EE]">
                      <span className="text-xl" aria-hidden="true">
                        📍
                      </span>
                      <span className="max-w-[90%] text-center text-[9px] leading-tight text-[#6B6862]">
                        {stop.photoFallback || "No photo found"}
                      </span>
                    </span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-[#1C1B19]">
                      {stop.name}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#6B6862]">
                      {stop.time} · suggested
                      {stop.category ? ` · ${stop.category}` : ""}
                    </span>
                    <span className="mt-0.5 block text-xs text-[#6B6862]">
                      {stop.distanceLine ?? "location unknown"}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      ))}
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="w-full rounded-full border border-[#E7E5E0] bg-white px-4 py-2 text-sm font-semibold text-[#8A5710] hover:bg-[#F2F1EE]"
        >
          {TIMELINE_SHOW_ALL_LABEL} ({hiddenCount} more{" "}
          {hiddenCount === 1 ? "day" : "days"})
        </button>
      )}
      <p className="text-[11px] text-[#9A968F]">
        Times are suggestions. Distances are straight line, walk times assume
        5 km/h. Tap a stop to open it in Google Maps.
      </p>
    </div>
  );
}
