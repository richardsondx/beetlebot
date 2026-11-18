import { describe, expect, it } from "vitest";
import {
  BEACH_PREVIEW_CLOSING_LINE,
  BEACH_PREVIEW_COPY,
  BEACH_PREVIEW_SET_LINE,
  beachDestinationsNamedInOrder,
  buildBeachDestinationPreview,
} from "../../lib/travel/beach-compare";
import {
  destinationPreviewToText,
  toPlainText,
  type DestinationPreviewBlock,
  type RichBlock,
} from "../../lib/chat/rich-message";
import {
  groupDestinationPreviewBlocks,
  previewAnchorId,
  previewStackActiveIndex,
  previewStackJumpItems,
} from "../../components/chat/blocks/destination-preview-stack";

/** Three short previews in showcase order, no network: the sync builder. */
function threePreviews(
  order: string[] = ["Bali", "Maldives", "Palawan"],
): DestinationPreviewBlock[] {
  return order.map((title, i) => {
    const isLast = i === order.length - 1;
    const preview = buildBeachDestinationPreview(title, {
      short: true,
      whyItFits: "Fits the ask.",
      setLine: isLast ? BEACH_PREVIEW_SET_LINE : undefined,
      closingLine: isLast ? BEACH_PREVIEW_CLOSING_LINE : undefined,
    });
    if (!preview) throw new Error(`no preview for ${title}`);
    return preview;
  });
}

describe("preview stack grouping", () => {
  it("groups three consecutive previews into one stack, in order", () => {
    const previews = threePreviews();
    const grouped = groupDestinationPreviewBlocks(previews);
    expect(grouped).toHaveLength(1);
    expect(Array.isArray(grouped[0])).toBe(true);
    expect((grouped[0] as DestinationPreviewBlock[]).map((p) => p.place)).toEqual([
      "Bali",
      "Maldives",
      "Palawan",
    ]);
  });

  it("keeps the named order, not the seed order", () => {
    const previews = threePreviews(["Palawan", "Bali", "Maldives"]);
    const grouped = groupDestinationPreviewBlocks(previews);
    expect((grouped[0] as DestinationPreviewBlock[]).map((p) => p.place)).toEqual([
      "Palawan",
      "Bali",
      "Maldives",
    ]);
  });

  it("leaves a lone preview ungrouped", () => {
    const [single] = threePreviews(["Palawan"]);
    const grouped = groupDestinationPreviewBlocks([single]);
    expect(grouped).toHaveLength(1);
    expect(Array.isArray(grouped[0])).toBe(false);
    expect((grouped[0] as RichBlock).type).toBe("destination_preview");
  });

  it("groups only the preview run and passes other blocks through", () => {
    const previews = threePreviews();
    const text: RichBlock = { type: "text_block", text: "Before" };
    const grouped = groupDestinationPreviewBlocks([text, ...previews]);
    expect(grouped).toHaveLength(2);
    expect(grouped[0]).toBe(text);
    expect((grouped[1] as DestinationPreviewBlock[]).map((p) => p.place)).toEqual([
      "Bali",
      "Maldives",
      "Palawan",
    ]);
  });
});

describe("jump bar", () => {
  it("lists one item per preview, in showcase order", () => {
    expect(previewStackJumpItems(threePreviews())).toEqual([
      "Bali",
      "Maldives",
      "Palawan",
    ]);
    expect(
      previewStackJumpItems(threePreviews(["Maldives", "Palawan", "Bali"])),
    ).toEqual(["Maldives", "Palawan", "Bali"]);
  });

  it("gives each place a distinct anchor id", () => {
    const ids = threePreviews().map((p) => previewAnchorId(p.place));
    expect(ids).toEqual([
      "destination-preview-bali",
      "destination-preview-maldives",
      "destination-preview-palawan",
    ]);
    expect(new Set(ids).size).toBe(3);
  });
});

describe("swipe and dot state", () => {
  it("reads the dot index from the scroll position", () => {
    // Three pages across a 900px-wide scroll area.
    expect(previewStackActiveIndex(3, 0, 900)).toBe(0);
    expect(previewStackActiveIndex(3, 300, 900)).toBe(1);
    expect(previewStackActiveIndex(3, 600, 900)).toBe(2);
  });

  it("rounds to the nearest page, not the floor", () => {
    expect(previewStackActiveIndex(3, 200, 900)).toBe(1);
    expect(previewStackActiveIndex(3, 100, 900)).toBe(0);
  });

  it("clamps past the ends and handles empty input", () => {
    expect(previewStackActiveIndex(3, 9000, 900)).toBe(2);
    expect(previewStackActiveIndex(3, -50, 900)).toBe(0);
    expect(previewStackActiveIndex(0, 0, 0)).toBe(0);
  });
});

