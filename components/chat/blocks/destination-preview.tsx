"use client";

import { useState } from "react";
import type {
  DestinationPreviewBlock,
  DestinationPreviewSection,
} from "@/lib/chat/rich-message";
import { PRICE_PENDING_LABEL } from "@/lib/travel/destination-suggestion";
import { HotelStoryView } from "@/components/chat/blocks/hotel-set";
import { MapStripView } from "@/components/chat/blocks/map-strip";
import { NearbyRowView } from "@/components/chat/blocks/nearby-row";
import { ItineraryTimelineView } from "@/components/chat/blocks/itinerary-timeline";

/**
 * Destination preview: a visual field guide for one place, not a pick
 * grid. A real photo opens it, plain sections say what the place is
 * like, who it suits, and where it falls short, and the hotel appears
 * as part of the story. No Pick button, no aligned price row: Sample
 * figures live only inside Practical notes. In the three-place case
 * the map, nearby, and sample day start collapsed behind one toggle.
 */
export function DestinationPreviewView({
  block,
}: {
  block: DestinationPreviewBlock;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const collapsed = block.sections.filter((s) => s.collapsed);
  const visible = block.sections.filter((s) => !s.collapsed);

  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-[#E7E5E0] bg-white">
      {block.heroPhotoUrl ? (
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={block.heroPhotoUrl}
            alt={`${block.place} photo`}
            className="aspect-[16/9] w-full object-cover"
            loading="lazy"
          />
          {block.heroPhotoSourceName && (
            <span className="absolute bottom-1.5 right-2 text-[10px] text-white drop-shadow">
              Photo: {block.heroPhotoSourceName}
            </span>
          )}
        </div>
      ) : (
        <div className="flex aspect-[16/9] w-full flex-col items-center justify-center gap-2 bg-[#F2F1EE] px-4">
          <span className="text-3xl" aria-hidden="true">
            🏖️
          </span>
          <p className="text-sm font-semibold text-[#1C1B19]">{block.place}</p>
          <p className="max-w-[90%] text-center text-xs text-[#6B6862]">
            {block.heroPhotoFallback || "No photo found"}
          </p>
        </div>
      )}
      <div className="p-4">
        <p className="text-lg font-semibold text-[#1C1B19]">{block.place}</p>
        <p className="text-sm text-[#6B6862]">{block.countryLine}</p>
        {block.wikiUrl && (
          <a
            href={block.wikiUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[#8A5710] underline-offset-2 hover:underline"
          >
            Read more on Wikipedia
          </a>
        )}

        {visible.map((section) => (
          <PreviewSection key={section.kind} block={block} section={section} />
        ))}

        {collapsed.length > 0 && (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setDetailsOpen((v) => !v)}
              aria-expanded={detailsOpen}
              className="rounded-full border border-[#E7E5E0] px-3 py-1.5 text-xs font-semibold text-[#1C1B19] hover:bg-[#F2F1EE]"
            >
              {detailsOpen
                ? "Hide where things are and the sample day"
                : "Show where things are and a sample day"}
            </button>
            {detailsOpen &&
              collapsed.map((section) => (
                <PreviewSection key={section.kind} block={block} section={section} />
              ))}
          </div>
        )}

        {block.setLine && (
          <p className="mt-4 text-sm leading-relaxed text-[#1C1B19]">
            {block.setLine}
          </p>
        )}
        {block.closingLine && (
          <p className="mt-2 text-sm leading-relaxed text-[#6B6862]">
            {block.closingLine}
          </p>
        )}
      </div>
    </div>
  );
}

function SectionLabel({ section }: { section: DestinationPreviewSection }) {
  if (!section.label) return null;
  return (
    <span className="ml-2 align-middle text-[10px] font-medium uppercase tracking-wide text-[#9A968F]">
      {section.label}
      {section.label === "From Wikipedia" && section.sourceUrl && (
        <>
          {" · "}
          <a
            href={section.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="normal-case tracking-normal text-[#8A5710] underline-offset-2 hover:underline"
          >
            Source
          </a>
        </>
      )}
    </span>
  );
}

function PreviewSection({
  block,
  section,
}: {
  block: DestinationPreviewBlock;
  section: DestinationPreviewSection;
}) {
  switch (section.kind) {
    case "what_it_is_like":
    case "why_it_fits":
    case "best_time":
      if (!section.body) return null;
      return (
        <div className="mt-4">
          <p className="text-sm font-semibold text-[#1C1B19]">
            {section.heading}
            <SectionLabel section={section} />
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[#6B6862]">
            {section.body}
          </p>
        </div>
      );
    case "highlights":
      if (!section.bullets?.length) return null;
      return (
        <div className="mt-4">
          <p className="text-sm font-semibold text-[#1C1B19]">
            {section.heading}
            <SectionLabel section={section} />
          </p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-[#6B6862]">
            {section.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        </div>
      );
    case "honest_take":
      if (!section.rows?.length) return null;
      return (
        <div className="mt-4">
          <p className="text-sm font-semibold text-[#1C1B19]">
            {section.heading}
            <SectionLabel section={section} />
          </p>
          <dl className="mt-1 space-y-1.5">
            {section.rows.map((row) => (
              <div key={row.label} className="text-sm leading-relaxed">
                <dt className="inline font-semibold text-[#1C1B19]">
                  {row.label}:{" "}
                </dt>
                <dd className="inline text-[#6B6862]">{row.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      );
    case "stay": {
      if (!section.hotel) return null;
      return (
        <div className="mt-4">
          <p className="text-sm font-semibold text-[#1C1B19]">
            {section.heading}
            <SectionLabel section={section} />
          </p>
          <div className="mt-2">
            <HotelStoryView
              hotel={{
                ...section.hotel,
                sourceUrl: block.wikiUrl,
                sourceName: "Wikipedia",
              }}
            />
          </div>
        </div>
      );
    }
    case "map":
      if (!section.map) return null;
      return (
        <div className="mt-4">
          <MapStripView block={section.map} heading={section.heading} />
        </div>
      );
    case "nearby":
      if (!section.nearby) return null;
      return (
        <div className="mt-4">
          <NearbyRowView block={section.nearby} heading={section.heading} />
        </div>
      );
    case "sample_day":
      if (!section.day) return null;
      return (
        <div className="mt-4">
          <ItineraryTimelineView block={section.day} singleDay />
        </div>
      );
    case "practical_notes": {
      if (!section.practical) return null;
      const p = section.practical;
      return (
        <div className="mt-4">
          <p className="text-sm font-semibold text-[#1C1B19]">
            {section.heading}
            <SectionLabel section={section} />
          </p>
          <div className="mt-1 space-y-1 text-sm leading-relaxed text-[#6B6862]">
            {p.gettingThere && <p>{p.gettingThere}</p>}
            {p.pricePending ? (
              <p>Price: {PRICE_PENDING_LABEL}</p>
            ) : (
              <>
                {p.flight && <p>Flight from Canada: {p.flight}</p>}
                {p.nightly && <p>Hotel: {p.nightly}</p>}
              </>
            )}
            <p>Beetlebot does not book.</p>
          </div>
        </div>
      );
    }
    default:
      return null;
  }
}
