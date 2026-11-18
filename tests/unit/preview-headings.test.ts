import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { HotelStoryView } from "../../components/chat/blocks/hotel-set";
import { MapStripView } from "../../components/chat/blocks/map-strip";
import { NearbyRowView } from "../../components/chat/blocks/nearby-row";
import { ItineraryTimelineView } from "../../components/chat/blocks/itinerary-timeline";
import { DestinationPreviewView } from "../../components/chat/blocks/destination-preview";
import {
  beachItineraryStops,
  BEACH_PREVIEW_CLOSING_LINE,
  buildBeachDestinationPreview,
  buildBeachMapStrip,
} from "../../lib/travel/beach-compare";
import { toMapStripBlock } from "../../lib/travel/map-strip";
import {
  buildItineraryTimeline,
  toItineraryTimelineBlock,
} from "../../lib/travel/itinerary-timeline";
import type { NearbyRowBlock } from "../../lib/chat/rich-message";

/**
 * Server-rendered markup escapes apostrophes, so unescape before
 * asserting on visible copy.
 */
function visible(html: string): string {
  return html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
}

function count(haystack: string, needle: string): number {
  return haystack.split(needle).length - 1;
}

function baliMap() {
  const mapData = buildBeachMapStrip("Bali");
  expect(mapData).not.toBeNull();
  return toMapStripBlock(mapData!);
}

function baliNearby(): NearbyRowBlock {
  return {
    type: "nearby_row",
    hotelName: "Alila Villas Uluwatu",
    places: [
      {
        name: "CIRE",
        category: "Restaurant",
        rating: null,
        walkText: "~1 min walk",
        mapsUrl: "https://www.google.com/maps/search/?api=1&query=-8.8451,115.1372",
        photoUrl: null,
        photoSourceName: null,
        photoFallback: "No photo found",
      },
    ],
    emptyText: "Nothing found within a 10 min walk",
  };
}

function baliDay() {
  return toItineraryTimelineBlock(
    buildItineraryTimeline({
      hotelName: "Alila Villas Uluwatu",
      hotel: { lat: -8.8456, lng: 115.1372 },
      stops: beachItineraryStops("Bali"),
    }),
  );
}

function fourDayBlock() {
  return toItineraryTimelineBlock(
    buildItineraryTimeline({
      hotelName: "Alila Villas Uluwatu",
      hotel: { lat: -8.8456, lng: 115.1372 },
      stops: [1, 2, 3, 4].map((day) => ({
        name: `Day ${day} stop`,
        lat: -8.82,
        lng: 115.08,
        day,
        time: "09:00",
        category: "Beach",
        sourceUrl: "https://en.wikipedia.org/wiki/Bali",
      })),
    }),
  );
}

describe("hotel story display mode", () => {
  it("reads as Where you'd stay: photo, name, area, why line, View on source", () => {
    const html = visible(
      renderToStaticMarkup(
        createElement(HotelStoryView, {
          hotel: {
            name: "Alila Villas Uluwatu",
            area: "Uluwatu, Bali",
            whyItFits:
              "On the cliffs in Uluwatu. It puts you close to the temple and the cliff beaches.",
            photoUrl: "https://example.com/hotel.jpg",
            photoSourceName: "Wikipedia",
            sourceUrl: "https://en.wikipedia.org/wiki/Bali",
            sourceName: "Wikipedia",
          },
        }),
      ),
    );
    expect(html).toContain("Alila Villas Uluwatu");
    expect(html).toContain("Uluwatu, Bali");
    expect(html).toContain("It puts you close to the temple");
    expect(html).toContain("https://example.com/hotel.jpg");
    expect(html).toContain("View on Wikipedia");
    expect(html).toContain("https://en.wikipedia.org/wiki/Bali");
  });

  it("has no select, no checkmark, no price, and no button", () => {
    const html = visible(
      renderToStaticMarkup(
        createElement(HotelStoryView, {
          hotel: {
            name: "Soneva Fushi",
            area: "Baa Atoll, Maldives",
            whyItFits: "A resort on its own island. The island is the trip.",
            photoUrl: "https://example.com/soneva.jpg",
            sourceUrl: "https://en.wikipedia.org/wiki/Maldives",
            sourceName: "Wikipedia",
          },
        }),
      ),
    );
    expect(html).not.toContain("<button");
    expect(html).not.toContain("✓");
    expect(html).not.toContain("a night");
    expect(html).not.toContain("Check price");
  });

  it("shows the named fallback when there is no photo", () => {
    const html = visible(
      renderToStaticMarkup(
        createElement(HotelStoryView, {
          hotel: {
            name: "Pangulasian Island Resort",
            area: "El Nido, Palawan",
            whyItFits: "On its own small island. Quiet base for boat days.",
            photoFallback: "No hotel photo found",
          },
        }),
      ),
    );
    expect(html).toContain("No hotel photo found");
    expect(html).not.toContain("<img");
  });
});

