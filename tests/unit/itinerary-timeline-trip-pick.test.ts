import { describe, expect, it, vi } from "vitest";
import {
  buildItineraryTimeline,
  resolveItineraryTimelinePhotos,
  TIMELINE_COLLAPSE_AFTER_DAY,
  toItineraryTimelineBlock,
} from "../../lib/travel/itinerary-timeline";
import { buildMapStrip } from "../../lib/travel/map-strip";
import {
  beachItineraryStops,
  BEACH_COUNTRY,
  BEACH_DESTINATIONS,
} from "../../lib/travel/beach-compare";
import {
  buildTripPick,
  isTripPickComplete,
  messageNamesBeachDestination,
  missingPickInputs,
  nightsBetween,
  parseBeachPickReply,
  pickMissingInputQuestion,
  tripPickTitle,
} from "../../lib/travel/trip-pick";
import { DESTINATION_COUNTRY } from "../../lib/travel/destination-suggestion";
import {
  isItineraryTimelineBlock,
  toPlainText,
} from "../../lib/chat/rich-message";
import { sanitiseBlocks } from "../../lib/chat/safety";
import { enrichLlmReply } from "../../lib/chat/visual-enricher";

vi.mock("../../lib/media/bousier", () => ({
  resolveImageForEntity: vi.fn(async () => ({
    selectedImageUrl: null,
    cached: false,
    imageCandidates: [],
    imageLastCheckedAt: "2026-11-17T00:00:00.000Z",
  })),
  resolveImageBatch: vi.fn(async (inputs: Array<{ title: string }>) =>
    inputs.map((input) => ({
      selectedImageUrl: `https://example.com/${input.title.toLowerCase()}.jpg`,
      selectedSourceName: "wikipedia_summary",
      cached: false,
      imageCandidates: Array.from({ length: 6 }, (_, i) => ({
        imageUrl: `https://example.com/${input.title.toLowerCase()}-${i}.jpg`,
        sourceTier: "tier2_open_data",
        sourceName: "wikipedia_summary",
        confidence: 0.6 - i * 0.05,
      })),
      imageLastCheckedAt: "2026-11-17T00:00:00.000Z",
    })),
  ),
}));

const ALILA = { lat: -8.8456, lng: 115.1372 };

const BALI_STOPS = [
  { name: "Uluwatu Temple", lat: -8.8192, lng: 115.0845, day: 1, time: "09:00", category: "Beach" },
  { name: "Padang Padang Beach", lat: -8.8135, lng: 115.103, day: 2, time: "10:00", category: "Beach" },
];

