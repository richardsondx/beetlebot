import { describe, expect, it } from "vitest";
import {
  BEACH_PREVIEW_CLOSING_LINE,
  BEACH_PREVIEW_SET_LINE,
  beachItineraryStops,
  buildBeachDestinationPreview,
  buildBeachMapStrip,
} from "../../lib/travel/beach-compare";
import { toMapStripBlock } from "../../lib/travel/map-strip";
import {
  buildItineraryTimeline,
  toItineraryTimelineBlock,
} from "../../lib/travel/itinerary-timeline";
import {
  destinationPreviewToText,
  isDestinationPreviewBlock,
  toPlainText,
  type DestinationPreviewBlock,
} from "../../lib/chat/rich-message";
import { sanitiseBlocks } from "../../lib/chat/safety";
import { ruleFollowUps } from "../../lib/chat/follow-ups";
import { PRICE_PENDING_LABEL } from "../../lib/travel/destination-suggestion";

const FULL_HEADINGS = [
  "What it's like",
  "Why it fits your ask",
  "Highlights",
  "Best time to go",
  "Honest take",
  "Where you'd stay",
  "Where things are",
  "What's nearby",
  "What a day could look like",
  "Practical notes",
];

const SHORT_VISIBLE_HEADINGS = [
  "What it's like",
  "Why it fits your ask",
  "Highlights",
  "Best time to go",
  "Honest take",
  "Where you'd stay",
  "Practical notes",
];

function detailBlocks() {
  const mapData = buildBeachMapStrip("Bali");
  const dayData = buildItineraryTimeline({
    hotelName: "Alila Villas Uluwatu",
    hotel: { lat: -8.8456, lng: 115.1372 },
    stops: beachItineraryStops("Bali"),
  });
  return {
    map: mapData ? toMapStripBlock(mapData) : undefined,
    nearby: {
      type: "nearby_row" as const,
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
    },
    day: toItineraryTimelineBlock(dayData),
  };
}

