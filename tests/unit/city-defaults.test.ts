import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../lib/db";
import { getWeatherContext } from "../../lib/weather/service";
import { geocodeMapsLocation } from "../../lib/maps/service";
import { searchRestaurants } from "../../lib/opentable/service";

describe("city memory fallback defaults", () => {
  beforeEach(async () => {
    vi.unstubAllGlobals();
    await db.memoryEntry.deleteMany({
      where: { key: { in: ["city", "location", "home_city"] } },
    });
    await db.integrationConnection.upsert({
      where: { provider: "weather" },
      update: {
        status: "connected",
        configJson: JSON.stringify({ weatherProvider: "open_meteo" }),
      },
      create: {
        provider: "weather",
        kind: "context",
        displayName: "Weather",
        status: "connected",
        configJson: JSON.stringify({ weatherProvider: "open_meteo" }),
      },
    });
    await db.integrationConnection.upsert({
      where: { provider: "maps" },
      update: {
        status: "connected",
        configJson: JSON.stringify({ mapsProvider: "approx" }),
      },
      create: {
        provider: "maps",
        kind: "context",
        displayName: "Maps",
        status: "connected",
        configJson: JSON.stringify({ mapsProvider: "approx" }),
      },
    });
    await db.integrationConnection.upsert({
      where: { provider: "opentable" },
      update: {
        status: "connected",
        configJson: JSON.stringify({ defaultPartySize: 2 }),
      },
      create: {
        provider: "opentable",
        kind: "reservation",
        displayName: "OpenTable",
        status: "connected",
        configJson: JSON.stringify({ defaultPartySize: 2 }),
      },
    });
  });

  it("uses city from memory as weather default location", async () => {
    await db.memoryEntry.create({
      data: {
        bucket: "profile_memory",
        key: "city",
        value: "Vancouver",
        source: "user_input",
        confidence: 1,
      },
    });

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.includes("geocoding-api.open-meteo.com")) {
        expect(url.toLowerCase()).toContain("vancouver");
        return new Response(
          JSON.stringify({
            results: [{ latitude: 49.28, longitude: -123.12, name: "Vancouver", country: "Canada" }],
          }),
          { status: 200 },
        );
      }
      return new Response(
        JSON.stringify({
          current: {
            temperature_2m: 6.1,
            precipitation_probability: 22,
            weather_code: 3,
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await getWeatherContext();
    expect(result.location.toLowerCase()).toContain("vancouver");
  });

  it("uses city from memory as maps default origin", async () => {
    await db.memoryEntry.create({
      data: {
        bucket: "profile_memory",
        key: "city",
        value: "Montreal",
        source: "user_input",
        confidence: 1,
      },
    });

    const fetchMock = vi.fn(async (input: string | URL) => {
      const url = String(input).toLowerCase();
      expect(url).toContain("montreal");
      return new Response(
        JSON.stringify({
          results: [{ latitude: 45.5, longitude: -73.56, name: "Montreal", country: "Canada" }],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const geo = await geocodeMapsLocation({});
    expect(geo.label.toLowerCase()).toContain("montreal");
  });

  it("uses city from memory for opentable search when city is omitted", async () => {
    await db.memoryEntry.create({
      data: {
        bucket: "profile_memory",
        key: "city",
        value: "Calgary",
        source: "user_input",
        confidence: 1,
      },
    });

    const result = await searchRestaurants({ query: "sushi" });
    expect(result.city).toBe("Calgary");
    expect(result.searchUrl.toLowerCase()).toContain("calgary");
  });
});
