"use client";

import type { MapStripBlock } from "@/lib/chat/rich-message";

/**
 * Map strip: one static map image per trip, hotel pin plus numbered stops.
 * No pan or zoom, no routing, no live traffic, no turn-by-turn. A tap
 * opens Google Maps. When no Google key exists the image is replaced by
 * the named fallback, and the stop rows still show.
 */
export function MapStripView({ block }: { block: MapStripBlock }) {
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[#E7E5E0] bg-white">
      {block.staticMapsUrl ? (
        <a
          href={block.hotelMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Open map near ${block.hotelName} in Google Maps`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.staticMapsUrl}
            alt={`Map near ${block.hotelName}, hotel marked H with numbered day stops`}
            className="aspect-[2/1] w-full object-cover"
            loading="lazy"
          />
        </a>
      ) : (
        <div className="flex aspect-[2/1] w-full flex-col items-center justify-center gap-2 bg-[#F2F1EE] px-4">
          <span className="text-3xl" aria-hidden="true">
            🗺️
          </span>
          <p className="max-w-[90%] text-center text-xs text-[#6B6862]">
            {block.mapFallback || "Map image not available yet"}
          </p>
          <a
            href={block.hotelMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-[#8A5710] underline-offset-2 hover:underline"
          >
            Open {block.hotelName} in Google Maps
          </a>
        </div>
      )}
      <div className="p-4">
        <p className="text-sm font-semibold text-[#1C1B19]">
          Map near {block.hotelName}
        </p>
        <ul className="mt-2 space-y-1.5">
          {block.stops.map((stop) => (
            <li key={`${stop.pin ?? "unknown"}-${stop.name}`} className="text-xs text-[#6B6862]">
              <a
                href={stop.mapsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[#1C1B19] hover:underline underline-offset-2"
              >
                {stop.pin !== null ? (
                  <>
                    <span className="mr-1.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#C8811A] text-[10px] font-bold text-white">
                      {stop.pin}
                    </span>
                    {stop.name} · {stop.distanceText} · {stop.walkText}
                  </>
                ) : (
                  <>
                    {stop.name} · location unknown
                  </>
                )}
              </a>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-[11px] text-[#9A968F]">
          Distances are straight line, walk times assume 5 km/h. Tap a stop to
          open it in Google Maps.
        </p>
      </div>
    </div>
  );
}