describe("map strip heading prop", () => {
  it("defaults to Map near the hotel for standalone use", () => {
    const html = visible(
      renderToStaticMarkup(createElement(MapStripView, { block: baliMap() })),
    );
    expect(html).toContain("Map near Alila Villas Uluwatu");
  });

  it("reads the heading prop in a preview and drops Map near", () => {
    const html = visible(
      renderToStaticMarkup(
        createElement(MapStripView, {
          block: baliMap(),
          heading: "Where things are",
        }),
      ),
    );
    expect(html).toContain("Where things are");
    expect(html).not.toContain("Map near");
  });

  it("renders no heading when the heading prop is null", () => {
    const html = visible(
      renderToStaticMarkup(
        createElement(MapStripView, { block: baliMap(), heading: null }),
      ),
    );
    expect(html).not.toContain("Map near");
  });
});

describe("nearby row heading prop", () => {
  it("defaults to Near the hotel for standalone use", () => {
    const html = visible(
      renderToStaticMarkup(createElement(NearbyRowView, { block: baliNearby() })),
    );
    expect(html).toContain("Near Alila Villas Uluwatu");
  });

  it("reads the heading prop in a preview and drops Near the hotel", () => {
    const html = visible(
      renderToStaticMarkup(
        createElement(NearbyRowView, {
          block: baliNearby(),
          heading: "What's nearby",
        }),
      ),
    );
    expect(html).toContain("What's nearby");
    expect(html).not.toContain("Near Alila Villas Uluwatu");
  });

  it("renders no heading when the heading prop is null", () => {
    const html = visible(
      renderToStaticMarkup(
        createElement(NearbyRowView, { block: baliNearby(), heading: null }),
      ),
    );
    expect(html).not.toContain("Near Alila Villas Uluwatu");
  });

  it("keeps the heading prop on the empty row", () => {
    const html = visible(
      renderToStaticMarkup(
        createElement(NearbyRowView, {
          block: { ...baliNearby(), places: [] },
          heading: "What's nearby",
        }),
      ),
    );
    expect(html).toContain("What's nearby");
    expect(html).toContain("Nothing found within a 10 min walk");
  });
});

describe("itinerary timeline single-day mode", () => {
  it("defaults to the Itinerary near heading with collapse after day 3", () => {
    const html = visible(
      renderToStaticMarkup(
        createElement(ItineraryTimelineView, { block: fourDayBlock() }),
      ),
    );
    expect(html).toContain("Itinerary near Alila Villas Uluwatu");
    expect(html).toContain("Show all days (1 more day)");
    expect(html).toContain("Day 3 stop");
    // Day 4 sits behind the collapse control, so it is not rendered.
    expect(html).not.toContain("Day 4 stop");
  });

  it("reads What a day could look like, shows day 1 only, no collapse", () => {
    const html = visible(
      renderToStaticMarkup(
        createElement(ItineraryTimelineView, {
          block: fourDayBlock(),
          singleDay: true,
        }),
      ),
    );
    expect(html).toContain("What a day could look like");
    expect(html).not.toContain("Itinerary near");
    expect(html).toContain("Day 1 stop");
    expect(html).not.toContain("Day 2 stop");
    expect(html).not.toContain("Day 4 stop");
    expect(html).not.toContain("Show all days");
  });
});

describe("full preview render: no doubled headings", () => {
  it("shows each detail heading once and no embedded Map near / Itinerary near", () => {
    const block = buildBeachDestinationPreview("Bali", {
      map: baliMap(),
      nearby: baliNearby(),
      day: baliDay(),
      whyItFits: "Easy variety.",
      closingLine: BEACH_PREVIEW_CLOSING_LINE,
    });
    const html = visible(
      renderToStaticMarkup(
        createElement(DestinationPreviewView, { block: block! }),
      ),
    );
    expect(count(html, "Where things are")).toBe(1);
    expect(count(html, "What's nearby")).toBe(1);
    expect(count(html, "What a day could look like")).toBe(1);
    expect(count(html, "Where you'd stay")).toBe(1);
    expect(html).not.toContain("Map near");
    expect(html).not.toContain("Itinerary near");
    expect(html).not.toContain("Near Alila Villas Uluwatu");
    expect(html).not.toContain("✓");
    expect(html).not.toContain("<button");
    expect(html).toContain("View on Wikipedia");
    expect(html).toContain("General guidance");
  });
});
