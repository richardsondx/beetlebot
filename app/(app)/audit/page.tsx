import Link from "next/link";
import { db } from "@/lib/db";
import { fmtDateKey, fmtTime, fmtRelative } from "@/lib/format";

const PAGE_SIZE = 50;

function actionColor(action: string): string {
  const a = action.toLowerCase();
  if (a.includes("creat") || a.includes("add") || a.includes("connect")) {
    return "border-emerald-300/20 bg-emerald-300/10 text-emerald-300";
  }
  if (a.includes("delet") || a.includes("remov") || a.includes("disconnect")) {
    return "border-rose-300/20 bg-rose-300/10 text-rose-300";
  }
  if (a.includes("updat") || a.includes("edit") || a.includes("modif")) {
    return "border-sky-300/20 bg-sky-300/10 text-sky-300";
  }
  if (a.includes("approv") || a.includes("hold") || a.includes("book")) {
    return "border-teal-300/20 bg-teal-300/10 text-teal-300";
  }
  if (a.includes("error") || a.includes("fail")) {
    return "border-rose-300/20 bg-rose-300/10 text-rose-300";
  }
  return "border-white/15 bg-white/5 text-slate-300";
}

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const [auditEvents, total] = await Promise.all([
    db.auditEvent.findMany({ orderBy: { at: "desc" }, skip, take: PAGE_SIZE }),
    db.auditEvent.count(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(1, totalPages));

  // Group by day
  const groups = new Map<string, typeof auditEvents>();
  for (const event of auditEvents) {
    const key = fmtDateKey(event.at);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(event);
  }

  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(skip + PAGE_SIZE, total);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        <header>
          <div className="mb-1 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-300/10 text-lg">
              📋
            </span>
            <h1 className="text-2xl font-semibold">Audit Log</h1>
            <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-xs text-slate-400">
              {total} events
            </span>
          </div>
          <p className="text-sm text-slate-400">All agent actions and state changes</p>
        </header>

        {total === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#0d1422] px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-violet-300/10 text-2xl">
              📋
            </div>
            <p className="text-sm font-medium text-slate-300">No audit events yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Every action beetlebot takes will be logged here.
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-6">
              {Array.from(groups.entries()).map(([day, events]) => (
                <section key={day} className="space-y-2">
                  <div className="flex items-center gap-3">
                    <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {day}
                    </h2>
                    <div className="h-px flex-1 bg-white/5" />
                    <span className="text-xs text-slate-600">{events.length}</span>
                  </div>

                  <div className="space-y-2">
                    {events.map((event) => (
                      <article
                        key={event.id}
                        className="flex items-start gap-4 rounded-xl border border-white/10 bg-[#0d1422] px-4 py-3"
                      >
                        <div className="w-16 shrink-0 text-right">
                          <p className="text-xs text-slate-500">{fmtTime(event.at)}</p>
                          <p className="mt-0.5 text-xs text-slate-600">{fmtRelative(event.at)}</p>
                        </div>
                        <div className="h-full w-px shrink-0 self-stretch bg-white/8" />
                        <div className="min-w-0 flex-1">
                          <div className="mb-1.5 flex flex-wrap items-center gap-2">
                            <span
                              className={`rounded-md border px-2 py-0.5 text-xs font-medium ${actionColor(event.action)}`}
                            >
                              {event.action}
                            </span>
                            <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-400">
                              {event.actor}
                            </span>
                          </div>
                          {event.details && (
                            <p className="text-sm leading-relaxed text-slate-300">{event.details}</p>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))}
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between border-t border-white/8 pt-4">
              <p className="text-xs text-slate-500">
                Showing {from}–{to} of {total} events
              </p>

              <div className="flex items-center gap-1">
                <Link
                  href={`/audit?page=1`}
                  aria-disabled={safePage === 1}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs transition-colors
                    ${safePage === 1
                      ? "pointer-events-none border-white/5 text-slate-700"
                      : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
                    }`}
                >
                  «
                </Link>
                <Link
                  href={`/audit?page=${safePage - 1}`}
                  aria-disabled={safePage === 1}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs transition-colors
                    ${safePage === 1
                      ? "pointer-events-none border-white/5 text-slate-700"
                      : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
                    }`}
                >
                  ‹
                </Link>

                {/* Page number pills */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
                  .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((item, idx) =>
                    item === "…" ? (
                      <span key={`ellipsis-${idx}`} className="flex h-8 w-6 items-center justify-center text-xs text-slate-600">
                        …
                      </span>
                    ) : (
                      <Link
                        key={item}
                        href={`/audit?page=${item}`}
                        className={`flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-xs transition-colors
                          ${item === safePage
                            ? "border-violet-400/30 bg-violet-400/10 text-violet-300"
                            : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
                          }`}
                      >
                        {item}
                      </Link>
                    ),
                  )}

                <Link
                  href={`/audit?page=${safePage + 1}`}
                  aria-disabled={safePage === totalPages}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs transition-colors
                    ${safePage === totalPages
                      ? "pointer-events-none border-white/5 text-slate-700"
                      : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
                    }`}
                >
                  ›
                </Link>
                <Link
                  href={`/audit?page=${totalPages}`}
                  aria-disabled={safePage === totalPages}
                  className={`flex h-8 w-8 items-center justify-center rounded-lg border text-xs transition-colors
                    ${safePage === totalPages
                      ? "pointer-events-none border-white/5 text-slate-700"
                      : "border-white/10 text-slate-400 hover:border-white/20 hover:text-slate-200"
                    }`}
                >
                  »
                </Link>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
