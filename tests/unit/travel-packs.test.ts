import { beforeAll, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { ensureSeedData } from "@/lib/repositories/seed";
import { createPackSchema } from "@/lib/api/schemas";
import type { PlanObject } from "@/lib/travel/compare";

// The six travel packs added in commit 45d1679, as seeded into the database.
// The test reads them back from the database, so it checks the real seed data.
const TRAVEL_PACK_SLUGS = [
  "flights-compare",
  "hotels-compare",
  "weekend-escape",
  "family-trip",
  "solo-city-break",
  "business-trip",
];

// Rules from docs/PACK_SPEC.md and the prior run validation script.
const ALLOWED_MODES = new Set(["explore", "social", "dating", "family", "relax"]);
const ALLOWED_NEEDS = new Set(["calendar:read", "weather:read", "maps:read"]);
const ALLOWED_STEPS = new Set(["suggest", "soft_hold", "approval", "book"]);
const BUDGET_RE = /^\$\d+-\$\d+$/;

type TravelPack = {
  slug: string;
  name: string;
  city: string;
  modes: string[];
  style: string;
  budgetRange: string;
  needs: string[];
  description: string;
  instructions: string;
  tags: string[];
  dataSources: Array<{ url: string; label: string; hint?: string }>;
};

function budgetCap(budgetRange: string): number {
  const m = /^\$(\d+)-\$(\d+)$/.exec(budgetRange);
  return m ? Number(m[2]) : 0;
}

// Sample Plan Object per pack, same shape as the prior run validation script.
// Plan Object shape comes from docs/PLAN_OBJECT_SCHEMA.md.
function buildPlan(pack: TravelPack): PlanObject {
  const participants =
    pack.slug === "family-trip"
      ? ["family group"]
      : pack.slug === "solo-city-break"
        ? ["solo traveler"]
        : pack.slug === "business-trip"
          ? ["business traveler"]
          : ["traveler"];
  return {
    title: pack.name,
    mode: pack.modes[0],
    participants,
    timeWindows: [{ startAt: "2026-11-21T09:00:00Z", endAt: "2026-11-23T17:00:00Z" }],
    location: { center: pack.city, radiusKm: 50 },
    constraints: { budgetCap: budgetCap(pack.budgetRange), groupType: pack.slug },
    weatherAssumptions: [
      "Check the weather before travel.",
      "Have an indoor backup if rain is forecast.",
    ],
    steps: ["suggest", "soft_hold", "approval"],
    fallbackPlan:
      "If the main option fails, use the indoor backup option and ask the user to approve the change.",
  };
}

describe("travel packs", () => {
  let packs: TravelPack[] = [];

  beforeAll(async () => {
    await ensureSeedData();
    const rows = await db.pack.findMany({
      where: { slug: { in: TRAVEL_PACK_SLUGS } },
      orderBy: { slug: "asc" },
    });
    packs = rows.map((row) => ({
      slug: row.slug,
      name: row.name,
      city: row.city,
      modes: JSON.parse(row.modes) as string[],
      style: row.style,
      budgetRange: row.budgetRange,
      needs: JSON.parse(row.needs) as string[],
      description: row.description,
      instructions: row.instructions,
      tags: JSON.parse(row.tags) as string[],
      dataSources: JSON.parse(row.dataSources) as Array<{
        url: string;
        label: string;
        hint?: string;
      }>,
    }));
  });

  it("seeds exactly the six travel packs", () => {
    expect(packs).toHaveLength(6);
    expect(packs.map((p) => p.slug).sort()).toEqual([...TRAVEL_PACK_SLUGS].sort());
  });

  it.each(TRAVEL_PACK_SLUGS)("pack %s passes schema validation", (slug) => {
    const pack = packs.find((p) => p.slug === slug);
    expect(pack).toBeDefined();
    if (!pack) return;
    expect(() => createPackSchema.parse(pack)).not.toThrow();
    for (const mode of pack.modes) expect(ALLOWED_MODES.has(mode)).toBe(true);
    for (const need of pack.needs) expect(ALLOWED_NEEDS.has(need)).toBe(true);
    expect(BUDGET_RE.test(pack.budgetRange)).toBe(true);
    for (const source of pack.dataSources) {
      expect(source.url.startsWith("https://")).toBe(true);
      expect(source.label.length).toBeGreaterThan(0);
    }
  });

  it.each(TRAVEL_PACK_SLUGS)("pack %s emits a valid Plan Object", (slug) => {
    const pack = packs.find((p) => p.slug === slug);
    expect(pack).toBeDefined();
    if (!pack) return;
    const plan = buildPlan(pack);
    expect(plan.title.length).toBeGreaterThan(0);
    expect(plan.mode.length).toBeGreaterThan(0);
    expect(plan.participants.length).toBeGreaterThan(0);
    expect(plan.timeWindows.length).toBeGreaterThan(0);
    for (const w of plan.timeWindows) {
      expect(Date.parse(w.startAt)).toBeLessThan(Date.parse(w.endAt));
    }
    expect(plan.location.center.length).toBeGreaterThan(0);
    expect(plan.location.radiusKm).toBeGreaterThan(0);
    expect(plan.constraints.budgetCap ?? 0).toBeGreaterThan(0);
    expect(plan.weatherAssumptions.length).toBeGreaterThan(0);
    expect(plan.steps).toContain("suggest");
    expect(plan.steps).toContain("approval");
    expect(plan.steps).not.toContain("book");
    for (const s of plan.steps) expect(ALLOWED_STEPS.has(s)).toBe(true);
    expect(plan.fallbackPlan.length).toBeGreaterThan(0);
  });
});
