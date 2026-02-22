import { db } from "@/lib/db";
import { decryptConnection } from "@/lib/repositories/integration-crypto";
import { getPreferredCityFromMemory } from "@/lib/repositories/memory";

export type WeatherContextInput = {
  location?: string;
};

export type WeatherHourlyPoint = {
  time: string;
  tempC: number;
  rainProbability: number;
  weatherCode: number;
  summary: string;
};

export type WeatherDailyPoint = {
  date: string;
  tempMaxC: number;
  tempMinC: number;
  rainProbabilityMax: number;
  weatherCode: number;
  summary: string;
};

export type WeatherRiskWindow = {
  start: string;
  end: string;
  peakRainProbability: number;
};

export type WeatherContext = {
  location: string;
  summary: string;
  tempC: number | null;
  rainProbability: number | null;
  recommendation: string;
  provider: string;
  connected: boolean;
  generatedAt: string;
  isFallback: boolean;
  hourly: WeatherHourlyPoint[];
  daily: WeatherDailyPoint[];
  highRiskWindows: WeatherRiskWindow[];
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

export function weatherSummaryFromCode(code: number) {
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

function toFiniteNumber(value: unknown, fallback = 0) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function buildRecommendation(input: {
  tempC: number;
  rainProbability: number;
  hasHighRiskWindow: boolean;
}) {
  if (input.rainProbability >= 0.65) {
    return "Prefer indoor activities and keep commute windows flexible.";
  }
  if (input.hasHighRiskWindow) {
    return "Conditions may shift later; keep an indoor backup for higher-rain windows.";
  }
  if (input.tempC <= 0) {
    return "Layer up and favor shorter outdoor transitions.";
  }
  if (input.tempC >= 30) {
    return "Prioritize indoor cooling breaks and hydration.";
  }
  return "Outdoor plans look reasonable with a light backup option.";
}

function normalizeHourlyTimeline(payload: {
  time?: unknown;
  temperature_2m?: unknown;
  precipitation_probability?: unknown;
  weather_code?: unknown;
}): WeatherHourlyPoint[] {
  const times = Array.isArray(payload.time) ? payload.time : [];
  const temps = Array.isArray(payload.temperature_2m) ? payload.temperature_2m : [];
  const rain = Array.isArray(payload.precipitation_probability) ? payload.precipitation_probability : [];
  const codes = Array.isArray(payload.weather_code) ? payload.weather_code : [];

  const count = Math.min(times.length, temps.length, rain.length, codes.length);
  const out: WeatherHourlyPoint[] = [];
  for (let i = 0; i < count; i += 1) {
    const weatherCode = Math.round(toFiniteNumber(codes[i], -1));
    const rainProbability = clampProbability(toFiniteNumber(rain[i], 0) / 100);
    const tempC = Number(toFiniteNumber(temps[i], 0).toFixed(1));
    const time = typeof times[i] === "string" ? times[i] : "";
    if (!time) continue;
    out.push({
      time,
      tempC,
      rainProbability: Number(rainProbability.toFixed(2)),
      weatherCode,
      summary: weatherSummaryFromCode(weatherCode),
    });
  }
  return out;
}

function normalizeDailyTimeline(payload: {
  time?: unknown;
  temperature_2m_max?: unknown;
  temperature_2m_min?: unknown;
  precipitation_probability_max?: unknown;
  weather_code?: unknown;
}): WeatherDailyPoint[] {
  const dates = Array.isArray(payload.time) ? payload.time : [];
  const maxTemps = Array.isArray(payload.temperature_2m_max) ? payload.temperature_2m_max : [];
  const minTemps = Array.isArray(payload.temperature_2m_min) ? payload.temperature_2m_min : [];
  const rain = Array.isArray(payload.precipitation_probability_max) ? payload.precipitation_probability_max : [];
  const codes = Array.isArray(payload.weather_code) ? payload.weather_code : [];
  const count = Math.min(dates.length, maxTemps.length, minTemps.length, rain.length, codes.length);
  const out: WeatherDailyPoint[] = [];

  for (let i = 0; i < count; i += 1) {
    const date = typeof dates[i] === "string" ? dates[i] : "";
    if (!date) continue;
    const weatherCode = Math.round(toFiniteNumber(codes[i], -1));
    const rainProbabilityMax = clampProbability(toFiniteNumber(rain[i], 0) / 100);
    out.push({
      date,
      tempMaxC: Number(toFiniteNumber(maxTemps[i], 0).toFixed(1)),
      tempMinC: Number(toFiniteNumber(minTemps[i], 0).toFixed(1)),
      rainProbabilityMax: Number(rainProbabilityMax.toFixed(2)),
      weatherCode,
      summary: weatherSummaryFromCode(weatherCode),
    });
  }
  return out;
}

function buildHighRiskWindows(hourly: WeatherHourlyPoint[]): WeatherRiskWindow[] {
  const threshold = 0.6;
  const windows: WeatherRiskWindow[] = [];
  let current: WeatherRiskWindow | null = null;

  for (const point of hourly) {
    if (point.rainProbability >= threshold) {
      if (!current) {
        current = {
          start: point.time,
          end: point.time,
          peakRainProbability: point.rainProbability,
        };
      } else {
        current.end = point.time;
        current.peakRainProbability = Math.max(current.peakRainProbability, point.rainProbability);
      }
      continue;
    }
    if (current) {
      windows.push({
        ...current,
        peakRainProbability: Number(current.peakRainProbability.toFixed(2)),
      });
      current = null;
    }
  }
  if (current) {
    windows.push({
      ...current,
      peakRainProbability: Number(current.peakRainProbability.toFixed(2)),
    });
  }
  return windows.slice(0, 4);
}

export function selectNearestHourlyWeather(
  hourly: WeatherHourlyPoint[],
  targetIso: string,
): WeatherHourlyPoint | null {
  const targetMs = Date.parse(targetIso);
  if (!Number.isFinite(targetMs) || !hourly.length) return null;
  let best: WeatherHourlyPoint | null = null;
  let bestDelta = Number.POSITIVE_INFINITY;
  for (const point of hourly) {
    const pointMs = Date.parse(point.time);
    if (!Number.isFinite(pointMs)) continue;
    const delta = Math.abs(pointMs - targetMs);
    if (delta < bestDelta) {
      bestDelta = delta;
      best = point;
    }
  }
  return best;
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
      hourly: "temperature_2m,precipitation_probability,weather_code",
      forecast_hours: "48",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      forecast_days: "10",
      temperature_unit: "celsius",
      timezone: "auto",
    }).toString()}`,
  );
  const payload = (await response.json().catch(() => ({}))) as {
    current?: { temperature_2m?: number; precipitation_probability?: number; weather_code?: number };
    hourly?: {
      time?: string[];
      temperature_2m?: number[];
      precipitation_probability?: number[];
      weather_code?: number[];
    };
    daily?: {
      time?: string[];
      temperature_2m_max?: number[];
      temperature_2m_min?: number[];
      precipitation_probability_max?: number[];
      weather_code?: number[];
    };
  };
  if (!response.ok || !payload.current) {
    throw new Error("Weather provider request failed.");
  }
  return payload;
}

async function withRetry<T>(fn: () => Promise<T>, attempts = 2): Promise<T> {
  let lastError: unknown = null;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Unknown weather provider error");
}

export async function getWeatherContext(input: WeatherContextInput = {}): Promise<WeatherContext> {
  const rawConnection = await db.integrationConnection.findUnique({
    where: { provider: "weather" },
  });
  const connection = rawConnection ? decryptConnection(rawConnection) : null;
  const config = parseConfig(connection?.configJson);
  const connected = connection?.status === "connected";
  const cityFromMemory = await getPreferredCityFromMemory();

  const defaultLocation = config.defaultLocation || cityFromMemory || "Toronto";
  const locationInput = input.location?.trim() || defaultLocation;
  const generatedAt = new Date().toISOString();

  try {
    const coords = await withRetry(() => geocodeLocation(locationInput));
    const forecast = await withRetry(() => fetchOpenMeteoForecast(coords));
    const current = forecast.current;
    const tempC = Number(current.temperature_2m ?? 0);
    const rainProbability = clampProbability(Number(current.precipitation_probability ?? 0) / 100);
    const summary = weatherSummaryFromCode(Number(current.weather_code ?? -1));
    const hourly = normalizeHourlyTimeline(forecast.hourly ?? {});
    const daily = normalizeDailyTimeline(forecast.daily ?? {});
    const highRiskWindows = buildHighRiskWindows(hourly);

    return {
      location: coords.label || locationInput,
      summary,
      tempC: Number.isFinite(tempC) ? Number(tempC.toFixed(1)) : 0,
      rainProbability: Number(rainProbability.toFixed(2)),
      recommendation: buildRecommendation({
        tempC,
        rainProbability,
        hasHighRiskWindow: highRiskWindows.length > 0,
      }),
      provider: config.weatherProvider || "open_meteo",
      connected,
      generatedAt,
      isFallback: false,
      hourly,
      daily,
      highRiskWindows,
    };
  } catch {
    return {
      location: locationInput,
      summary: "Weather service unavailable right now",
      tempC: null,
      rainProbability: null,
      recommendation:
        "Unable to fetch live weather right now. Retry shortly before confirming weather-sensitive plans.",
      provider: config.weatherProvider || "open_meteo",
      connected,
      generatedAt,
      isFallback: true,
      hourly: [],
      daily: [],
      highRiskWindows: [],
    };
  }
}
