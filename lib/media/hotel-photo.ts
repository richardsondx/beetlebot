/**
 * Hotel photo lookup for chat hotel cards.
 *
 * Ranking today, with no Google key in the working copy:
 * 1. Bousier tier 1, the hotel site og:image from the hotel source URL.
 * 2. Bousier tier 2, the Wikipedia summary image for the hotel name.
 * 3. Named fallback, no photo and a stated reason. No generated image,
 *    no stock filler, no placehold.co image.
 *
 * Google Places Photos is the design rank 1 for hotel photos, but it needs
 * a server-side API key and a spend limit. No key exists, so this module
 * makes no Google call. When Richardson supplies a key, add a Places step
 * ahead of Bousier here and record the key source in the run folder.
 */

import { resolveImageForEntity } from "@/lib/media/bousier";

export type HotelPhotoInput = {
  name: string;
  area?: string;
  sourceUrl?: string;
};

export type HotelPhotoResult = {
  photoUrl: string | null;
  photoSourceName: string | null;
  photoFallback: string;
};

/** Status of the Google Places Photos step, for the run log. */
export const HOTEL_PHOTO_GOOGLE_STATUS =
  "Queued: Google Places Photos needs a server-side API key and a spend limit from Richardson. No billable Google call is made.";

export async function resolveHotelPhoto(
  hotel: HotelPhotoInput,
): Promise<HotelPhotoResult> {
  const name = hotel.name.trim();
  if (!name) {
    return {
      photoUrl: null,
      photoSourceName: null,
      photoFallback: "No hotel photo found",
    };
  }
  const resolved = await resolveImageForEntity({
    title: name,
    actionUrl: hotel.sourceUrl,
  });
  if (resolved.selectedImageUrl) {
    return {
      photoUrl: resolved.selectedImageUrl,
      photoSourceName:
        resolved.selectedSourceName === "wikipedia_summary"
          ? "Wikipedia"
          : resolved.selectedSourceName === "canonical_metadata"
            ? "Hotel site"
            : (resolved.selectedSourceName ?? "Hotel site"),
      photoFallback: "",
    };
  }
  return {
    photoUrl: null,
    photoSourceName: null,
    photoFallback: "No hotel photo found",
  };
}
