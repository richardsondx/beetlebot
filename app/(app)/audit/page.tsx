import Link from "next/link";
import { db } from "@/lib/db";
import { ActivityList, type ActivityEvent } from "@/components/activity/activity-list";

const PAGE_SIZE = 50;

type AuditEventRow = {
  id: string;
  at: Date;
  action: string;
  actor: string;
  details: string | null;
};

export default async function AuditPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(1, parseInt(pageParam ?? "1", 10) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const [auditEvents, total] = await Promise.all([
    db.auditEvent.findMany({
      orderBy: { at: "desc" },
      skip,
      take: PAGE_SIZE,
    }) as Promise<AuditEventRow[]>,
    db.auditEvent.count(),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const safePage = Math.min(page, Math.max(1, totalPages));
  const from = total === 0 ? 0 : skip + 1;
  const to = Math.min(skip + PAGE_SIZE, total);

  const events: ActivityEvent[] = auditEvents.map((e) => ({
    id: e.id,
    atIso: e.at.toISOString(),
    action: e.action,
    actor: e.actor,
    details: e.details,
  }));

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto max-w-[760px] space-y-6 px-4 py-8 md:px-8">
        <header>
          <div className="mb-1 flex items-center gap-2.5">
            <h1 className="text-2xl font-semibold leading-8 text-[#1C1B19]">Activity</h1>
            <span className="rounded-full bg-[#F2F1EE] px-2.5 py-0.5 text-xs text-[#6B6862]">{total} events</span>
          </div>
          <p className="text-[13px] leading-[18px] text-[#6B6862]">All agent actions and state changes</p>
        </header>

        <ActivityList events={events} />

        {total > 0 && (
          <div className="flex items-center justify-between border-t border-[#E7E5E0] pt-4">
            <p className="text-xs text-[#6B6862]">
              Showing {from}–{to} of {total} events
            </p>
            <div className="flex items-center gap-1">
              <Link
                href="/audit?page=1"
                aria-disabled={safePage === 1}
                className={`flex h-8 w-8 items-center justify-center rounded-[10px] border text-xs transition-colors ${
                  safePage === 1
                    ? "pointer-events-none border-[#E7E5E0] text-[#9A968F]"
                    : "border-[#E7E5E0] text-[#6B6862] hover:border-[#D6D3CC] hover:text-[#1C1B19]"
                }`}
              >
                «
              </Link>
              <Link
                href={`/audit?page=${safePage - 1}`}
                aria-disabled={safePage === 1}
                className={`flex h-8 w-8 items-center justify-center rounded-[10px] border text-xs transition-colors ${
                  safePage === 1
                    ? "pointer-events-none border-[#E7E5E0] text-[#9A968F]"
                    : "border-[#E7E5E0] text-[#6B6862] hover:border-[#D6D3CC] hover:text-[#1C1B19]"
                }`}
              >
                ‹
              </Link>
              <span className="flex h-8 min-w-8 items-center justify-center rounded-[10px] border border-[#D6D3CC] bg-[#FBF1E1] px-2 text-xs text-[#8A5710]">
                {safePage}
              </span>
              <Link
                href={`/audit?page=${safePage + 1}`}
                aria-disabled={safePage === totalPages}
                className={`flex h-8 w-8 items-center justify-center rounded-[10px] border text-xs transition-colors ${
                  safePage === totalPages
                    ? "pointer-events-none border-[#E7E5E0] text-[#9A968F]"
                    : "border-[#E7E5E0] text-[#6B6862] hover:border-[#D6D3CC] hover:text-[#1C1B19]"
                }`}
              >
                ›
              </Link>
              <Link
                href={`/audit?page=${totalPages}`}
                aria-disabled={safePage === totalPages}
                className={`flex h-8 w-8 items-center justify-center rounded-[10px] border text-xs transition-colors ${
                  safePage === totalPages
                    ? "pointer-events-none border-[#E7E5E0] text-[#9A968F]"
                    : "border-[#E7E5E0] text-[#6B6862] hover:border-[#D6D3CC] hover:text-[#1C1B19]"
                }`}
              >
                »
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
