import { describe, expect, it, vi } from "vitest";
import {
  buildBeachMapStrip,
  buildBeachNearbyRow,
  BEACH_COUNTRY,
  BEACH_DESTINATIONS,
} from "../../lib/travel/beach-compare";
import { buildMapStrip, MAP_STRIP_MAX_PINS, toMapStripBlock } from "../../lib/travel/map-strip";
import {
  buildNearbyRow,
  filterNearbyPlaces,
  NEARBY_CAP,
  NEARBY_EMPTY_TEXT,
  NEARBY_RADIUS_M,
  toNearbyRowBlock,
  type NearbyPlaceInput,
} from "../../lib/travel/nearby";
import {
  formatWalkTime,
  googleMapsPointUrl,
  googleMapsTextSearchUrl,
  haversineKm,
} from "../../lib/travel/geo";
import {
  isMapStripBlock,
  isNearbyRowBlock,
  toPlainText,
} from "../../lib/chat/rich-message";
import { sanitiseBlocks } from "../../lib/chat/safety";

vi.mock("../../lib/media/bousier", () => ({
  resolveImageForEntity: vi.fn(async () => ({
    selectedImageUrl: null,
    cached: false,
    imageCandidates: [],
    imageLastCheckedAt: "2026-11-17T00:00:00.000Z",
  })),
  resolveImageBatch: vi.fn(async () => []),
}));

const ALILA = { lat: -8.8456, lng: 115.1372 };

describe("haversine distance and walk time", () => {
  it("measures zero for the same point", () => {
    expect(haversineKm(ALILA, ALILA)).toBe(0);
    expect(formatWalkTime(0)).toBe("~1 min walk");
  });

  it("measures Uluwatu Temple about 6 km from Alila, always with ~", () => {
    const km = haversineKm(ALILA, { lat: -8.8192, lng: 115.0845 });
    expect(km).toBeGreaterThan(5);
    expect(km).toBeLessThan(8);
    expect(formatWalkTime(km)).toMatch(/^~\d+ min walk$/);
  });

  it("turns 0.8 km into ~10 min walk at 5 km/h", () => {
    expect(formatWalkTime(0.8)).toBe("~10 min walk");
  });
});