describe("itinerary timeline", () => {
  it("groups one card per day with a weekday label when a start date is known", () => {
    const timeline = buildItineraryTimeline({
      hotelName: "Alila Villas Uluwatu",
      hotel: ALILA,
      stops: BALI_STOPS,
      startDate: "2026-12-11",
    });
    expect(timeline.days).toHaveLength(2);
    expect(timeline.days[0].label).toBe("Day 1 · Fri");
    expect(timeline.days[1].label).toBe("Day 2 · Sat");
  });

  it("labels days without a weekday when no start date is given", () => {
    const timeline = buildItineraryTimeline({
      hotelName: "Alila Villas Uluwatu",
      hotel: ALILA,
      stops: BALI_STOPS,
    });
    expect(timeline.days.map((d) => d.label)).toEqual(["Day 1", "Day 2"]);
  });

  it("shows a photo slot, a time, and a from-hotel distance line per stop", () => {
    const timeline = buildItineraryTimeline({
      hotelName: "Alila Villas Uluwatu",
      hotel: ALILA,
      stops: BALI_STOPS,
    });
    const stop = timeline.days[0].stops[0];
    expect(stop.time).toBe("09:00");
    expect(stop.distanceLine).toMatch(/^\d+\.\d km from hotel · ~\d+ min walk$/);
    expect(stop.mapsUrl).toContain("google.com/maps/search");
  });

  it("assigns the same pin numbers as the map strip for the same stops", () => {
    const timeline = buildItineraryTimeline({
      hotelName: "Alila Villas Uluwatu",
      hotel: ALILA,
      stops: BALI_STOPS,
    });
    const strip = buildMapStrip({
      hotelName: "Alila Villas Uluwatu",
      hotel: ALILA,
      stops: BALI_STOPS,
    });
    const timelinePins = timeline.days.flatMap((d) => d.stops.map((s) => [s.name, s.pin]));
    const stripPins = strip.stops.map((s) => [s.name, s.pin]);
    expect(timelinePins).toEqual(stripPins);
  });

  it("lists a stop with no coordinates with no pin and no distance line", () => {
    const timeline = buildItineraryTimeline({
      hotelName: "Alila Villas Uluwatu",
      hotel: ALILA,
      stops: [{ name: "Secret Beach", day: 1, time: "09:00" }],
    });
    const stop = timeline.days[0].stops[0];
    expect(stop.pin).toBeNull();
    expect(stop.distanceLine).toBeNull();
    expect(stop.mapsUrl).toContain("query=Secret%20Beach");
  });

  it("keeps a stop with no photo as a compact text row, never a generated image", async () => {
    const base = buildItineraryTimeline({
      hotelName: "Alila Villas Uluwatu",
      hotel: ALILA,
      stops: BALI_STOPS,
    });
    const resolved = await resolveItineraryTimelinePhotos(base, BALI_STOPS);
    expect(resolved.days[0].stops[0].photoUrl).toBeNull();
    expect(resolved.days[0].stops[0].photoFallback).toBe("No photo found");
  });

  it("collapses days after Day 3 behind Show all days", () => {
    expect(TIMELINE_COLLAPSE_AFTER_DAY).toBe(3);
  });

  it("writes the plain text fallback in the checklist format", () => {
    const timeline = buildItineraryTimeline({
      hotelName: "Alila Villas Uluwatu",
      hotel: ALILA,
      stops: BALI_STOPS,
    });
    const text = toPlainText({
      text: "Palawan, Philippines",
      blocks: [toItineraryTimelineBlock(timeline)],
    });
    expect(text).toContain("Day 2: 10:00 Padang Padang Beach (~");
    expect(text).toContain("min walk) https://www.google.com/maps/search/?api=1&query=");
    expect(text).toContain("times are suggested");
  });

  it("validates and sanitises the timeline block, dropping bad stops", () => {
    const block = toItineraryTimelineBlock(
      buildItineraryTimeline({
        hotelName: "Alila Villas Uluwatu",
        hotel: ALILA,
        stops: BALI_STOPS,
      }),
    );
    expect(isItineraryTimelineBlock(block)).not.toBeNull();
    const safe = sanitiseBlocks([
      {
        ...block,
        days: [
          { day: 1, label: "Day 1", stops: [{ name: "", time: "09:00", mapsUrl: "https://example.com" }] },
          { day: 2, label: "Day 2", stops: block.days[1].stops },
        ],
      },
    ]);
    expect(safe).toHaveLength(1);
    expect(safe[0].type).toBe("itinerary_timeline");
    if (safe[0].type === "itinerary_timeline") {
      expect(safe[0].days).toHaveLength(1);
      expect(safe[0].days[0].day).toBe(2);
    }
  });

  it("builds beach stops with suggested times from the sample data", () => {
    const stops = beachItineraryStops("Bali");
    expect(stops).toHaveLength(2);
    expect(stops[0].time).toBe("09:00");
    expect(stops[1].time).toBe("10:00");
    expect(beachItineraryStops("Nowhere")).toEqual([]);
  });
});

