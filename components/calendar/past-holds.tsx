"use client";

import { useState } from "react";
import { ChevronRightIcon } from "@/components/ui/icons";
import { fmtTime } from "@/lib/format";
import type { DayGroup } from "@/lib/date-groups";

export type PastHold = {
  id: string;
  title: string;
  startAtIso: string;
  endAtIso: string;
  status: string;
};

/** Past holds, collapsed by default (§4.4). Inside, groups are descending. */
export function PastHolds({ groups, total }: { groups: DayGroup<PastHold>[]; total: number }) {
  const [open, setOpen] = useState(false);
  if (total === 0) return null;
  return (
    <section className="space-y-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1 rounded-[10px] px-2 py-2 text-left text-[13px] font-semibold uppercase leading-[18px] tracking-[0.04em] text-[#6B6862] hover:bg-[#F2F1EE]"
      >
        <ChevronRightIcon size={16} className={`transition-transform ${open ? "rotate-90" : ""}`} />
        Past holds ({total})
      </button>
      {open &&
        groups.map((group) => (
          <div key={group.key} className="space-y-1">
            <h2 className="sticky top-0 bg-white px-4 pb-1 pt-2 text-[13px] font-semibold uppercase leading-[18px] tracking-[0.04em] text-[#6B6862]">
              {group.label}
            </h2>
            <div className="divide-y divide-[#E7E5E0] opacity-70">
              {group.items.map((hold) => (
                <div key={hold.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="w-14 shrink-0 text-[13px] leading-[18px] text-[#6B6862]">
                    {fmtTime(new Date(hold.startAtIso))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium leading-5 text-[#1C1B19]">{hold.title}</span>
                    <span className="block text-[13px] leading-[18px] text-[#6B6862]">
                      {fmtTime(new Date(hold.startAtIso))} – {fmtTime(new Date(hold.endAtIso))}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-[#F2F1EE] px-2.5 py-0.5 text-xs text-[#6B6862]">
                    {hold.status === "released" ? "Released" : "Held"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}
    </section>
  );
}
