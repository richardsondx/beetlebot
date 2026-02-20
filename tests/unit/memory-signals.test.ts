import { describe, expect, it } from "vitest";
import {
  deriveRecommendationSignals,
  extractRecommendationConstraints,
} from "../../lib/repositories/memory";

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
});
