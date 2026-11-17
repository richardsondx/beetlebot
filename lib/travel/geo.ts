/**
 * Shared travel geography helpers.
 *
 * Distances are straight-line (haversine) and walk times assume 5 km/h,
 * always shown with "~". No routing is used anywhere in the travel flow.
 */

export type LatLng = { lat: number; lng: number };

/** Walk speed used for every "~N min walk" label. */
export const WALK_SPEED_KMH = 5;

/** Earth radius in km, for haversine. */
const EARTH_RADIUS_KM = 6371;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Straight-line distance in km between two points. */
export function haversineKm(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s1 = Math.sin(dLat / 2) ** 2;
  const s2 = Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(s1 + s2));
}

/** Walk minutes at 5 km/h for a straight-line distance. */
export function walkMinutesForKm(km: number): number {
  return Math.max(1, Math.round((km / WALK_SPEED_KMH) * 60));
}

/** "0.8 km" with one decimal. */
export function formatDistanceKm(km: number): string {
  return `${km.toFixed(1)} km`;
}

/** "~10 min walk" for a straight-line distance. */
export function formatWalkTime(km: number): string {
  return `~${walkMinutesForKm(km)} min walk`;
}

/** Google Maps search link for a lat/lng point. */
export function googleMapsPointUrl(point: LatLng): string {
  return `https://www.google.com/maps/search/?api=1&query=${point.lat},${point.lng}`;
}

/** Google Maps text search link for a place name, used when no coords exist. */
export function googleMapsTextSearchUrl(name: string): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(name)}`;
}
