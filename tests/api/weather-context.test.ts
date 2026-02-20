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
    };

    expect(response.status).toBe(200);
    expect(payload.location).toContain("Berlin");
    expect(payload.summary).toBe("Rain likely");
    expect(payload.tempC).toBe(7.3);
    expect(payload.rainProbability).toBe(0.66);
    expect(payload.recommendation.length).toBeGreaterThan(0);
    expect(payload.provider).toBe("open_meteo");
    expect(payload.connected).toBe(true);
  });
});
