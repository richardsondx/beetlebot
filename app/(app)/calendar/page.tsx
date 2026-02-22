import { db } from "@/lib/db";
import { getIntegrationConnection } from "@/lib/repositories/integrations";
import { fmtDateShort, fmtTime } from "@/lib/format";
import { SoftHoldActions } from "@/components/calendar/soft-hold-actions";
import Link from "next/link";

const statusConfig: Record<string, { badge: string; dot: string; label: string }> = {
  connected: {
    dot: "bg-emerald-400",
    badge: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
    label: "Connected",
  },
  pending: {
    dot: "bg-amber-400",
    badge: "border-amber-300/25 bg-amber-300/10 text-amber-200",
    label: "Pending",
  },
  error: {
    dot: "bg-rose-400",
    badge: "border-rose-300/25 bg-rose-300/10 text-rose-200",
    label: "Error",
  },
  disconnected: {
    dot: "bg-slate-500",
    badge: "border-white/15 bg-white/5 text-slate-400",
    label: "Disconnected",
  },
};

const holdStatusConfig: Record<string, { badge: string; label: string }> = {
  held: {
    badge: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
    label: "Held",
  },
  released: {
    badge: "border-white/15 bg-white/5 text-slate-400",
    label: "Released",
  },
};

type SoftHoldRow = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  status: string;
};

export default async function CalendarPage() {
  const [softHolds, googleCalendar] = await Promise.all([
    db.softHold.findMany({ orderBy: { startAt: "asc" } }) as Promise<SoftHoldRow[]>,
    getIntegrationConnection("google_calendar"),
  ]);

  const calStatus = statusConfig[googleCalendar.status] ?? statusConfig.disconnected;
  const isConnected = googleCalendar.status === "connected";

  const now = new Date();
  const upcoming = softHolds.filter((h: SoftHoldRow) => h.endAt > now);
  const past = softHolds.filter((h: SoftHoldRow) => h.endAt <= now);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        <header>
          <div className="mb-1 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-300/10 text-lg">
              📅
            </span>
            <h1 className="text-2xl font-semibold">Calendar</h1>
          </div>
          <p className="text-sm text-slate-400">Soft holds and scheduling connections</p>
        </header>

        {/* Google Calendar Connection */}
        <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-[#0a1020] text-xl">
                G
              </div>
              <div>
                <p className="text-sm font-medium text-slate-100">Google Calendar</p>
                <p className="text-xs text-slate-500">
                  {isConnected
                    ? googleCalendar.externalAccountLabel ?? "Connected"
                    : "Not connected"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5">
                <span className={`h-1.5 w-1.5 rounded-full ${calStatus.dot}`} />
                <span className={`rounded-full border px-2.5 py-0.5 text-xs ${calStatus.badge}`}>
                  {calStatus.label}
                </span>
              </div>
              {!isConnected && (
                <Link
                  href="/settings"
                  className="rounded-lg border border-amber-300/25 bg-amber-300/10 px-3 py-1.5 text-xs text-amber-200 transition-colors hover:bg-amber-300/20"
                >
                  Connect →
                </Link>
              )}
            </div>
          </div>
        </section>

        {/* Upcoming soft holds */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-200">Upcoming holds</h2>
            {upcoming.length > 0 && (
              <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                {upcoming.length}
              </span>
            )}
          </div>

          {upcoming.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-[#0d1422] px-5 py-8 text-center">
              <p className="text-sm text-slate-500">No upcoming holds</p>
              <p className="mt-1 text-xs text-slate-600">
                Autopilots will soft-hold time on your calendar here.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((hold: SoftHoldRow) => {
                const hs = holdStatusConfig[hold.status] ?? holdStatusConfig.held;
                const sameDay =
                  fmtDateShort(hold.startAt) === fmtDateShort(hold.endAt);
                return (
                  <div
                    key={hold.id}
                    className="rounded-xl border border-white/10 bg-[#0d1422] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-100">{hold.title}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {fmtDateShort(hold.startAt)} · {fmtTime(hold.startAt)}
                          {" – "}
                          {sameDay ? fmtTime(hold.endAt) : `${fmtDateShort(hold.endAt)} ${fmtTime(hold.endAt)}`}
                        </p>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${hs.badge}`}>
                        {hs.label}
                      </span>
                    </div>
                    <SoftHoldActions
                      hold={{
                        id: hold.id,
                        title: hold.title,
                        startAtIso: hold.startAt.toISOString(),
                        endAtIso: hold.endAt.toISOString(),
                        status: hold.status === "released" ? "released" : "held",
                      }}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Past soft holds */}
        {past.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-500">Past holds</h2>
            <div className="space-y-2">
              {past.map((hold: SoftHoldRow) => {
                const hs = holdStatusConfig[hold.status] ?? holdStatusConfig.released;
                return (
                  <div
                    key={hold.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-[#080f1a] px-4 py-3 opacity-60"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-300">{hold.title}</p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {fmtDateShort(hold.startAt)} · {fmtTime(hold.startAt)} – {fmtTime(hold.endAt)}
                      </p>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${hs.badge}`}>
                      {hs.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
