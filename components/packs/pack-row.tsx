"use client";

import Link from "next/link";
import { useState } from "react";
import { CheckIcon, PlusIcon } from "@/components/ui/icons";
import { PackTile } from "@/components/ui/pack-tile";

export type PackRowData = {
  slug: string;
  name: string;
  city: string;
  style: string;
  budgetRange: string;
  description: string;
  installed: boolean;
  modes: string[];
  tags: string[];
  needs: string[];
};

/** Plugins-style directory row (§4.2): 48px tile, name over one-line description, meta chips, + / Installed right. */
export function PackRow({ pack }: { pack: PackRowData }) {
  const [installed, setInstalled] = useState(pack.installed);
  const [busy, setBusy] = useState(false);

  async function install() {
    setBusy(true);
    try {
      const res = await fetch("/api/packs/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: pack.slug }),
      });
      if (res.ok) setInstalled(true);
    } catch {
      // Leave the row unchanged; the detail page shows the full install flow.
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-[#F2F1EE]">
      <Link href={`/packs/${pack.slug}`} className="flex min-w-0 flex-1 items-center gap-4" aria-label={pack.name}>
        <PackTile slug={pack.slug} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-medium leading-5 text-[#1C1B19]">{pack.name}</span>
          <span className="block truncate text-[13px] leading-[18px] text-[#6B6862]">{pack.description}</span>
          <span className="mt-1.5 flex flex-wrap gap-1.5">
            {pack.city && (
              <span className="rounded-full bg-[#F2F1EE] px-2 py-0.5 text-xs text-[#6B6862]">{pack.city}</span>
            )}
            {pack.budgetRange && (
              <span className="rounded-full bg-[#F2F1EE] px-2 py-0.5 text-xs text-[#6B6862]">{pack.budgetRange}</span>
            )}
          </span>
        </span>
      </Link>
      {installed ? (
        <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#E6F4EA] px-2.5 py-1 text-xs font-medium text-[#2F7D4F]">
          <CheckIcon size={14} />
          Installed
        </span>
      ) : (
        <button
          type="button"
          onClick={() => void install()}
          disabled={busy}
          aria-label={`Install ${pack.name}`}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#D6D3CC] text-[#1C1B19] transition-all hover:bg-[#F2F1EE] active:scale-[0.97] disabled:opacity-50"
        >
          <PlusIcon size={16} />
        </button>
      )}
    </div>
  );
}
