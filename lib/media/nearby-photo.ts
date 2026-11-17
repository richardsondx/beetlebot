/**
 * Nearby place photo lookup.
 *
 * Ranking today, with no Google key in the working copy:
 * 1. Bousier tier 1, the place page og:image from the place source URL.
 * 2. Bousier tier 2, the Wikipedia summary image for the place name.
 * 3. Named fallback, no photo. No generated image, no stock filler,
 *    no placehold.co image.
 *
 * Google Places Photos is the design rank 1 for nearby photos, but it
 * needs a server-side API key and a spend limit. No key exists, so this
 * module makes no Google call. When Richardson supplies a key, add a
 * Places step ahead of Bousier here and record the key source in the
 * run folder.
 */

import { resolveImageForEntity } from "@/lib/media/bousier";

export type NearbyPhotoInput = {
  name: string;
  sourceUrl?: string;
};

export type NearbyPhotoResult = {
  photoUrl: string | null;
  photoSourceName: string | null;
  photoFallback: string;
};

/** Status of the Google Places Photos step, for the run log. */
export const NEARBY_PHOTO_GOOGLE_STATUS =
  "Queued: Google Places Photos needs a server-side API key and a spend limit from Richardson. No billable Google call is made.";

export async function resolveNearbyPhoto(
  place: NearbyPhotoInput,
): Promise<NearbyPhotoResult> {
  const name = place.name.trim();
  if (!name) {
    return {
      photoUrl: null,
      photoSourceName: null,
      photoFallback: "No photo found",
    };
  }
  const resolved = await resolveImageForEntity({
    title: name,
    actionUrl: place.sourceUrl,
  });
  if (resolved.selectedImageUrl) {
    return {
      photoUrl: resolved.selectedImageUrl,
      photoSourceName:
        resolved.selectedSourceName === "wikipedia_summary"
          ? "Wikipedia"
          : resolved.selectedSourceName === "canonical_metadata"
            ? "Place site"
            : (resolved.selectedSourceName ?? "Place site"),
      photoFallback: "",
    };
  }
  return {
    photoUrl: null,
    photoSourceName: null,
    photoFallback: "No photo found",
  };
}
