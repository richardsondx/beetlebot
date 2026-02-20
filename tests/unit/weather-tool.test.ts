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
    });
  });
});
