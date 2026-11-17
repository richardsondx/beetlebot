import { describe, expect, it } from "vitest";
import {
  FLIGHT_SEARCH,
  durationToMinutes,
  flightOptionsToCards,
} from "../../lib/travel/compare";
import { parseTripQuery } from "../../lib/travel/trip-parse";
import { effectiveTripQuery, formatIsoDuration, searchFlights } from "../../lib/tools/duffel-flights";
import {
  derivedNightly,
  extractTotalFromHtml,
  nightsBetween,
} from "../../lib/travel/hotel-prices";
import {
  extractFollowUps,
  mergeFollowUps,
  ruleFollowUps,
} from "../../lib/chat/follow-ups";
import { toPlainText } from "../../lib/chat/rich-message";
import { sanitiseBlocks } from "../../lib/chat/safety";
import {
  encodeSseEvent,
  mapChatError,
  splitTextDeltas,
} from "../../lib/chat/stream";
import { toFlightCompareBlock } from "../../lib/tools/duffel-flights";

describe("parseTripQuery", () => {
  it("parses the Weekend trip card into the Toronto to New York trip", () => {
    const query = parseTripQuery(
      "Weekend in New York from Toronto, Fri to Mon, 1 adult",
      new Date("2026-11-17T12:00:00"),
    );
    expect(query).not.toBeNull();
    expect(query?.originCode).toBe("YYZ");
    expect(query?.destinationCode).toBe("NYC");
    expect(query?.adults).toBe(1);
    // "Fri to Mon" from Tue Nov 17 is the coming weekend, not the snapshot.
    expect(query?.depart).toBe("2026-11-20");
    expect(query?.return).toBe("2026-11-23");
    expect(query?.matchedSnapshot).toBe(false);
  });

  it("matches the snapshot when the dates are Dec 11 to 14", () => {
    const query = parseTripQuery("Flights Toronto to New York Dec 11 to Dec 14, 1 adult");
    expect(query?.matchedSnapshot).toBe(true);
    expect(query?.depart).toBe("2026-12-11");
    expect(query?.return).toBe("2026-12-14");
  });

  it("returns null when no destination is named", () => {
    expect(parseTripQuery("Plan my Friday under $120")).toBeNull();
    expect(parseTripQuery("Toronto")).toBeNull();
  });

  it("reads the adult count", () => {
    const query = parseTripQuery("New York from Toronto Dec 11 to Dec 14, 2 adults");
    expect(query?.adults).toBe(2);
  });
});

describe("flight snapshot cards", () => {
  it("maps the snapshot to three tagged cards", () => {
    const cards = flightOptionsToCards(FLIGHT_SEARCH.options);
    expect(cards).toHaveLength(3);
    const delta = cards.find((c) => c.airline === "Delta Air Lines");
    expect(delta?.totalAmount).toBe(377.68);
    expect(delta?.tags).toContain("Lowest price");
    const porter = cards.find((c) => c.airline === "Porter Airlines");
    expect(porter?.tags).toContain("Fastest");
    const airCanada = cards.find((c) => c.airline === "Air Canada");
    expect(airCanada?.tags).toContain("Fewest stops");
    for (const card of cards) {
      expect(card.tags.length).toBeLessThanOrEqual(1);
    }
  });

  it("searchFlights falls back to the snapshot without a token", async () => {
    delete process.env.DUFFEL_ACCESS_TOKEN;
    const query = parseTripQuery("Weekend in New York from Toronto, Fri to Mon, 1 adult")!;
    const result = await searchFlights(query);
    expect(result.source).toBe("duffel_snapshot");
    expect(result.offersTotal).toBe(1179);
    expect(result.cards).toHaveLength(3);
    expect(result.cards.every((c) => c.tags.includes("Sample"))).toBe(true);
    // The prices shown are the snapshot dates, never the parsed weekend.
    expect(result.query.depart).toBe("2026-12-11");
    expect(result.query.return).toBe("2026-12-14");
  });

  it("effectiveTripQuery maps to snapshot dates without a token", () => {
    delete process.env.DUFFEL_ACCESS_TOKEN;
    const query = parseTripQuery("Weekend in New York from Toronto, Fri to Mon, 1 adult")!;
    const effective = effectiveTripQuery(query);
    expect(effective.depart).toBe("2026-12-11");
    expect(effective.return).toBe("2026-12-14");
  });

  it("builds a flight_compare block with the compare link", async () => {
    delete process.env.DUFFEL_ACCESS_TOKEN;
    const query = parseTripQuery("Weekend in New York from Toronto, Fri to Mon, 1 adult")!;
    const result = await searchFlights(query);
    const block = toFlightCompareBlock(result);
    expect(block.type).toBe("flight_compare");
    expect(block.compareUrl).toBe(
      "/travel/compare?from=YYZ&to=NYC&depart=2026-12-11&return=2026-12-14&adults=1",
    );
    const text = toPlainText({ text: "Here are your flights.", blocks: [block] });
    expect(text).toContain("Delta");
    expect(text).toContain("CA$377.68");
    expect(text).toContain("Compare all:");
  });

  it("parses ISO durations and minute totals", () => {
    expect(formatIsoDuration("PT1H56M")).toBe("1h 56m");
    expect(formatIsoDuration("PT45M")).toBe("45m");
    expect(durationToMinutes("3h18m")).toBe(198);
    expect(durationToMinutes("1h56m")).toBe(116);
  });
});

