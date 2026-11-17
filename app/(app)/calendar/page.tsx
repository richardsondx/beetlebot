import { db } from "@/lib/db";
import { getIntegrationConnection } from "@/lib/repositories/integrations";
import { fmtDateShort, fmtTime } from "@/lib/format";
import { groupByDay } from "@/lib/date-groups";
import { CalendarDaysIcon } from "@/components/ui/icons";
import { SoftHoldActions } from "@/components/calendar/soft-hold-actions";
import { PastHolds, type PastHold } from "@/components/calendar/past-holds";
import Link from "next/link";

const statusConfig: Record<string, { badge: string; dot: string; label: string }> = {
  connected: {
    dot: "bg-[#2F7D4F]",
    badge: "border-[#E7E5E0] bg-[#E6F4EA] text-[#2F7D4F]",
    label: "Connected",
  },
  pending: {
    dot: "bg-[#B4690E]",
    badge: "border-[#E7E5E0] bg-[#FBF1E1] text-[#B4690E]",
    label: "Pending",
  },
  error: {
    dot: "bg-[#C23B32]",
    badge: "border-[#E7E5E0] bg-[#FBE8EC] text-[#C23B32]",
    label: "Error",
  },
  disconnected: {
    dot: "bg-[#9A968F]",
    badge: "border-[#E7E5E0] bg-[#F2F1EE] text-[#6B6862]",
    label: "Disconnected",
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
  const upcomingGroups = groupByDay(upcoming, (h) => h.startAt, now);
  const pastGroups = groupByDay(
    past.map((h): PastHold => ({
      id: h.id,
      title: h.title,
      startAtIso: h.startAt.toISOString(),
      endAtIso: h.endAt.toISOString(),
      status: h.status,
    })),
    (h) => new Date(h.startAtIso),
    now,
  ).reverse();

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto max-w-[760px] space-y-6 px-4 py-8 md:px-8">
        <header>
          <h1 className="text-2xl font-semibold leading-8 text-[#1C1B19]">Calendar</h1>
          <p className="mt-1 text-[13px] leading-[18px] text-[#6B6862]">Soft holds and scheduling connections</p>
        </header>

        <section className="rounded-2xl border border-[#E7E5E0] bg-white p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E7E5E0] bg-[#F7F7F5] text-lg font-semibold text-[#1C1B19]">
                G
              </div>
              <div>
                <p className="text-sm font-medium text-[#1C1B19]">Google Calendar</p>
                <p className="text-xs text-[#6B6862]">
                  {isConnected ? googleCalendar.externalAccountLabel ?? "Connected" : "Not connected"}
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
                  className="rounded-[10px] border border-[#D6D3CC] bg-[#FBF1E1] px-3 py-1.5 text-xs text-[#8A5710] transition-colors hover:bg-[#F2F1EE]"
                >
                  Connect →
                </Link>
              )}
            </div>
          </div>
        </section>

        {upcoming.length === 0 ? (
          <div className="rounded-2xl border border-[#E7E5E0] bg-white px-6 py-16 text-center">
            <p className="text-sm font-medium text-[#1C1B19]">Nothing on the calendar</p>
            <p className="mt-1 text-[13px] text-[#6B6862]">Holds you make in chat show up here.</p>
          </div>
        ) : (
          <div className="space-y-6">
            {upcomingGroups.map((group) => (
              <section key={group.key} className="space-y-1">
                <h2 className="sticky top-0 bg-white px-4 pb-1 pt-2 text-[13px] font-semibold uppercase leading-[18px] tracking-[0.04em] text-[#6B6862]">
                  {group.label}
                </h2>
                <div className="divide-y divide-[#E7E5E0]">
                  {group.items.map((hold) => {
                    const sameDay = fmtDateShort(hold.startAt) === fmtDateShort(hold.endAt);
                    return (
                      <div key={hold.id} className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="w-14 shrink-0 text-[13px] leading-[18px] text-[#6B6862]">
                            {fmtTime(hold.startAt)}
                          </span>
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-[#EEF0F3] text-[#4A5361]">
                            <CalendarDaysIcon size={16} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[15px] font-medium leading-5 text-[#1C1B19]">
                              {hold.title}
                            </span>
                            <span className="block text-[13px] leading-[18px] text-[#6B6862]">
                              {fmtDateShort(hold.startAt)} · {fmtTime(hold.startAt)}
                              {" – "}
                              {sameDay ? fmtTime(hold.endAt) : `${fmtDateShort(hold.endAt)} ${fmtTime(hold.endAt)}`}
                            </span>
                          </span>
                          <span
                            className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              hold.status === "held"
                                ? "bg-[#FBF1E1] text-[#B4690E]"
                                : "bg-[#F2F1EE] text-[#6B6862]"
                            }`}
                          >
                            {hold.status === "held" ? "Held" : "Released"}
                          </span>
                        </div>
                        <div className="pl-[104px]">
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
                      </div>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        )}

        <PastHolds groups={pastGroups} total={past.length} />
      </div>
    </div>
  );
}
