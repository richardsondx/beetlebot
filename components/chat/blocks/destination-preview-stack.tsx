"use client";

import { useRef, useState } from "react";
import type {
  DestinationPreviewBlock,
  RichBlock,
} from "@/lib/chat/rich-message";
import { DestinationPreviewView } from "@/components/chat/blocks/destination-preview";

/**
 * Three-place showcase stack (design section 3, amended: a showcase,
 * not a pick). Three full previews in the order the places were named,
 * a small jump bar at the top, and nothing that compares them: no
 * "vs", no differences paragraph, no winner, no ranking, no choice
 * language. Desktop stacks all three vertically; on phone widths one
 * preview shows at a time with a swipe and dots below. The set line
 * and closing line live on the last preview block, so they render
 * after the third preview in both layouts.
 */

/** Anchor id for one preview, so the jump bar can scroll to it. */
export function previewAnchorId(place: string): string {
  return `destination-preview-${place
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;
}

/** Jump bar items, in showcase order: one per preview place. */
export function previewStackJumpItems(
  previews: DestinationPreviewBlock[],
): string[] {
  return previews.map((preview) => preview.place);
}

/**
 * Dot index from a horizontal scroll position, the same rounding the
 * compare OptionSet uses: the nearest page wins. Clamped to the
 * preview count, so a short scroll never points past the last dot.
 */
export function previewStackActiveIndex(
  count: number,
  scrollLeft: number,
  scrollWidth: number,
): number {
  if (count <= 0 || scrollWidth <= 0) return 0;
  const index = Math.round(scrollLeft / (scrollWidth / count));
  return Math.max(0, Math.min(count - 1, index));
}

/**
 * Group runs of two or more consecutive destination_preview blocks
 * into one stack; every other block passes through untouched, and a
 * lone preview stays a lone preview. Pure, so the grouping is
 * unit-testable without rendering.
 */
export function groupDestinationPreviewBlocks(
  blocks: RichBlock[],
): Array<RichBlock | DestinationPreviewBlock[]> {
  const out: Array<RichBlock | DestinationPreviewBlock[]> = [];
  let run: DestinationPreviewBlock[] = [];
  const flush = () => {
    if (run.length >= 2) out.push([...run]);
    else run.forEach((block) => out.push(block));
    run = [];
  };
  for (const block of blocks) {
    if (block.type === "destination_preview") run.push(block);
    else {
      flush();
      out.push(block);
    }
  }
  flush();
  return out;
}

export function DestinationPreviewStackView({
  blocks,
}: {
  blocks: DestinationPreviewBlock[];
}) {
  const [active, setActive] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const onScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    setActive(
      previewStackActiveIndex(blocks.length, el.scrollLeft, el.scrollWidth),
    );
  };

  const jumpTo = (index: number) => {
    setActive(index);
    // One handler for both layouts: on desktop the anchor sits in the
    // stacked page flow, so this scrolls the page to the preview; on
    // phone the anchor sits inside the horizontal snap container, so
    // this slides the container to that preview. The scroll event then
    // keeps the dots in step.
    document
      .getElementById(previewAnchorId(blocks[index].place))
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mt-3">
      <div
        className="flex flex-wrap gap-2"
        role="navigation"
        aria-label="Jump to a place"
      >
        {blocks.map((block, i) => (
          <button
            key={block.place}
            type="button"
            onClick={() => jumpTo(i)}
            aria-current={active === i}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
              active === i
                ? "border-[#1C1B19] bg-[#1C1B19] text-white"
                : "border-[#E7E5E0] text-[#1C1B19] hover:bg-[#F2F1EE]"
            }`}
          >
            {block.place}
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex gap-3 overflow-x-auto pb-2 sm:block sm:overflow-visible sm:pb-0"
        style={{ scrollSnapType: "x mandatory" }}
      >
        {blocks.map((block) => (
          <div
            key={block.place}
            id={previewAnchorId(block.place)}
            className="w-full shrink-0 sm:w-auto"
            style={{ scrollSnapAlign: "start" }}
          >
            <DestinationPreviewView block={block} />
          </div>
        ))}
      </div>

      <div
        className="mt-2 flex justify-center gap-1.5 sm:hidden"
        aria-label={`Preview ${active + 1} of ${blocks.length}`}
      >
        {blocks.map((block, i) => (
          <button
            key={block.place}
            type="button"
            onClick={() => jumpTo(i)}
            aria-label={`Show ${block.place}`}
            className={`h-2 w-2 rounded-full ${
              i === active ? "bg-[#1C1B19]" : "bg-[#D8D5CF]"
            }`}
          />
        ))}
      </div>
    </div>
  );
}
