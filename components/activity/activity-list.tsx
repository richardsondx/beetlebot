"use client";

import { useMemo, useState } from "react";
import { ActivityIcon, BlocksIcon, CalendarDaysIcon, MessageCircleIcon, ZapIcon } from "@/components/ui/icons";
import { groupByDay } from "@/lib/date-groups";
import { fmtTime } from "@/lib/format";

export type ActivityEvent = {
  id: string;
  atIso: string;
  action: string;
  actor: string;
  details: string | null;
};

const FILTERS = ["All", "Chat", "Packs", "Calendar", "Autopilots"] as const;
type Filter = (typeof FILTERS)[number];

function eventKind(action: string): { label: string; tint: string; Icon: typeof ActivityIcon } {
  const a = action.toLowerCase();
  if (a.includes("autopilot")) return { label: "Autopilot", tint: "bg-[#FBF1E1] text-[#A96B12]", Icon: ZapIcon };
  if (a.includes("pack")) return { label: "Pack", tint: "bg-[#EFEAFB] text-[#6146A8]", Icon: BlocksIcon };
  if (a.includes("hold") || a.includes("calendar")) return { label: "Calendar", tint: "bg-[#E6F4EA] text-[#2F7D4F]", Icon: CalendarDaysIcon };
  if (a.includes("chat") || a.includes("message") || a.includes("reply")) return { label: "Chat", tint: "bg-[#E5EFFB] text-[#2F5FA8]", Icon: MessageCircleIcon };
  return { label: "Other", tint: "bg-[#EEF0F3] text-[#4A5361]", Icon: ActivityIcon };
}

function matchesFilter(event: ActivityEvent, filter: Filter): boolean {
  if (filter === "All") return true;
  return eventKind(event.action).label === filter;
}

/** Grouped activity feed (§4.5): Today, Yesterday, dated groups descending. */
export function ActivityList({ events }: { events: ActivityEvent[] }) {
  const [filter, setFilter] = useState<Filter>("All");
  const filtered = useMemo(() => events.filter((e) => matchesFilter(e, filter)), [events, filter]);
  const groups = useMemo(
    () => groupByDay(filtered, (e) => new Date(e.atIso)).reverse(),
    [filtered],
  );

  if (events.length === 0) {
    return (
      <div className="rounded-2xl border border-[#E7E5E0] bg-white px-6 py-16 text-center">
        <p className="text-sm font-medium text-[#1C1B19]">No activity yet</p>
        <p className="mt-1 text-[13px] text-[#6B6862]">Things Beetlebot does will appear here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Filter activity">
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

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-[#E7E5E0] bg-white px-6 py-16 text-center">
          <p className="text-sm font-medium text-[#1C1B19]">No activity in this filter</p>
          <p className="mt-1 text-[13px] text-[#6B6862]">Try a different filter.</p>
        </div>
      ) : (
        groups.map((group) => (
          <section key={group.key} className="space-y-1">
            <h2 className="px-4 pb-1 text-[13px] font-semibold uppercase leading-[18px] tracking-[0.04em] text-[#6B6862]">
              {group.label}
            </h2>
            <div className="divide-y divide-[#E7E5E0]">
              {group.items.map((event) => {
                const kind = eventKind(event.action);
                return (
                  <article key={event.id} className="flex items-start gap-3 px-4 py-3">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${kind.tint}`}>
                      <kind.Icon size={16} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[15px] leading-[22px] text-[#1C1B19]">
                        {event.details ?? event.action}
                      </span>
                      <span className="block text-[13px] leading-[18px] text-[#6B6862]">
                        {event.action} · {event.actor}
                      </span>
                    </span>
                    <span className="shrink-0 text-xs leading-4 text-[#9A968F]">{fmtTime(new Date(event.atIso))}</span>
                  </article>
                );
              })}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
