import { describe, expect, it, vi, afterEach } from "vitest";
import { runResearchLoop } from "../../lib/chat/research-loop";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("research loop", () => {
  it("returns ranked recommendations from diverse sources", async () => {
    vi.spyOn(global, "fetch").mockImplementation(async (input: string | URL | Request) => {
      const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      const hostname = new URL(rawUrl).hostname.replace(/^www\./, "");
      return new Response(
        `<html><head><title>${hostname} guide 2026</title></head><body><main>${hostname} has curated fresh options with romantic restaurants and weekend events in Toronto under $120.</main></body></html>`,
        {
          status: 200,
          headers: { "content-type": "text/html" },
        },
      );
    });

    const result = await runResearchLoop({
      userMessage: "find fresh romantic toronto weekend ideas under $120",
      tasteHints: ["romantic", "curated"],
      constraints: {
        categories: ["restaurants"],
        vibes: ["romantic"],
        locations: ["toronto"],
        budgets: ["under $120"],
        timeWindows: ["this weekend"],
        dislikedSourcePatterns: [],
      },
      signals: {
        noveltyPreference: "fresh",
        sourceDiversityTarget: 3,
        boredomSignal: true,
      },
      packDataSources: [
        {
          url: "https://example.com/custom-list",
          label: "Custom List",
        },
      ],
      maxFetches: 5,
    });

    expect(result.recommendations.length).toBeGreaterThan(0);
    const domains = new Set(result.recommendations.map((r) => r.domain));
    expect(domains.size).toBeGreaterThanOrEqual(2);
    expect(result.recommendations[0]?.whyItFits.length).toBeGreaterThan(10);
  });
});
