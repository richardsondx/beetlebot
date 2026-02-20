import { db } from "@/lib/db";

export type WeatherContextInput = {
  location?: string;
};

export type WeatherContext = {
  location: string;
  summary: string;
  tempC: number;
  rainProbability: number;
  recommendation: string;
  provider: string;
  connected: boolean;
};

type WeatherConfig = Record<string, string>;

function parseConfig(configJson?: string | null): WeatherConfig {
  if (!configJson) return {};
  try {
    return JSON.parse(configJson) as WeatherConfig;
  } catch {
    return {};
  }
}

function clampProbability(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function weatherSummaryFromCode(code: number) {
  if (code === 0) return "Clear sky";
  if ([1, 2].includes(code)) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if ([45, 48].includes(code)) return "Foggy";
  if ([51, 53, 55, 56, 57].includes(code)) return "Light drizzle";
  if ([61, 63, 65, 66, 67].includes(code)) return "Rain likely";
  if ([71, 73, 75, 77].includes(code)) return "Snow possible";
  if ([80, 81, 82].includes(code)) return "Showers likely";
  if ([95, 96, 99].includes(code)) return "Thunderstorms possible";
  return "Mixed conditions";
}

function buildRecommendation(input: { tempC: number; rainProbability: number }) {
  if (input.rainProbability >= 0.65) {
    return "Prefer indoor activities and keep commute windows flexible.";
  }
  if (input.tempC <= 0) {
    return "Layer up and favor shorter outdoor transitions.";
  }
  if (input.tempC >= 30) {
    return "Prioritize indoor cooling breaks and hydration.";
  }
  return "Outdoor plans look reasonable with a light backup option.";
}

async function geocodeLocation(name: string) {
  const trimmed = name.trim();
  const latLonMatch = trimmed.match(
    /^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/,
  );
  if (latLonMatch) {
    return {
      latitude: Number(latLonMatch[1]),
      longitude: Number(latLonMatch[2]),
      label: `${Number(latLonMatch[1]).toFixed(4)}, ${Number(latLonMatch[2]).toFixed(4)}`,
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
  if (!response.ok || !first || typeof first.latitude !== "number" || typeof first.longitude !== "number") {
    throw new Error("Unable to resolve location.");
  }
  return {
    latitude: first.latitude,
    longitude: first.longitude,
    label: [first.name, first.country].filter(Boolean).join(", "),
  };
}

async function fetchOpenMeteoForecast(params: { latitude: number; longitude: number }) {
  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?${new URLSearchParams({
      latitude: String(params.latitude),
      longitude: String(params.longitude),
      current: "temperature_2m,precipitation_probability,weather_code",
      temperature_unit: "celsius",
      timezone: "auto",
    }).toString()}`,
  );
  const payload = (await response.json().catch(() => ({}))) as {
    current?: { temperature_2m?: number; precipitation_probability?: number; weather_code?: number };
  };
  if (!response.ok || !payload.current) {
    throw new Error("Weather provider request failed.");
  }
  return payload.current;
}

export async function getWeatherContext(input: WeatherContextInput = {}): Promise<WeatherContext> {
  const connection = await db.integrationConnection.findUnique({
    where: { provider: "weather" },
  });
  const config = parseConfig(connection?.configJson);
  const connected = connection?.status === "connected";

  const defaultLocation = config.defaultLocation || "Toronto";
  const locationInput = input.location?.trim() || defaultLocation;

  try {
    const coords = await geocodeLocation(locationInput);
    const current = await fetchOpenMeteoForecast(coords);
    const tempC = Number(current.temperature_2m ?? 0);
    const rainProbability = clampProbability(Number(current.precipitation_probability ?? 0) / 100);
    const summary = weatherSummaryFromCode(Number(current.weather_code ?? -1));

    return {
      location: coords.label || locationInput,
      summary,
      tempC: Number.isFinite(tempC) ? Number(tempC.toFixed(1)) : 0,
      rainProbability: Number(rainProbability.toFixed(2)),
      recommendation: buildRecommendation({ tempC, rainProbability }),
      provider: config.weatherProvider || "open_meteo",
      connected,
    };
  } catch {
    const tempC = 18;
    const rainProbability = 0.2;
    return {
      location: locationInput,
      summary: "Weather service unavailable right now",
      tempC,
      rainProbability,
      recommendation:
        "Use an indoor-friendly fallback and retry weather checks shortly before departure.",
      provider: config.weatherProvider || "open_meteo",
      connected,
    };
  }
}