describe("map strip", () => {
  it("pins the hotel as H and numbers the stops", () => {
    const strip = buildMapStrip({
      hotelName: "Alila Villas Uluwatu",
      hotel: ALILA,
      stops: [
        { name: "Uluwatu Temple", lat: -8.8192, lng: 115.0845, day: 1 },
        { name: "Padang Padang Beach", lat: -8.8135, lng: 115.103, day: 2 },
      ],
    });
    expect(strip.hotelMapsUrl).toBe(googleMapsPointUrl(ALILA));
    expect(strip.stops).toHaveLength(2);
    expect(strip.stops[0].pin).toBe(1);
    expect(strip.stops[1].pin).toBe(2);
    expect(strip.stops[0].distanceText).toMatch(/^\d+\.\d km$/);
    expect(strip.stops[0].walkText).toMatch(/^~\d+ min walk$/);
    expect(strip.stops[0].mapsUrl).toContain("google.com/maps/search");
  });

  it("returns no static map URL without a key, with the named fallback", () => {
    const strip = buildMapStrip({
      hotelName: "Alila Villas Uluwatu",
      hotel: ALILA,
      stops: [{ name: "Uluwatu Temple", lat: -8.8192, lng: 115.0845 }],
    });
    expect(strip.staticMapsUrl).toBeNull();
    expect(strip.mapFallback).toContain("Google Static Maps needs a server-side API key");
  });

  it("caps numbered pins at 9", () => {
    const stops = Array.from({ length: 12 }, (_, i) => ({
      name: `Stop ${i + 1}`,
      lat: ALILA.lat + 0.001 * (i + 1),
      lng: ALILA.lng,
    }));
    const strip = buildMapStrip({ hotelName: "H", hotel: ALILA, stops });
    const pinned = strip.stops.filter((s) => s.pin !== null);
    expect(pinned).toHaveLength(MAP_STRIP_MAX_PINS);
    expect(pinned.map((s) => s.pin)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(strip.stops.slice(9).every((s) => s.pin === null)).toBe(true);
  });

  it("lists a stop with no coordinates as location unknown, no distance", () => {
    const strip = buildMapStrip({
      hotelName: "Alila Villas Uluwatu",
      hotel: ALILA,
      stops: [{ name: "Secret Beach" }],
    });
    expect(strip.stops[0].pin).toBeNull();
    expect(strip.stops[0].distanceText).toBeNull();
    expect(strip.stops[0].walkText).toBeNull();
    expect(strip.stops[0].mapsUrl).toBe(
      googleMapsTextSearchUrl("Secret Beach"),
    );
  });

  it("writes the plain text fallback in the Opus format", () => {
    const strip = buildBeachMapStrip("Bali");
    expect(strip).not.toBeNull();
    const text = toPlainText({
      text: "Palawan plan",
      blocks: [toMapStripBlock(strip!)],
    });
    expect(text).toContain("Map near Alila Villas Uluwatu");
    expect(text).toContain("1 · Uluwatu Temple ·");
    expect(text).toContain("~");
    expect(text).toContain("min walk");
    expect(text).toContain("Hotel on Google Maps: https://www.google.com/maps/search/?api=1&query=-8.8456,115.1372");
  });

  it("keeps the map strip through sanitiseBlocks and the validator", () => {
    const strip = buildBeachMapStrip("Palawan");
    const block = toMapStripBlock(strip!);
    expect(isMapStripBlock(block)).toEqual(block);
    const safe = sanitiseBlocks([block]);
    expect(safe).toHaveLength(1);
    expect(safe[0].type).toBe("map_strip");
    expect(isMapStripBlock({ type: "map_strip" })).toBeNull();
  });

  it("checks every beach hotel country against the geography rule", () => {
    expect(BEACH_COUNTRY.Bali).toBe("Indonesia");
    expect(BEACH_COUNTRY.Maldives).toBe("Maldives");
    expect(BEACH_COUNTRY.Palawan).toBe("Philippines");
    for (const dest of BEACH_DESTINATIONS) {
      expect(dest.country).toBe(BEACH_COUNTRY[dest.title]);
      const strip = buildBeachMapStrip(dest.title);
      expect(strip?.hotelName).toBe(dest.hotelName);
      expect(strip?.stops.length).toBeGreaterThan(0);
      expect(strip?.stops.every((s) => s.pin !== null)).toBe(true);
    }
  });
});

describe("nearby row", () => {
  it("keeps only places within 800 m", () => {
    expect(NEARBY_RADIUS_M).toBe(800);
    const picked = filterNearbyPlaces(ALILA, [
      { name: "Near", category: "cafe", lat: -8.8451, lng: 115.1372 },
      { name: "Far", category: "cafe", lat: -8.8192, lng: 115.0845 },
    ]);
    expect(picked.map((p) => p.name)).toEqual(["Near"]);
  });

  it("orders by walk time ascending, ties to the higher rating", () => {
    const picked = filterNearbyPlaces(ALILA, [
      { name: "B", category: "cafe", lat: -8.8446, lng: 115.1372, rating: 3.0 },
      { name: "A", category: "cafe", lat: -8.8446, lng: 115.1372, rating: 4.5 },
      { name: "C", category: "cafe", lat: -8.8451, lng: 115.1372, rating: 5.0 },
    ]);
    expect(picked.map((p) => p.name)).toEqual(["C", "A", "B"]);
  });

  it("caps at 5 and keeps at least 1 of each type when available", () => {
    const places: NearbyPlaceInput[] = Array.from({ length: 7 }, (_, i) => ({
      name: `Restaurant ${i + 1}`,
      category: "restaurant" as const,
      lat: ALILA.lat + 0.0001 * (i + 1),
      lng: ALILA.lng,
      rating: 4.0,
    }));
    places.push(
      { name: "Only Cafe", category: "cafe" as const, lat: ALILA.lat + 0.0008, lng: ALILA.lng, rating: 4.0 },
      { name: "Only Attraction", category: "tourist_attraction" as const, lat: ALILA.lat + 0.0009, lng: ALILA.lng, rating: 4.0 },
    );
    const picked = filterNearbyPlaces(ALILA, places);
    expect(picked).toHaveLength(NEARBY_CAP);
    expect(picked.map((p) => p.name)).toContain("Only Cafe");
    expect(picked.map((p) => p.name)).toContain("Only Attraction");
  });

  it("shows the empty state with no padding from farther results", async () => {
    const row = await buildNearbyRow(ALILA, [
      { name: "Far", category: "cafe", lat: -8.8192, lng: 115.0845 },
    ]);
    expect(row).toEqual([]);
    const block = toNearbyRowBlock("Alila Villas Uluwatu", row);
    expect(block.emptyText).toBe(NEARBY_EMPTY_TEXT);
    const text = toPlainText({ text: "", blocks: [block] });
    expect(text).toContain("Nothing found within a 10 min walk");
    expect(text).not.toContain("Far");
  });

  it("builds a nearby row for Bali with photos falling back by name", async () => {
    const row = await buildBeachNearbyRow("Bali");
    expect(row.length).toBeGreaterThan(0);
    expect(row.length).toBeLessThanOrEqual(NEARBY_CAP);
    for (const place of row) {
      expect(place.walkText).toMatch(/^~\d+ min walk$/);
      expect(place.mapsUrl).toContain("google.com/maps/search");
      expect(place.photoUrl).toBeNull();
      expect(place.photoFallback).toBe("No photo found");
      expect(place.rating).toBeNull();
    }
    const block = toNearbyRowBlock("Alila Villas Uluwatu", row);
    expect(isNearbyRowBlock(block)).toEqual(block);
    const safe = sanitiseBlocks([block]);
    expect(safe).toHaveLength(1);
    expect(safe[0].type).toBe("nearby_row");
    const text = toPlainText({ text: "", blocks: [block] });
    expect(text).toContain("CIRE (Restaurant)");
    expect(text).toContain("min walk");
  });

  it("omits the rating chip value when no rating exists", () => {
    const block = toNearbyRowBlock("H", [
      {
        name: "CIRE",
        category: "restaurant",
        rating: null,
        distanceKm: 0.05,
        walkText: "~1 min walk",
        mapsUrl: googleMapsPointUrl(ALILA),
        photoUrl: null,
        photoSourceName: null,
        photoFallback: "No photo found",
      },
    ]);
    const text = toPlainText({ text: "", blocks: [block] });
    expect(text).toContain("CIRE (Restaurant)");
    expect(text).not.toContain("stars");
  });
});
