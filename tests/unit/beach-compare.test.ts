import { describe, expect, it } from "vitest";
import {
  BEACH_COMPARE_CAP,
  BEACH_COUNTRY,
  BEACH_DESTINATIONS,
  applyBeachCompareRows,
  buildBeachCompareOptionSet,
  isBeachCompareTitles,
} from "../../lib/travel/beach-compare";
import {
  isHotelSetBlock,
  toPlainText,
} from "../../lib/chat/rich-message";
import { sanitiseBlocks } from "../../lib/chat/safety";

describe("beach compare geography", () => {
  it("checks every place label against the geography rule", () => {
    expect(BEACH_COUNTRY.Bali).toBe("Indonesia");
    expect(BEACH_COUNTRY.Maldives).toBe("Maldives");
    expect(BEACH_COUNTRY.Palawan).toBe("Philippines");
    for (const dest of BEACH_DESTINATIONS) {
      expect(dest.country).toBe(BEACH_COUNTRY[dest.title]);
    }
  });

  it("caps the compare at 3 options in fixed order", () => {
    expect(BEACH_COMPARE_CAP).toBe(3);
    expect(BEACH_DESTINATIONS.map((d) => d.title)).toEqual([
      "Bali",
      "Maldives",
      "Palawan",
    ]);
  });
});

describe("beach compare option set", () => {
  it("renders 3 options, each with a hotel name and a Sample price", () => {
    const set = buildBeachCompareOptionSet();
    expect(set.variant).toBe("compare");
    expect(set.prompt).toBe("Which beach?");
    expect(set.items).toHaveLength(3);
    for (const { card } of set.items) {
      expect(card.category).toBe("Beach");
      const rows = Object.fromEntries(
        (card.compareRows ?? []).map((r) => [r.label, r.value]),
      );
      expect(rows.Hotel).toBeTruthy();
      expect(rows["Per night"]).toContain("Sample");
      expect(rows.Flight).toContain("Sample");
      expect(card.meta?.hotel).toBe(rows.Hotel);
    }
  });

  it("writes the plain text fallback in the Opus format", () => {
    const set = buildBeachCompareOptionSet();
    const text = toPlainText({
      text: "Three beaches fit a February trip for two.",
      blocks: [set],
    });
    expect(text).toContain(
      "1. Bali, Indonesia — Alila Villas Uluwatu — $420 (Sample) — https://en.wikipedia.org/wiki/Bali",
    );
    expect(text).toContain("2. Maldives, Maldives — Soneva Fushi —");
    expect(text).toContain("3. Palawan, Philippines — Pangulasian Island Resort —");
  });

  it("spots a beach compare from model option titles", () => {
    expect(isBeachCompareTitles(["Bali", "Maldives", "Palawan"])).toBe(true);
    expect(isBeachCompareTitles(["Bali", "Maldives"])).toBe(false);
    expect(isBeachCompareTitles(["Bali", "Maldives", "Hawaii"])).toBe(false);
  });

  it("drops a placehold.co image to the named fallback", () => {
    const cards = applyBeachCompareRows([
      {
        type: "image_card",
        title: "Bali",
        imageUrl: "https://placehold.co/600x360/0d1826/4a7fbd?text=Bali",
      },
    ]);
    expect(cards[0].imageUrl).toBe("");
    expect(cards[0].compareRows?.find((r) => r.label === "Hotel")?.value).toBe(
      "Alila Villas Uluwatu",
    );
  });
});

describe("hotel photoUrl", () => {
  it("parses photoUrl, photoSourceName, and photoFallback on HotelCard", () => {
    const block = isHotelSetBlock({
      type: "hotel_set",
      stay: { checkIn: "2026-12-11", checkOut: "2026-12-14", adults: 2 },
      checkedAt: "2026-11-16",
      hotels: [
        {
          id: "beach-bali",
          name: "Alila Villas Uluwatu",
          area: "Uluwatu, Bali",
          stars: 5,
          price: {
            nightly: 420,
            total: 2100,
            currency: "USD",
            adults: 2,
            nights: 5,
            derived: false,
          },
          source: "Sample",
          sourceUrl: "https://en.wikipedia.org/wiki/Bali",
          checkedAt: null,
          photoUrl: "https://example.com/hotel.jpg",
          photoSourceName: "Wikipedia",
        },
        {
          id: "beach-maldives",
          name: "Soneva Fushi",
          area: "Baa Atoll, Maldives",
          stars: 5,
          price: null,
          source: "Sample",
          sourceUrl: "https://en.wikipedia.org/wiki/Maldives",
          checkedAt: null,
          photoFallback: "No hotel photo found",
        },
      ],
    });
    expect(block?.hotels[0].photoUrl).toBe("https://example.com/hotel.jpg");
    expect(block?.hotels[0].photoSourceName).toBe("Wikipedia");
    expect(block?.hotels[1].photoUrl).toBeUndefined();
    expect(block?.hotels[1].photoFallback).toBe("No hotel photo found");
    const text = toPlainText({ text: "", blocks: [block!] });
    expect(text).toContain("(photo: Wikipedia https://example.com/hotel.jpg)");
    expect(text).toContain("(no hotel photo: No hotel photo found)");
  });

  it("keeps compare variant, category, and compare rows through sanitiseBlocks", () => {
    const safe = sanitiseBlocks([
      {
        type: "option_set",
        prompt: "Which beach?",
        variant: "compare",
        items: buildBeachCompareOptionSet().items.map((item, i) => ({
          index: i + 1,
          card: { ...item.card, imageUrl: "" },
        })),
      },
    ]);
    expect(safe).toHaveLength(1);
    const set = safe[0];
    expect(set.type).toBe("option_set");
    if (set.type === "option_set") {
      expect(set.variant).toBe("compare");
      expect(set.items[0].card.category).toBe("Beach");
      expect(set.items[0].card.compareRows?.length).toBe(4);
    }
  });
});
