"use client";

import type { NearbyRowBlock } from "@/lib/chat/rich-message";

/**
 * Near your hotel row: places within 800 m of the hotel, each with a
 * photo, a name, a rating when one exists, a walk time, and a category
 * badge. A tap opens Google Maps. A place with no photo shows the
 * fallback icon, never a generated image. The heading defaults to
 * "Near {hotelName}" for standalone use; a destination preview passes
 * its section heading ("What's nearby") instead, and null hides the
 * heading when the caller renders it.
 */
export function NearbyRowView({
  block,
  heading,
}: {
  block: NearbyRowBlock;
  heading?: string | null;
}) {
  const resolvedHeading =
    heading === undefined ? `Near ${block.hotelName}` : heading;
  if (block.places.length === 0) {
    return (
      <div className="mt-3 rounded-2xl border border-[#E7E5E0] bg-white p-4">
        {resolvedHeading !== null && (
          <p className="text-sm font-semibold text-[#1C1B19]">{resolvedHeading}</p>
        )}
        <p className="mt-1 text-xs text-[#6B6862]">{block.emptyText}</p>
      </div>
    );
  }
  return (
    <div className="mt-3">
      {resolvedHeading !== null && (
        <p className="text-sm font-semibold text-[#1C1B19]">{resolvedHeading}</p>
      )}
      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        {block.places.map((place) => (
          <a
            key={place.name}
            href={place.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="overflow-hidden rounded-2xl border border-[#E7E5E0] bg-white transition-all hover:border-[#E7E5E0]"
            aria-label={`Open ${place.name} in Google Maps`}
          >
            {place.photoUrl ? (
              <div className="relative aspect-[5/3] w-full overflow-hidden bg-[#F2F1EE]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={place.photoUrl}
                  alt={`${place.name} photo`}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                {place.photoSourceName && (
                  <span className="absolute bottom-1.5 right-2 text-[10px] text-white drop-shadow">
                    Photo: {place.photoSourceName}
                  </span>
                )}
              </div>
            ) : (
              <div className="flex aspect-[5/3] w-full flex-col items-center justify-center gap-2 bg-[#F2F1EE]">
                <span className="text-3xl" aria-hidden="true">
                  📍
                </span>
                <span className="max-w-[80%] text-center text-xs text-[#6B6862]">
                  {place.photoFallback || "No photo found"}
                </span>
              </div>
            )}
            <div className="p-3">
              <p className="text-sm font-semibold text-[#1C1B19]">{place.name}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                <span className="rounded-full border border-[#E7E5E0] bg-[#F2F1EE] px-2 py-0.5 text-[11px] font-medium text-[#8A5710]">
                  {place.category}
                </span>
                {place.rating !== null && (
                  <span className="rounded-full border border-[#E7E5E0] bg-[#F2F1EE] px-2 py-0.5 text-[11px] font-medium text-[#8A5710]">
                    ★ {place.rating}
                  </span>
                )}
              </div>
              <p className="mt-1.5 text-xs text-[#6B6862]">{place.walkText}</p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
