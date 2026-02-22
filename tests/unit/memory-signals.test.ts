import { describe, expect, it } from "vitest";
import {
  deriveRecommendationSignals,
  extractRecommendationConstraints,
  getPreferenceProfile,
  upsertMemory,
} from "../../lib/repositories/memory";
import { db } from "../../lib/db";

describe("recommendation memory selectors", () => {
  it("extracts constraints from user request", () => {
    const constraints = extractRecommendationConstraints({
      message:
        "Find new romantic restaurants in Toronto for this weekend under $120. Avoid reddit suggestions.",
      tasteHints: ["quiet", "curated"],
    });

    expect(constraints.categories).toContain("restaurants");
    expect(constraints.locations).toContain("toronto");
    expect(constraints.timeWindows).toContain("this weekend");
    expect(constraints.dislikedSourcePatterns).toContain("reddit");
  });

  it("derives novelty and boredom signals", () => {
    const signals = deriveRecommendationSignals({
      message: "These standard options feel boring. Find fresh original sources.",
      tasteHints: ["surprise me"],
    });

    expect(signals.boredomSignal).toBe(true);
    expect(signals.noveltyPreference).toBe("fresh");
    expect(signals.sourceDiversityTarget).toBeGreaterThanOrEqual(4);
  });

  it("exposes home-area preference in known profile dimensions", async () => {
    await db.memoryEntry.deleteMany({ where: { key: "home_area" } });
    await upsertMemory({
      bucket: "profile_memory",
      key: "home_area",
      value: "Queen West",
      source: "inferred",
      confidence: 0.9,
    });
    const profile = await getPreferenceProfile();
    expect(profile.known["home area for nearby recommendations"]).toBe("Queen West");
  });
});
