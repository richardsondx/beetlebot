import { describe, expect, it } from "vitest";
import { formatFlightRange } from "../../lib/travel/compare";

describe("formatFlightRange", () => {
  it("shows one date when the leg starts and ends the same day", () => {
    expect(formatFlightRange("2026-12-11T18:50:00", "2026-12-11T20:46:00")).toBe(
      "Fri, Dec 11, 6:50 PM – 8:46 PM",
    );
  });

  it("shows both dates when the leg crosses midnight", () => {
    expect(formatFlightRange("2026-12-11T22:10:00", "2026-12-12T01:05:00")).toBe(
      "Fri, Dec 11, 10:10 PM – Sat, Dec 12, 1:05 AM",
    );
  });

  it("falls back to the raw strings when a time is not a date", () => {
    expect(formatFlightRange("soon", "later")).toBe("soon to later");
  });
});
