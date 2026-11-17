"use client";

import { useMemo, useState } from "react";
import { SearchIcon } from "@/components/ui/icons";
import { PackRow, type PackRowData } from "./pack-row";

const FILTERS = ["All", "Toronto", "Canada", "Travel", "Wellness", "Family"] as const;
type Filter = (typeof FILTERS)[number];

const TRAVEL_SLUGS = ["flights-compare", "hotels-compare", "weekend-escape", "solo-city-break", "business-trip"];
const WELLNESS_SLUGS = ["toronto-scandinavian-spa-trail", "toronto-group-wellness-experiences"];
const FAMILY_SLUGS = ["family-trip", "holidays-canada"];

function matchesFilter(pack: PackRowData, filter: Filter): boolean {
  switch (filter) {
    case "All":
      return true;
    case "Toronto":
      return pack.city.includes("Toronto");
    case "Canada":
      return pack.city === "Canada" || pack.city === "Ontario";
    case "Travel":
      return TRAVEL_SLUGS.includes(pack.slug);
    case "Wellness":
      return WELLNESS_SLUGS.includes(pack.slug);
    case "Family":
      return FAMILY_SLUGS.includes(pack.slug);
  }
}

function Section({ label, packs }: { label: string; packs: PackRowData[] }) {
  if (packs.length === 0) return null;
  return (
    <section className="space-y-1">
      <h2 className="px-4 pb-1 text-[13px] font-semibold uppercase leading-[18px] tracking-[0.04em] text-[#6B6862]">
        {label}
      </h2>
      <div className="divide-y divide-[#E7E5E0]">
        {packs.map((pack) => (
          <PackRow key={pack.slug} pack={pack} />
        ))}
      </div>
    </section>
  );
}

export function PackDirectory({ packs }: { packs: PackRowData[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return packs.filter(
      (p) =>
        matchesFilter(p, filter) &&
        (needle === "" ||
          p.name.toLowerCase().includes(needle) ||
          p.description.toLowerCase().includes(needle) ||
          p.city.toLowerCase().includes(needle)),
    );
  }, [packs, q, filter]);

  const searching = q.trim() !== "" || filter !== "All";
  const installed = filtered.filter((p) => p.installed);
  const notInstalled = filtered.filter((p) => !p.installed);
  const popular = notInstalled.slice(0, 6);
  const popularSlugs = new Set(popular.map((p) => p.slug));
  const browse = notInstalled.filter((p) => !popularSlugs.has(p.slug));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A968F]">
            <SearchIcon size={16} />
          </span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search packs"
            aria-label="Search packs"
            className="h-10 w-full rounded-xl border border-[#D6D3CC] bg-white pl-10 pr-3 text-[15px] text-[#1C1B19] placeholder-[#9A968F] outline-none focus:border-[#C8811A]"
          />
        </div>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Filter packs">
          {FILTERS.map((f) => (
            <button
              key={f}
              type="button"
              role="radio"
              aria-checked={filter === f}
              onClick={() => setFilter(f)}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                filter === f ? "bg-[#FBF1E1] text-[#8A5710]" : "bg-[#F2F1EE] text-[#6B6862] hover:bg-[#E7E5E0]"
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#E7E5E0] bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-[#1C1B19]">No packs match &ldquo;{q}&rdquo;.</p>
          <p className="mt-1 text-[13px] text-[#6B6862]">Try a different word or clear filters.</p>
        </div>
      ) : searching ? (
        <Section label="Results" packs={filtered} />
      ) : (
        <>
          <Section label="Installed" packs={installed} />
          <Section label="Popular" packs={popular} />
          <Section label="Browse all" packs={browse} />
        </>
      )}
    </div>
  );
}
