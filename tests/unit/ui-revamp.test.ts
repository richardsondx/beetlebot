import { describe, expect, it } from "vitest";
import { PACK_ICONS, getPackVisual } from "@/lib/pack-icons";
import { formatDayLabel, groupByDay } from "@/lib/date-groups";

describe("pack visuals", () => {
  it("maps all 15 seed slugs", () => {
    expect(Object.keys(PACK_ICONS)).toHaveLength(15);
    expect(getPackVisual("flights-compare")).toEqual({ icon: "Plane", tint: "blue" });
    expect(getPackVisual("holidays-canada")).toEqual({ icon: "Flag", tint: "rose" });
  });

  it("falls back to Puzzle with a stable tint for unknown slugs", () => {
    const a = getPackVisual("some-new-pack");
    const b = getPackVisual("some-new-pack");
    expect(a.icon).toBe("Puzzle");
    expect(a).toEqual(b);
  });
});

describe("date groups", () => {
  const now = new Date(2026, 5, 14, 12, 0, 0); // Sun Jun 14 2026
  it("labels Today / Tomorrow / Yesterday / dated", () => {
    expect(formatDayLabel(new Date(2026, 5, 14, 9), now)).toBe("Today");
    expect(formatDayLabel(new Date(2026, 5, 15, 9), now)).toBe("Tomorrow");
    expect(formatDayLabel(new Date(2026, 5, 13, 9), now)).toBe("Yesterday");
    expect(formatDayLabel(new Date(2026, 5, 20, 9), now)).toBe("Sat, Jun 20");
    expect(formatDayLabel(new Date(2025, 5, 20, 9), now)).toBe("Fri, Jun 20, 2025");
  });

  it("groups by day ascending", () => {
    const groups = groupByDay(
      [
        { at: new Date(2026, 5, 15, 9) },
        { at: new Date(2026, 5, 14, 9) },
        { at: new Date(2026, 5, 14, 18) },
      ],
      (x) => x.at,
      now,
    );
    expect(groups.map((g) => g.label)).toEqual(["Today", "Tomorrow"]);
    expect(groups[0].items).toHaveLength(2);
  });
});