describe("single-place preview", () => {
  it("has 12 sections: hero, 10 content sections, closing line", () => {
    const block = buildBeachDestinationPreview("Bali", {
      ...detailBlocks(),
      whyItFits: "Easy variety for a February trip for two.",
    });
    expect(block).not.toBeNull();
    expect(block!.type).toBe("destination_preview");
    expect(block!.place).toBe("Bali");
    expect(block!.countryLine).toBe("Bali, Indonesia");
    expect(block!.sections.map((s) => s.heading)).toEqual(FULL_HEADINGS);
    // Hero plus 10 sections plus the closing line is the 12-section form.
    expect(block!.sections).toHaveLength(10);
    expect(block!.sections.some((s) => s.collapsed)).toBe(false);
  });

  it("uses the exact design copy for Bali", () => {
    const block = buildBeachDestinationPreview("Bali", detailBlocks());
    const byKind = Object.fromEntries(
      block!.sections.map((s) => [s.kind, s]),
    );
    expect(byKind.what_it_is_like.body).toContain(
      "An Indonesian island with temples, rice terraces, surf beaches, and a busy food scene.",
    );
    expect(byKind.highlights.bullets).toEqual([
      "Uluwatu Temple on the cliff edge at sunset.",
      "Padang Padang Beach below the cliffs.",
      "Day trips inland to rice terraces and temples.",
    ]);
    expect(byKind.best_time.body).toContain("February falls in the wet season");
    expect(byKind.honest_take.rows).toEqual([
      { label: "Good for", value: "Variety: beaches, culture, food, and day trips in one place." },
      { label: "Suits", value: "Couples who want to do things, not only rest." },
      { label: "Trade-offs", value: "Busy roads and crowded spots. February rain. Cliff beaches can mean stairs." },
    ]);
    expect(byKind.stay.hotel?.name).toBe("Alila Villas Uluwatu");
    expect(byKind.stay.hotel?.area).toBe("Uluwatu, Bali");
    expect(byKind.practical_notes.practical?.flight).toBe("CA$1,240 Sample");
    expect(byKind.practical_notes.practical?.nightly).toBe(
      "$420 per night Sample",
    );
  });

  it("labels every model-written section General guidance", () => {
    const block = buildBeachDestinationPreview("Maldives", {
      whyItFits: "Quiet water and privacy.",
    });
    for (const section of block!.sections) {
      if (
        ["what_it_is_like", "why_it_fits", "highlights", "best_time", "honest_take", "stay", "practical_notes"].includes(
          section.kind,
        )
      ) {
        expect(section.label).toBe("General guidance");
      }
    }
  });

  it("uses the exact design copy for Maldives and Palawan", () => {
    const maldives = buildBeachDestinationPreview("Maldives", {});
    const m = Object.fromEntries(
      maldives!.sections.map((s) => [s.kind, s]),
    );
    expect(maldives!.countryLine).toBe(
      "Maldives, its own country in the Indian Ocean",
    );
    expect(m.what_it_is_like.body).toBe(
      "A country made of coral atolls in the Indian Ocean. Most stays are on a private resort island with lagoon, reef, and little else.",
    );
    expect(m.highlights.bullets).toEqual([
      "Snorkelling off the resort's house reef.",
      "Lagoon time from your villa.",
      "Stops on the resort island itself.",
    ]);
    expect(m.best_time.body).toBe(
      "The drier season is usually around December to April, so February is generally a good month.",
    );
    expect(m.honest_take.rows).toEqual([
      { label: "Good for", value: "Quiet, water, and privacy." },
      { label: "Suits", value: "Couples who want to rest and stay put." },
      {
        label: "Trade-offs",
        value:
          "The nightly cost is high. Little to do beyond the island. Getting there can add a boat or seaplane transfer.",
      },
    ]);
    expect(m.stay.hotel?.name).toBe("Soneva Fushi");
    expect(m.stay.hotel?.area).toBe("Baa Atoll, Maldives");
    expect(m.stay.hotel?.whyItFits).toBe(
      "A resort on its own island. The island is the trip.",
    );
    expect(m.practical_notes.practical?.gettingThere).toBe(
      "International flights land near Malé, then a transfer to the resort.",
    );
    expect(m.practical_notes.practical?.flight).toBe("CA$1,480 Sample");
    expect(m.practical_notes.practical?.nightly).toBe(
      "$890 per night Sample",
    );

    const palawan = buildBeachDestinationPreview("Palawan", {});
    const p = Object.fromEntries(
      palawan!.sections.map((s) => [s.kind, s]),
    );
    expect(palawan!.countryLine).toBe("Palawan, an island in the Philippines");
    expect(p.what_it_is_like.body).toBe(
      "A long island in the western Philippines known for limestone islands, clear water, and lagoons. Much of the draw is by boat.",
    );
    expect(p.highlights.bullets).toEqual([
      "Island hopping by boat.",
      "Lagoons and limestone cliffs.",
      "Stops on the resort island itself.",
    ]);
    expect(p.best_time.body).toBe(
      "The drier season is usually around December to May, so February is generally a good month.",
    );
    expect(p.honest_take.rows).toEqual([
      {
        label: "Good for",
        value: "Scenery and boat days, with a modest nightly cost.",
      },
      { label: "Suits", value: "Couples who like a bit of adventure with a calm base." },
      {
        label: "Trade-offs",
        value:
          "Longer trip to reach, often with a domestic connection. Fewer big-city comforts nearby.",
      },
    ]);
    expect(p.stay.hotel?.name).toBe("Pangulasian Island Resort");
    expect(p.stay.hotel?.area).toBe("El Nido, Palawan");
    expect(p.stay.hotel?.whyItFits).toBe(
      "On its own small island. Quiet base for boat days.",
    );
    expect(p.practical_notes.practical?.gettingThere).toBe(
      "Most routes connect through Manila.",
    );
    expect(p.practical_notes.practical?.flight).toBe("CA$1,320 Sample");
    expect(p.practical_notes.practical?.nightly).toBe(
      "$310 per night Sample",
    );
  });

  it("uses the exact three-place set line", () => {
    expect(BEACH_PREVIEW_SET_LINE).toBe(
      "Three places, each its own kind of trip: Bali for temples, rice terraces, and surf; the Maldives for quiet water and privacy; Palawan for limestone islands and boat days.",
    );
  });

  it("labels a Wikipedia lead From Wikipedia with the source link", () => {
    const block = buildBeachDestinationPreview("Palawan", {
      whatItIsLike: {
        text: "Palawan is an island province of the Philippines.",
        sourceUrl: "https://en.wikipedia.org/wiki/Palawan",
      },
    });
    const what = block!.sections.find((s) => s.kind === "what_it_is_like");
    expect(what?.label).toBe("From Wikipedia");
    expect(what?.sourceUrl).toBe("https://en.wikipedia.org/wiki/Palawan");
    expect(what?.body).toContain("island province");
  });

  it("hides Why it fits when no pitch line is given", () => {
    const block = buildBeachDestinationPreview("Bali", detailBlocks());
    expect(block!.sections.some((s) => s.kind === "why_it_fits")).toBe(false);
    expect(block!.sections.map((s) => s.heading)).not.toContain(
      "Why it fits your ask",
    );
  });

  it("builds no Pick button and no aligned price row anywhere", () => {
    const block = buildBeachDestinationPreview("Bali", {
      ...detailBlocks(),
      whyItFits: "Easy variety.",
    });
    const serialised = JSON.stringify(block);
    expect(serialised).not.toMatch(/pick/i);
    expect(serialised).not.toContain("compareRows");
    expect(serialised).not.toContain("option_set");
    const text = toPlainText({ text: "", blocks: [block!] });
    expect(text).not.toMatch(/pick/i);
    expect(text).not.toContain("Reply 1, 2, or 3 to pick.");
  });

  it("renders the plain-text fallback as headed lines in order", () => {
    const block = buildBeachDestinationPreview("Bali", {
      ...detailBlocks(),
      whyItFits: "Easy variety.",
      closingLine: BEACH_PREVIEW_CLOSING_LINE,
    });
    const text = destinationPreviewToText(block!);
    const headings = FULL_HEADINGS.map((h) => text.indexOf(h));
    expect(headings.every((i) => i >= 0)).toBe(true);
    for (let i = 1; i < headings.length; i++) {
      expect(headings[i]).toBeGreaterThan(headings[i - 1]);
    }
    expect(text).toContain("Bali, Indonesia");
    expect(text).toContain("Beetlebot does not book.");
    expect(text).toContain(BEACH_PREVIEW_CLOSING_LINE);
  });

  it("returns null for an unknown place", () => {
    expect(buildBeachDestinationPreview("Paris")).toBeNull();
  });
});