describe("trip pick", () => {
  it("parses a tap, a number, a name, and the card tap line the same way", () => {
    expect(parseBeachPickReply("2")).toBe("Maldives");
    expect(parseBeachPickReply("Maldives")).toBe("Maldives");
    expect(parseBeachPickReply("Pick Bali")).toBe("Bali");
    expect(parseBeachPickReply('I\'d like to go with "Palawan".')).toBe("Palawan");
    expect(parseBeachPickReply("3")).toBe("Palawan");
  });

  it("rejects numbers outside 1 to 3, two beaches, and plain chat", () => {
    expect(parseBeachPickReply("4")).toBeNull();
    expect(parseBeachPickReply("Bali and Maldives")).toBeNull();
    expect(parseBeachPickReply("hello")).toBeNull();
    expect(parseBeachPickReply("")).toBeNull();
  });

  it("tells a named destination from a bare number", () => {
    expect(messageNamesBeachDestination("Maldives")).toBe(true);
    expect(messageNamesBeachDestination("2")).toBe(false);
  });

  it("carries destination, hotel, flight, dates, budget, and travelers", () => {
    const pick = buildTripPick("Palawan", {
      depart: "2026-12-11",
      return: "2026-12-16",
      budgetCad: 2500,
      travelers: 2,
    });
    expect(pick).not.toBeNull();
    expect(pick?.destination).toBe("Palawan");
    expect(pick?.country).toBe("Philippines");
    expect(pick?.hotel.name).toBe("Pangulasian Island Resort");
    expect(pick?.hotel.lat).toBe(11.1132);
    expect(pick?.hotel.lng).toBe(119.3358);
    expect(pick?.flight.priceCad).toBe(1320);
    expect(pick?.flight.label).toBe("Sample");
    expect(pick?.nights).toBe(5);
    expect(pick?.budgetCad).toBe(2500);
    expect(pick?.travelers).toBe(2);
    expect(tripPickTitle(pick!)).toBe("Palawan, Philippines — 5 nights");
    expect(isTripPickComplete(pick!)).toBe(true);
  });

  it("never assumes dates or budget: they stay null until given", () => {
    const pick = buildTripPick("Bali");
    expect(pick?.depart).toBeNull();
    expect(pick?.return).toBeNull();
    expect(pick?.nights).toBeNull();
    expect(pick?.budgetCad).toBeNull();
    expect(missingPickInputs(pick!)).toEqual(["dates", "budget"]);
    expect(isTripPickComplete(pick!)).toBe(false);
    expect(tripPickTitle(pick!)).toBe("Bali, Indonesia");
  });

  it("asks dates first, then budget, with quick-reply chips", () => {
    const pick = buildTripPick("Maldives");
    const asked = pickMissingInputQuestion(pick!);
    expect(asked?.question).toContain("What dates work for you?");
    expect(asked?.followUps.length).toBeGreaterThan(0);
    const withDates = buildTripPick("Maldives", {
      depart: "2026-12-11",
      return: "2026-12-14",
    });
    const askedBudget = pickMissingInputQuestion(withDates!);
    expect(askedBudget?.question).toContain("What budget per person?");
    expect(askedBudget?.followUps.length).toBeGreaterThan(0);
  });

  it("counts nights between ISO dates", () => {
    expect(nightsBetween("2026-12-11", "2026-12-14")).toBe(3);
    expect(nightsBetween(null, "2026-12-14")).toBeNull();
    expect(nightsBetween("2026-12-14", "2026-12-11")).toBeNull();
  });

  it("returns null for an unknown destination", () => {
    expect(buildTripPick("Hawaii")).toBeNull();
  });

  it("checks every place label against the geography rule", () => {
    for (const dest of BEACH_DESTINATIONS) {
      expect(dest.country).toBe(BEACH_COUNTRY[dest.title]);
      expect(DESTINATION_COUNTRY[dest.title]).toBe(dest.country);
    }
    expect(BEACH_COUNTRY.Bali).toBe("Indonesia");
    expect(BEACH_COUNTRY.Maldives).toBe("Maldives");
    expect(BEACH_COUNTRY.Palawan).toBe("Philippines");
  });
});

describe("5 photo gallery", () => {
  it("attaches up to 4 extra real photos per card, hero plus extras at most 5", async () => {
    // Non-beach options keep the option_set gallery path. Beach
    // options now become destination previews instead, and the
    // preview hero gallery stays deferred (design section 5).
    const msg = await enrichLlmReply(
      JSON.stringify({
        text: "Three cities fit.",
        options: [
          { title: "Paris", category: "destination" },
          { title: "Tokyo", category: "destination" },
          { title: "Rome", category: "destination" },
        ],
      }),
    );
    const set = msg.blocks?.find((b) => b.type === "option_set");
    expect(set?.type).toBe("option_set");
    if (set?.type !== "option_set") return;
    for (const item of set.items) {
      const total = 1 + (item.card.gallery?.length ?? 0);
      expect(total).toBeLessThanOrEqual(5);
      expect(item.card.gallery?.length).toBe(4);
      for (const photo of item.card.gallery ?? []) {
        expect(photo.imageUrl.startsWith("https://")).toBe(true);
        expect(photo.imageUrl).not.toContain("placehold.co");
      }
    }
  });

  it("caps a sanitised gallery at 5 photos", () => {
    const safe = sanitiseBlocks([
      {
        type: "image_card",
        title: "Bali",
        imageUrl: "https://example.com/bali.jpg",
        gallery: Array.from({ length: 7 }, (_, i) => ({
          imageUrl: `https://example.com/bali-${i}.jpg`,
        })),
      },
    ]);
    expect(safe).toHaveLength(1);
    if (safe[0].type === "image_card") {
      expect(safe[0].gallery).toHaveLength(5);
    }
  });
});
