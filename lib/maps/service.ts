import { db } from "@/lib/db";
import { decryptConnection } from "@/lib/repositories/integration-crypto";

export type MapsTravelMode = "driving" | "walking" | "cycling" | "transit";

export type MapsGeocodeResult = {
  input: string;
  label: string;
  latitude: number;
  longitude: number;
  provider: "open_meteo";
};

export type MapsRouteResult = {
  origin: { input: string; label: string; latitude: number; longitude: number };
  destination: { input: string; label: string; latitude: number; longitude: number };
  mode: MapsTravelMode;
  distanceKm: number;
  durationMinutes: number;
  provider: "approx" | "openrouteservice";
  confidence: number; // 0..1
  deepLink: string;
  connected: boolean;
  notes?: string;
};

type MapsConfig = Record<string, string>;

function parseConfig(configJson?: string | null): MapsConfig {
  if (!configJson) return {};
  try {
    return JSON.parse(configJson) as MapsConfig;
  } catch {
    return {};
  }
}

function clamp(n: number, min: number, max: number) {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

function parseLatLon(input: string) {
  const trimmed = input.trim();
  const match = trimmed.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (!match) return null;
  const latitude = Number(match[1]);
  const longitude = Number(match[2]);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude, label: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}` };
}

async function openMeteoGeocode(name: string): Promise<MapsGeocodeResult> {
  const trimmed = name.trim();
  const latLon = parseLatLon(trimmed);
  if (latLon) {
    return {
      input: trimmed,
      label: latLon.label,
      latitude: latLon.latitude,
      longitude: latLon.longitude,
      provider: "open_meteo",
    };
  }

  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({
      name: trimmed,
      count: "1",
      language: "en",
      format: "json",
    }).toString()}`,
  );
  const payload = (await response.json().catch(() => ({}))) as {
    results?: Array<{ latitude?: number; longitude?: number; name?: string; country?: string }>;
  };
  const first = payload.results?.[0];
  if (
    !response.ok ||
    !first ||
    typeof first.latitude !== "number" ||
    typeof first.longitude !== "number"
  ) {
    throw new Error("Unable to resolve location.");
  }
  return {
    input: trimmed,
    label: [first.name, first.country].filter(Boolean).join(", ") || trimmed,
    latitude: first.latitude,
    longitude: first.longitude,
    provider: "open_meteo",
  };
}

export async function geocodeMapsLocation(input: { location?: string }) {
  const rawConnection = await db.integrationConnection.findUnique({
    where: { provider: "maps" },
  });
  const connection = rawConnection ? decryptConnection(rawConnection) : null;
  const config = parseConfig(connection?.configJson);
  const connected = connection?.status === "connected";

  const locationInput =
    input.location?.trim() || config.defaultLocation || config.locationLabel || "Toronto";

  const result = await openMeteoGeocode(locationInput);
  return { ...result, connected };
}

function haversineKm(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }) {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const x =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  return R * c;
}

function approxDurationMinutes(distanceKm: number, mode: MapsTravelMode) {
  const speedKmh =
    mode === "walking"
      ? 4.8
      : mode === "cycling"
        ? 15
        : mode === "transit"
          ? 22
          : 45;
  const base = (distanceKm / speedKmh) * 60;
  const overhead =
    mode === "driving"
      ? 6
      : mode === "transit"
        ? 10
        : mode === "walking"
          ? 2
          : 3;
  return clamp(Math.round(base + overhead), 2, 24 * 60);
}

function toGoogleTravelMode(mode: MapsTravelMode) {
  if (mode === "cycling") return "bicycling";
  return mode;
}

function buildGoogleDirectionsLink(input: { origin: string; destination: string; mode: MapsTravelMode }) {
  return `https://www.google.com/maps/dir/?api=1&${new URLSearchParams({
    origin: input.origin,
    destination: input.destination,
    travelmode: toGoogleTravelMode(input.mode),
  }).toString()}`;
}

async function fetchOpenRouteServiceRoute(params: {
  apiKey: string;
  mode: MapsTravelMode;
  origin: { latitude: number; longitude: number };
  destination: { latitude: number; longitude: number };
}) {
  const profile =
    params.mode === "walking"
      ? "foot-walking"
      : params.mode === "cycling"
        ? "cycling-regular"
        : "driving-car";

  const response = await fetch(
    `https://api.openrouteservice.org/v2/directions/${profile}?${new URLSearchParams({
      start: `${params.origin.longitude},${params.origin.latitude}`,
      end: `${params.destination.longitude},${params.destination.latitude}`,
    }).toString()}`,
    { headers: { Authorization: params.apiKey } },
  );
  const payload = (await response.json().catch(() => ({}))) as {
    features?: Array<{ properties?: { summary?: { distance?: number; duration?: number } } }>;
    error?: unknown;
    message?: unknown;
  };
  if (!response.ok) {
    const msg =
      typeof payload.message === "string"
        ? payload.message
        : "OpenRouteService request failed.";
    throw new Error(msg);
  }

  const summary = payload.features?.[0]?.properties?.summary;
  const distanceM = Number(summary?.distance ?? NaN);
  const durationS = Number(summary?.duration ?? NaN);
  if (!Number.isFinite(distanceM) || !Number.isFinite(durationS)) {
    throw new Error("OpenRouteService response missing route summary.");
  }

  return {
    distanceKm: distanceM / 1000,
    durationMinutes: durationS / 60,
  };
}

export async function getMapsRoute(input: {
  origin?: string;
  destination: string;
  mode?: MapsTravelMode;
}): Promise<MapsRouteResult> {
  const rawConnection = await db.integrationConnection.findUnique({
    where: { provider: "maps" },
  });
  const connection = rawConnection ? decryptConnection(rawConnection) : null;
  const config = parseConfig(connection?.configJson);
  const connected = connection?.status === "connected";

  const mode: MapsTravelMode = input.mode ?? "driving";

  const originInput =
    input.origin?.trim() || config.defaultLocation || config.locationLabel || "Toronto";
  const destinationInput = input.destination.trim();

  const origin = await openMeteoGeocode(originInput);
  const destination = await openMeteoGeocode(destinationInput);

  const deepLink = buildGoogleDirectionsLink({
    origin: origin.input,
    destination: destination.input,
    mode,
  });

  const mapsProvider = config.mapsProvider === "openrouteservice" ? "openrouteservice" : "approx";

  if (mapsProvider === "openrouteservice" && mode !== "transit") {
    const apiKey = (connection?.accessToken ?? "").trim();
    if (apiKey) {
      const ors = await fetchOpenRouteServiceRoute({
        apiKey,
        mode,
        origin,
        destination,
      });
      return {
        origin,
        destination,
        mode,
        distanceKm: Number(ors.distanceKm.toFixed(2)),
        durationMinutes: Math.round(ors.durationMinutes),
        provider: "openrouteservice",
        confidence: 0.9,
        deepLink,
        connected,
      };
    }
  }

  const distanceKm = haversineKm(origin, destination);
  const durationMinutes = approxDurationMinutes(distanceKm, mode);
  const notes =
    mode === "transit" && mapsProvider === "openrouteservice"
      ? "OpenRouteService does not support transit routing; using approximate estimate."
      : undefined;

  return {
    origin,
    destination,
    mode,
    distanceKm: Number(distanceKm.toFixed(2)),
    durationMinutes,
    provider: "approx",
    confidence: 0.6,
    deepLink,
    connected,
    ...(notes ? { notes } : {}),
  };
}