describe("three-place short preview", () => {
  it("shows 8 sections with map, nearby, and sample day collapsed", () => {
    const block = buildBeachDestinationPreview("Bali", {
      ...detailBlocks(),
      whyItFits: "Easy variety.",
      short: true,
      setLine: BEACH_PREVIEW_SET_LINE,
      closingLine: BEACH_PREVIEW_CLOSING_LINE,
    });
    const visible = block!.sections.filter((s) => !s.collapsed);
    const collapsed = block!.sections.filter((s) => s.collapsed);
    expect(visible.map((s) => s.heading)).toEqual(SHORT_VISIBLE_HEADINGS);
    // Hero plus 7 visible sections is the 8-section form.
    expect(visible).toHaveLength(7);
    expect(collapsed.map((s) => s.kind)).toEqual(["map", "nearby", "sample_day"]);
    expect(block!.setLine).toBe(BEACH_PREVIEW_SET_LINE);
    expect(block!.closingLine).toBe(BEACH_PREVIEW_CLOSING_LINE);
  });

  it("keeps the set line and closing line free of comparison framing", () => {
    expect(BEACH_PREVIEW_SET_LINE).not.toMatch(/\bvs\b|differ|winner|best|pick/i);
    expect(BEACH_PREVIEW_CLOSING_LINE).not.toMatch(/\bvs\b|differ|winner|pick/i);
  });
});