describe("hotel prices", () => {
  it("derives a nightly rate from the stay total", () => {
    expect(derivedNightly(1362, 3)).toBe(454);
    expect(nightsBetween("2026-12-11", "2026-12-14")).toBe(3);
  });

  it("extracts a total near the word total, and null otherwise", () => {
    expect(extractTotalFromHtml("<p>Stay total $1,362 for 3 nights</p>")).toBe(1362);
    expect(extractTotalFromHtml("<p>No prices here</p>")).toBeNull();
  });
});

describe("follow-ups", () => {
  it("strips a <followups> tag and returns its items", () => {
    const { text, items } = extractFollowUps(
      'Here are your flights. <followups>["Show hotels in Brooklyn", "Only nonstop flights"]</followups>',
    );
    expect(text).toBe("Here are your flights.");
    expect(items).toHaveLength(2);
    expect(items[0].message).toBe("Show hotels in Brooklyn");
  });

  it("drops a malformed tag quietly", () => {
    const { text, items } = extractFollowUps("Hello <followups>not json</followups>");
    expect(text).toBe("Hello");
    expect(items).toEqual([]);
  });

  it("rule chips come from the flight block, capped at four", async () => {
    delete process.env.DUFFEL_ACCESS_TOKEN;
    const query = parseTripQuery("Weekend in New York from Toronto, Fri to Mon, 1 adult")!;
    const result = await searchFlights(query);
    const block = toFlightCompareBlock(result);
    const rules = ruleFollowUps([block]);
    expect(rules).toHaveLength(4);
    expect(rules[0].label).toBe("Show hotels in Brooklyn");
    const merged = mergeFollowUps({
      model: [{ label: "Model chip", message: "Model chip" }],
      blocks: [block],
    });
    expect(merged).toHaveLength(4);
    expect(merged.map((c) => c.label)).not.toContain("Model chip");
  });
});

describe("block safety", () => {
  it("keeps flight_compare and hotel_set blocks, drops unknown types", () => {
    const safe = sanitiseBlocks([
      {
        type: "flight_compare",
        searchId: "s1",
        query: {
          origin: "Toronto",
          destination: "New York",
          originCode: "YYZ",
          destinationCode: "NYC",
          depart: "2026-12-11",
          return: "2026-12-14",
          adults: 1,
        },
        offers: [
          {
            id: "/offers/0",
            airline: "Delta Air Lines",
            outbound: {
              from: "YYZ",
              to: "LGA",
              departAt: "2026-12-11T18:50:00",
              arriveAt: "2026-12-11T20:46:00",
              duration: "1h56m",
              stops: 0,
              flightNumbers: ["DL5154"],
            },
            return: {
              from: "LGA",
              to: "YYZ",
              departAt: "2026-12-14T07:15:00",
              arriveAt: "2026-12-14T09:10:00",
              duration: "1h55m",
              stops: 0,
              flightNumbers: ["DL5187"],
            },
            stops: 0,
            duration: "3h51m",
            totalAmount: 377.68,
            currency: "CAD",
            changeable: true,
            refundable: false,
            carryOnBags: 1,
            tags: ["Lowest price"],
          },
        ],
        source: "duffel_snapshot",
        checkedAt: "2026-11-16T23:27:40Z",
        offersTotal: 1179,
        compareUrl: "/travel/compare",
      },
      { type: "mystery_block", text: "drop me" },
    ]);
    expect(safe).toHaveLength(1);
    expect(safe[0].type).toBe("flight_compare");
  });
});

describe("chat stream", () => {
  it("encodes one SSE event as two lines", () => {
    expect(encodeSseEvent({ event: "status", data: { text: "Reading" } })).toBe(
      'event: status\ndata: {"text":"Reading"}\n\n',
    );
  });

  it("splits text into word chunks", () => {
    const chunks = splitTextDeltas("one two three four five six seven", 3);
    expect(chunks).toEqual(["one two three", "four five six", "seven"]);
  });

  it("maps a model 401 to human wording, never raw JSON", () => {
    const info = mapChatError(new Error("Model request failed (401): User not found"));
    expect(info.code).toBe("MODEL_AUTH");
    expect(info.message).toContain("setup problem");
    expect(info.message).not.toContain("401");
  });

  it("maps a 429 to a retryable rate limit", () => {
    const info = mapChatError(new Error("Model request failed (429): slow down"));
    expect(info.code).toBe("MODEL_RATE_LIMIT");
    expect(info.retryable).toBe(true);
  });
});
