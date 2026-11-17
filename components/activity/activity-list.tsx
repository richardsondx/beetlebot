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

function humanizeSlug(slug: string): string {
  return slug
    .split(/[-_]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function providerName(provider: string): string {
  const names: Record<string, string> = {
    google_calendar: "Google Calendar",
    telegram: "Telegram",
    whatsapp: "WhatsApp",
    weather: "Weather",
    opentable: "OpenTable",
    maps: "Maps",
  };
  return names[provider] ?? humanizeSlug(provider);
}

function quote(text: string): string {
  return `"${text.trim()}"`;
}

/** Stored hold titles carry a "Soft hold: " prefix; the sentence already says held. */
function holdTitle(title: string): string {
  return title.replace(/^soft hold:\s*/i, "").trim();
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function parseChatDetails(details: string | null): { message: string; blocks: number } | null {
  if (!details) return null;
  const m = details.match(/^mode=\S+ requested_mode=\S+ blocks=(\d+) message=([\s\S]*)$/);
  if (!m) return null;
  return { blocks: parseInt(m[1], 10), message: m[2].trim() };
}

/**
 * Turn a stored audit event into a sentence a person would read.
 * Stored details are debug strings (mode=..., JSON, slugs, ids); the page
 * must never show raw field names, so every known action is mapped here
 * and anything unknown falls back to plain words or a generic sentence.
 */
function plainSentence(event: ActivityEvent): string {
  const { action, details } = event;
  const d = (details ?? "").trim();
  switch (action) {
    case "chat_intent_parsed": {
      const parsed = parseChatDetails(details);
      const message = parsed?.message ?? d;
      const blocks = parsed?.blocks ?? 0;
      const ask = message ? `You asked for ${lowerFirst(message)}` : "You sent a chat message";
      const reply =
        blocks === 0
          ? "Beetlebot replied in chat."
          : blocks === 1
            ? "Beetlebot replied with a card."
            : `Beetlebot replied with ${blocks} cards.`;
      return `${ask}. ${reply}`;
    }
    case "autopilot_run_created": {
      const reason = d.match(/reason=(\S+);/)?.[1];
      const trigger = d.match(/trigger=([^;]+);/)?.[1]?.trim();
      const syncFailed = /googleSyncError=/.test(d);
      const base =
        reason === "manual"
          ? "You ran an autopilot by hand."
          : trigger
            ? `An autopilot ran on ${trigger}.`
            : "An autopilot ran.";
      return syncFailed ? `${base} It could not sync to Google Calendar.` : base;
    }
    case "autopilot_run_retried": {
      const n = d.match(/(\d+)/)?.[1];
      return n ? `Tried the autopilot run again (attempt ${n}).` : "Tried the autopilot run again.";
    }
    case "autopilot_created":
      return `You created the autopilot ${quote(d)}.`;
    case "autopilot_updated":
      return `You changed the autopilot ${quote(d)}.`;
    case "autopilot_deleted":
      return `You deleted the autopilot ${quote(d)}.`;
    case "pack_created":
      return `You created the pack ${quote(humanizeSlug(d))}.`;
    case "pack_updated":
      return `You changed the pack ${quote(humanizeSlug(d))}.`;
    case "pack_deleted":
      return `You deleted the pack ${quote(humanizeSlug(d))}.`;
    case "pack_installed":
    case "pack_installed_from_forage":
      return `You installed the pack ${quote(humanizeSlug(d))}.`;
    case "pack_uninstalled":
      return `You removed the pack ${quote(humanizeSlug(d))}.`;
    case "soft_hold_created":
      return `Beetlebot held ${quote(holdTitle(d))} on your calendar.`;
    case "soft_hold_updated":
      return `Beetlebot changed the hold ${quote(holdTitle(d))}.`;
    case "soft_hold_deleted":
      return `Beetlebot removed the hold ${quote(holdTitle(d))}.`;
    case "soft_hold_released":
      return `Beetlebot released the hold ${quote(holdTitle(d))}.`;
    case "approval_approved":
      return `You approved ${quote(d)}.`;
    case "approval_rejected":
      return `You turned down ${quote(d)}.`;
    case "integration_connected":
      return `You connected ${providerName(d)}.`;
    case "integration_disconnected":
      return `You disconnected ${providerName(d)}.`;
    case "integration_scopes_updated":
      return `You changed what ${providerName(d.split(":")[0].trim())} can access.`;
    case "safety_settings_updated":
      return "You changed your safety settings.";
    case "memory_forgotten":
      return `You asked Beetlebot to forget ${quote(d)}.`;
    case "scheduler_reconciled":
    case "drafted_plan":
      // These details are already plain sentences.
      return d.endsWith(".") ? d : `${d}.`;
    default: {
      if (d && !/[={};]/.test(d) && !d.startsWith("{")) return d.endsWith(".") ? d : `${d}.`;
      return "Beetlebot recorded an update.";
    }
  }
}

/** Plain source word for the row sub-line. Never a raw action or actor. */
function plainCategory(event: ActivityEvent): string {
  const label = eventKind(event.action).label;
  if (label !== "Other") return label;
  const a = event.action.toLowerCase();
  if (a.includes("setting") || a.includes("integration") || a.includes("memory")) return "Settings";
  return "Beetlebot";
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
                        {plainSentence(event)}
                      </span>
                      <span className="block text-[13px] leading-[18px] text-[#6B6862]">
                        {plainCategory(event)}
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