describe("price-pending in previews", () => {
  it("shows Price coming soon and no Sample figure when pending", () => {
    const block = buildBeachDestinationPreview("Maldives", {
      pricePending: true,
    });
    const practical = block!.sections.find(
      (s) => s.kind === "practical_notes",
    )?.practical;
    expect(practical?.pricePending).toBe(true);
    expect(practical?.flight).toBeUndefined();
    expect(practical?.nightly).toBeUndefined();
    const text = toPlainText({ text: "", blocks: [block!] });
    expect(text).toContain(`Price: ${PRICE_PENDING_LABEL}`);
    expect(text).not.toContain("$$");
  });

  it("never treats $$ as a price", () => {
    const block = buildBeachDestinationPreview("Palawan", {
      pricePending: true,
    });
    const text = JSON.stringify(block);
    expect(text).not.toContain('"$"');
    expect(text).not.toContain("$$");
  });
});

describe("preview block validation", () => {
  it("survives sanitiseBlocks with sections intact", () => {
    const block = buildBeachDestinationPreview("Bali", {
      ...detailBlocks(),
      whyItFits: "Easy variety.",
      closingLine: BEACH_PREVIEW_CLOSING_LINE,
    });
    const safe = sanitiseBlocks([JSON.parse(JSON.stringify(block))]);
    expect(safe).toHaveLength(1);
    expect(safe[0].type).toBe("destination_preview");
    if (safe[0].type === "destination_preview") {
      expect(safe[0].sections).toHaveLength(10);
      expect(safe[0].closingLine).toBe(BEACH_PREVIEW_CLOSING_LINE);
    }
  });

  it("rejects a preview with no sections", () => {
    expect(
      isDestinationPreviewBlock({
        type: "destination_preview",
        place: "Bali",
        sections: [],
      }),
    ).toBeNull();
  });

  it("drops a bad section kind and keeps the rest", () => {
    const block = buildBeachDestinationPreview("Bali", {
      whyItFits: "Easy variety.",
    });
    const raw = JSON.parse(JSON.stringify(block)) as Record<string, unknown>;
    (raw.sections as unknown[]).push({ kind: "bogus", heading: "Bogus" });
    const parsed = isDestinationPreviewBlock(raw);
    expect(parsed?.sections).toHaveLength(7);
  });
});

describe("preview follow-up chips", () => {
  function threePreviews(): DestinationPreviewBlock[] {
    return (["Bali", "Maldives", "Palawan"] as const).map(
      (place) =>
        buildBeachDestinationPreview(place, { short: true })!,
    );
  }

  it("lists the design chips under three previews", () => {
    const chips = ruleFollowUps(threePreviews());
    expect(chips.map((c) => c.label)).toEqual([
      "Tell me more about Bali",
      "Tell me more about the Maldives",
      "Tell me more about Palawan",
      "What should I pack for February?",
    ]);
  });

  it("keeps every preview chip free of ranking or choice language", () => {
    const chips = ruleFollowUps(threePreviews());
    for (const chip of chips) {
      expect(chip.label).not.toMatch(/\bbest\b|\bvs\b|winner|pick|choose|rank/i);
      expect(chip.message).not.toMatch(/\bbest\b|\bvs\b|winner|pick|choose|rank/i);
    }
  });

  it("adds no chips under a single preview", () => {
    const single = buildBeachDestinationPreview("Palawan", detailBlocks());
    expect(ruleFollowUps([single!])).toEqual([]);
  });
});
