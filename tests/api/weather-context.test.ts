import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../lib/db";
import { GET as getWeatherContextRoute } from "../../app/api/weather/context/route";

describe("GET /api/weather/context", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  beforeEach(async () => {
    await db.integrationConnection.upsert({
      where: { provider: "weather" },
      update: {
        status: "connected",
        configJson: JSON.stringify({
          weatherProvider: "open_meteo",
          defaultLocation: "Toronto",
          units: "metric",
        }),
      },
      create: {
        provider: "weather",
        kind: "context",
        status: "connected",
        displayName: "Weather",
        configJson: JSON.stringify({
          weatherProvider: "open_meteo",
          defaultLocation: "Toronto",
          units: "metric",
        }),
      },
    });
  });

  it("returns provider-backed weather context shape", async () => {
    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("geocoding-api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            results: [{ latitude: 52.52, longitude: 13.41, name: "Berlin", country: "Germany" }],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          current: {
            temperature_2m: 7.3,
            precipitation_probability: 66,
            weather_code: 61,
          },
          hourly: {
            time: ["2026-02-22T16:00:00Z", "2026-02-22T17:00:00Z", "2026-02-22T18:00:00Z"],
            temperature_2m: [8.2, 7.9, 7.4],
            precipitation_probability: [52, 71, 68],
            weather_code: [3, 61, 61],
          },
          daily: {
            time: ["2026-02-22", "2026-02-23", "2026-03-01"],
            temperature_2m_max: [8.5, 6.1, 7.2],
            temperature_2m_min: [2.4, 1.1, 0.7],
            precipitation_probability_max: [74, 36, 67],
            weather_code: [61, 3, 61],
          },
        }),
        { status: 200 },
      );
    });

    vi.stubGlobal("fetch", fetchMock);
    const response = await getWeatherContextRoute(
      new Request("http://localhost/api/weather/context?location=Berlin"),
    );
    const payload = (await response.json()) as {
      location: string;
      summary: string;
      tempC: number;
      rainProbability: number;
      recommendation: string;
      provider: string;
      connected: boolean;
      generatedAt: string;
      isFallback: boolean;
      hourly: Array<{ time: string; rainProbability: number; weatherCode: number }>;
      daily: Array<{ date: string; rainProbabilityMax: number }>;
      highRiskWindows: Array<{ start: string; end: string; peakRainProbability: number }>;
    };

    expect(response.status).toBe(200);
    expect(payload.location).toContain("Berlin");
    expect(payload.summary).toBe("Rain likely");
    expect(payload.tempC).toBe(7.3);
    expect(payload.rainProbability).toBe(0.66);
    expect(payload.recommendation.length).toBeGreaterThan(0);
    expect(payload.provider).toBe("open_meteo");
    expect(payload.connected).toBe(true);
    expect(typeof payload.generatedAt).toBe("string");
    expect(payload.isFallback).toBe(false);
    expect(payload.hourly.length).toBe(3);
    expect(payload.hourly[1]?.rainProbability).toBe(0.71);
    expect(payload.daily.length).toBe(3);
    expect(payload.daily[2]?.rainProbabilityMax).toBe(0.67);
    expect(payload.highRiskWindows.length).toBeGreaterThan(0);
  });
});
