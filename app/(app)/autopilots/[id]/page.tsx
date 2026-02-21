import { notFound } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { ensureSeedData } from "@/lib/repositories/seed";
import { fmtDateTime, fmtDateShort, fmtTime } from "@/lib/format";
import { AutopilotActions } from "@/components/autopilots/autopilot-actions";
import { SoftHoldActions } from "@/components/calendar/soft-hold-actions";

type PageProps = {
  params: Promise<{ id: string }>;
};

type SoftHoldRow = {
  id: string;
  title: string;
  startAt: Date;
  endAt: Date;
  status: string;
};

const holdStatusConfig: Record<string, { badge: string }> = {
  held: { badge: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200" },
  released: { badge: "border-white/15 bg-white/5 text-slate-400" },
};

export default async function AutopilotDetailPage({ params }: PageProps) {
  await ensureSeedData();
  const { id } = await params;
  const [autopilot, softHolds] = await Promise.all([
    db.autopilot.findUnique({ where: { id } }),
    db.softHold.findMany({ orderBy: { startAt: "asc" } }) as Promise<SoftHoldRow[]>,
  ]);

  if (!autopilot) notFound();

  const statusCls =
    autopilot.status === "on"
      ? "border-emerald-300/25 bg-emerald-300/10 text-emerald-200"
      : "border-white/15 bg-white/5 text-slate-400";

  const upcoming = softHolds.filter((h) => h.endAt > new Date());
  const past = softHolds.filter((h) => h.endAt <= new Date());

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        {/* Back */}
        <Link
          href="/autopilots"
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
        >
          ← Autopilots
        </Link>

        {/* Header card */}
        <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2.5">
                <span
                  className={`h-2 w-2 rounded-full ${autopilot.status === "on" ? "bg-emerald-400" : "bg-slate-500"}`}
                />
                <h1 className="text-xl font-semibold">{autopilot.name}</h1>
              </div>
              <p className="text-sm text-slate-400">{autopilot.goal}</p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${statusCls}`}
            >
              {autopilot.status}
            </span>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-white/8 bg-white/3 p-3">
              <p className="mb-1 text-xs text-slate-500">Trigger</p>
              <p className="text-sm text-slate-200">{autopilot.trigger}</p>
            </div>
            <div className="rounded-lg border border-white/8 bg-white/3 p-3">
              <p className="mb-1 text-xs text-slate-500">Action</p>
              <p className="text-sm text-slate-200">{autopilot.action}</p>
            </div>
            <div className="rounded-lg border border-white/8 bg-white/3 p-3">
              <p className="mb-1 text-xs text-slate-500">Mode</p>
              <p className="text-sm text-slate-200">{autopilot.mode}</p>
            </div>
            <div className="rounded-lg border border-white/8 bg-white/3 p-3">
              <p className="mb-1 text-xs text-slate-500">Next check-in</p>
              <p className="text-sm text-slate-200">{fmtDateTime(autopilot.nextCheckIn)}</p>
            </div>
          </div>

          {/* Edit / Delete actions */}
          <div className="border-t border-white/8 pt-5">
            <AutopilotActions
              autopilot={{
                id: autopilot.id,
                name: autopilot.name,
                goal: autopilot.goal,
                triggerType: autopilot.triggerType,
                trigger: autopilot.trigger,
                action: autopilot.action,
                approvalRule: autopilot.approvalRule,
                mode: autopilot.mode,
                budgetCap: autopilot.budgetCap,
                status: autopilot.status,
              }}
            />
          </div>
        </section>

        {/* Upcoming soft holds */}
        <section className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">
            Upcoming holds
            {upcoming.length > 0 && (
              <span className="ml-2 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                {upcoming.length}
              </span>
            )}
          </h2>

          {upcoming.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-[#0d1422] px-5 py-8 text-center">
              <p className="text-sm text-slate-500">No upcoming holds</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((hold) => {
                const hs = holdStatusConfig[hold.status] ?? holdStatusConfig.held;
                const sameDay = fmtDateShort(hold.startAt) === fmtDateShort(hold.endAt);
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
                          {sameDay
                            ? fmtTime(hold.endAt)
                            : `${fmtDateShort(hold.endAt)} ${fmtTime(hold.endAt)}`}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${hs.badge}`}
                      >
                        {hold.status}
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

        {/* Past holds */}
        {past.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-slate-500">Past holds</h2>
            <div className="space-y-2 opacity-60">
              {past.map((hold) => {
                const hs = holdStatusConfig[hold.status] ?? holdStatusConfig.released;
                return (
                  <div
                    key={hold.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-white/8 bg-[#080f1a] px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-300">{hold.title}</p>
                      <p className="mt-0.5 text-xs text-slate-600">
                        {fmtDateShort(hold.startAt)} · {fmtTime(hold.startAt)} –{" "}
                        {fmtTime(hold.endAt)}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${hs.badge}`}
                    >
                      {hold.status}
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
