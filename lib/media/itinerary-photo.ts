/**
 * Itinerary stop photo lookup.
 *
 * Ranking, with no Google key in the working copy (see kit/photo-source-map.md):
 * 1. Google Places Photos. Status: queued, needs a server-side API key
 *    and a spend limit from Richardson. No billable Google call is made.
 * 2. Wikipedia tier 2 for landmarks, via Bousier.
 * 3. Bousier tier 1, the stop page og:image from the stop source URL.
 * 4. Named fallback, no photo. The stop then renders as a compact text
 *    row, never a generated image, never stock filler, never placehold.co.
 */

import { resolveImageForEntity } from "@/lib/media/bousier";

export type ItineraryPhotoInput = {
  name: string;
  sourceUrl?: string;
};

export type ItineraryPhotoResult = {
  photoUrl: string | null;
  photoSourceName: string | null;
  photoFallback: string;
};

/** Status of the Google Places Photos step, for the run log. */
export const ITINERARY_PHOTO_GOOGLE_STATUS =
  "Queued: Google Places Photos needs a server-side API key and a spend limit from Richardson. No billable Google call is made.";

export async function resolveItineraryStopPhoto(
  stop: ItineraryPhotoInput,
): Promise<ItineraryPhotoResult> {
  const name = stop.name.trim();
  if (!name) {
    return {
      photoUrl: null,
      photoSourceName: null,
      photoFallback: "No photo found",
    };
  }
  const resolved = await resolveImageForEntity({
    title: name,
    actionUrl: stop.sourceUrl,
  });
  if (resolved.selectedImageUrl) {
    return {
      photoUrl: resolved.selectedImageUrl,
      photoSourceName:
        resolved.selectedSourceName === "wikipedia_summary"
          ? "Wikipedia"
          : resolved.selectedSourceName === "canonical_metadata"
            ? "Stop site"
            : (resolved.selectedSourceName ?? "Stop site"),
      photoFallback: "",
    };
  }
  return {
    photoUrl: null,
    photoSourceName: null,
    photoFallback: "No photo found",
  };
}