describe("set line and closing line after the third preview", () => {
  it("puts the set line and closing line on the last preview only", () => {
    const previews = threePreviews();
    expect(previews[0].setLine).toBeUndefined();
    expect(previews[0].closingLine).toBeUndefined();
    expect(previews[1].setLine).toBeUndefined();
    expect(previews[1].closingLine).toBeUndefined();
    expect(previews[2].setLine).toBe(BEACH_PREVIEW_SET_LINE);
    expect(previews[2].closingLine).toBe(BEACH_PREVIEW_CLOSING_LINE);
  });

  it("prints the set line then the closing line after the third preview in plain text", () => {
    const previews = threePreviews();
    const text = toPlainText({ text: "", blocks: previews });
    const setAt = text.indexOf(BEACH_PREVIEW_SET_LINE);
    const closeAt = text.indexOf(BEACH_PREVIEW_CLOSING_LINE);
    const thirdAt = text.indexOf("Palawan, an island in the Philippines");
    expect(setAt).toBeGreaterThan(thirdAt);
    expect(closeAt).toBeGreaterThan(setAt);
    expect(text).not.toMatch(/differ|versus|\bvs\b|winner|rank/i);
  });
});

describe("showcase copy: no comparison wording", () => {
  it("rewrites the Maldives trade-offs without ranking it against the others", () => {
    const preview = buildBeachDestinationPreview("Maldives", {});
    const honest = preview!.sections.find((s) => s.kind === "honest_take");
    const tradeOffs = honest!.rows!.find((r) => r.label === "Trade-offs")!;
    expect(tradeOffs.value).toBe(
      "The nightly cost is high. Little to do beyond the island. Getting there can add a boat or seaplane transfer.",
    );
  });

  it("rewrites the Palawan good-for without pricing it against the Maldives", () => {
    const preview = buildBeachDestinationPreview("Palawan", {});
    const honest = preview!.sections.find((s) => s.kind === "honest_take");
    const goodFor = honest!.rows!.find((r) => r.label === "Good for")!;
    expect(goodFor.value).toBe(
      "Scenery and boat days, with a modest nightly cost.",
    );
  });

  it("keeps the Sample figures as facts: $890 Maldives, $310 Palawan", () => {
    const maldives = buildBeachDestinationPreview("Maldives", {});
    const palawan = buildBeachDestinationPreview("Palawan", {});
    const nightly = (p: DestinationPreviewBlock) =>
      p.sections.find((s) => s.kind === "practical_notes")!.practical!.nightly;
    expect(nightly(maldives!)).toBe("$890 per night Sample");
    expect(nightly(palawan!)).toBe("$310 per night Sample");
  });

  it("holds no comparative wording anywhere in the preview copy", () => {
    const banned = [
      "of the three",
      "than the",
      "highest",
      "lowest",
      "cheaper",
      "lower nightly",
      "more expensive",
      "best of",
    ];
    for (const [place, copy] of Object.entries(BEACH_PREVIEW_COPY)) {
      const text = [
        copy.whatItIsLike,
        ...copy.highlights,
        copy.bestTime,
        copy.goodFor,
        copy.suits,
        copy.tradeOffs,
        copy.stayWhy,
        copy.gettingThere,
      ].join(" ");
      for (const phrase of banned) {
        expect(
          text.toLowerCase(),
          `${place} copy must not contain "${phrase}"`,
        ).not.toContain(phrase);
      }
      // The full plain-text render of each preview is comparison-free too.
      expect(
        destinationPreviewToText(buildBeachDestinationPreview(place, {})!),
      ).not.toMatch(/of the three|than the Maldives|than the Bali|than the Palawan/i);
    }
  });
});

describe("showcase order follows the ask", () => {
  it("returns the places in the order the user named them", () => {
    expect(
      beachDestinationsNamedInOrder("Palawan vs Bali vs Maldives, which should I pick?"),
    ).toEqual(["Palawan", "Bali", "Maldives"]);
    expect(
      beachDestinationsNamedInOrder("Maldives and Bali for February?"),
    ).toEqual(["Maldives", "Bali"]);
    expect(beachDestinationsNamedInOrder("Tell me more about Palawan")).toEqual([
      "Palawan",
    ]);
    expect(beachDestinationsNamedInOrder("Plan a beach trip")).toEqual([]);
  });
});
