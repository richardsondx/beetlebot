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
  held: { badge: "border-[#E7E5E0] bg-[#E6F4EA] text-[#2F7D4F]" },
  released: { badge: "border-[#E7E5E0] bg-[#F2F1EE] text-[#6B6862]" },
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
      ? "border-[#E7E5E0] bg-[#E6F4EA] text-[#2F7D4F]"
      : "border-[#E7E5E0] bg-[#F2F1EE] text-[#6B6862]";

  const now = new Date();
  const upcoming = softHolds.filter((h: SoftHoldRow) => h.endAt > now);
  const past = softHolds.filter((h: SoftHoldRow) => h.endAt <= now);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        {/* Back */}
        <Link
          href="/autopilots"
          className="inline-flex items-center gap-1 text-xs text-[#6B6862] hover:text-[#6B6862]"
        >
          ← Autopilots
        </Link>

        {/* Header card */}
        <section className="rounded-2xl border border-[#E7E5E0] bg-white p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <div className="mb-2 flex items-center gap-2.5">
                <span
                  className={`h-2 w-2 rounded-full ${autopilot.status === "on" ? "bg-[#2F7D4F]" : "bg-[#9A968F]"}`}
                />
                <h1 className="text-xl font-semibold">{autopilot.name}</h1>
              </div>
              <p className="text-sm text-[#6B6862]">{autopilot.goal}</p>
            </div>
            <span
              className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${statusCls}`}
            >
              {autopilot.status}
            </span>
          </div>

          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-[#E7E5E0] bg-[#F2F1EE] p-3">
              <p className="mb-1 text-xs text-[#6B6862]">When</p>
              <p className="text-sm text-[#1C1B19]">{autopilot.trigger}</p>
            </div>
            <div className="rounded-lg border border-[#E7E5E0] bg-[#F2F1EE] p-3">
              <p className="mb-1 text-xs text-[#6B6862]">Then</p>
              <p className="text-sm text-[#1C1B19]">{autopilot.action}</p>
            </div>
            <div className="rounded-lg border border-[#E7E5E0] bg-[#F2F1EE] p-3">
              <p className="mb-1 text-xs text-[#6B6862]">Mode</p>
              <p className="text-sm text-[#1C1B19]">{autopilot.mode}</p>
            </div>
            <div className="rounded-lg border border-[#E7E5E0] bg-[#F2F1EE] p-3">
              <p className="mb-1 text-xs text-[#6B6862]">Next check-in</p>
              <p className="text-sm text-[#1C1B19]">{fmtDateTime(autopilot.nextCheckIn)}</p>
            </div>
          </div>

          {/* Edit / Delete actions */}
          <div className="border-t border-[#E7E5E0] pt-5">
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
          <h2 className="text-sm font-semibold text-[#6B6862]">
            Upcoming holds
            {upcoming.length > 0 && (
              <span className="ml-2 rounded-full border border-[#E7E5E0] bg-[#F2F1EE] px-2 py-0.5 text-xs text-[#6B6862]">
                {upcoming.length}
              </span>
            )}
          </h2>

          {upcoming.length === 0 ? (
            <div className="rounded-xl border border-[#E7E5E0] bg-white px-5 py-8 text-center">
              <p className="text-sm text-[#6B6862]">No upcoming holds</p>
            </div>
          ) : (
            <div className="space-y-2">
              {upcoming.map((hold: SoftHoldRow) => {
                const hs = holdStatusConfig[hold.status] ?? holdStatusConfig.held;
                const sameDay = fmtDateShort(hold.startAt) === fmtDateShort(hold.endAt);
                return (
                  <div
                    key={hold.id}
                    className="rounded-xl border border-[#E7E5E0] bg-white px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-[#1C1B19]">{hold.title}</p>
                        <p className="mt-0.5 text-xs text-[#6B6862]">
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
            <h2 className="text-sm font-semibold text-[#6B6862]">Past holds</h2>
            <div className="space-y-2 opacity-60">
              {past.map((hold: SoftHoldRow) => {
                const hs = holdStatusConfig[hold.status] ?? holdStatusConfig.released;
                return (
                  <div
                    key={hold.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-[#E7E5E0] bg-white px-4 py-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-[#6B6862]">{hold.title}</p>
                      <p className="mt-0.5 text-xs text-[#9A968F]">
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
