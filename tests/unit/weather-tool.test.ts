import { describe, expect, it, vi } from "vitest";

vi.mock("../../lib/weather/service", () => ({
  getWeatherContext: vi.fn(async () => ({
    location: "Toronto",
    summary: "Partly cloudy",
    tempC: 9.2,
    rainProbability: 0.12,
    recommendation: "Outdoor plans look reasonable with a light backup option.",
    provider: "open_meteo",
    connected: true,
    generatedAt: "2026-02-22T12:00:00.000Z",
    isFallback: false,
    hourly: [
      {
        time: "2026-02-22T17:00:00.000Z",
        tempC: 8.1,
        rainProbability: 0.72,
        weatherCode: 61,
        summary: "Rain likely",
      },
    ],
    daily: [
      {
        date: "2026-03-01",
        tempMaxC: 7.5,
        tempMinC: 1.1,
        rainProbabilityMax: 0.64,
        weatherCode: 61,
        summary: "Rain likely",
      },
    ],
    highRiskWindows: [
      {
        start: "2026-02-22T17:00:00.000Z",
        end: "2026-02-22T19:00:00.000Z",
        peakRainProbability: 0.74,
      },
    ],
  })),
}));
vi.mock("../../lib/integrations/scope-guard", () => ({
  assertIntegrationScope: vi.fn(async () => undefined),
}));

import { weatherContextTool } from "../../lib/tools/weather";
import { getWeatherContext } from "../../lib/weather/service";

describe("weatherContextTool", () => {
  it("forwards input args and returns weather context payload", async () => {
    const result = await weatherContextTool.execute({ location: "Toronto" });

    expect(getWeatherContext).toHaveBeenCalledWith({ location: "Toronto" });
    expect(result).toEqual({
      location: "Toronto",
      summary: "Partly cloudy",
      tempC: 9.2,
      rainProbability: 0.12,
      recommendation: "Outdoor plans look reasonable with a light backup option.",
      provider: "open_meteo",
      connected: true,
      generatedAt: "2026-02-22T12:00:00.000Z",
      isFallback: false,
      hourly: [
        {
          time: "2026-02-22T17:00:00.000Z",
          tempC: 8.1,
          rainProbability: 0.72,
          weatherCode: 61,
          summary: "Rain likely",
        },
      ],
      daily: [
        {
          date: "2026-03-01",
          tempMaxC: 7.5,
          tempMinC: 1.1,
          rainProbabilityMax: 0.64,
          weatherCode: 61,
          summary: "Rain likely",
        },
      ],
      highRiskWindows: [
        {
          start: "2026-02-22T17:00:00.000Z",
          end: "2026-02-22T19:00:00.000Z",
          peakRainProbability: 0.74,
        },
      ],
    });
  });
});
