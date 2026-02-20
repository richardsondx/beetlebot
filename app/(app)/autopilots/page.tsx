import Link from "next/link";
import { listAutopilots } from "@/lib/repositories/autopilots";

const statusConfig: Record<string, { dot: string; badge: string; label: string }> = {
  on: {
    dot: "bg-emerald-400",
    badge: "border-emerald-300/25 bg-emerald-300/10 text-emerald-200",
    label: "On",
  },
  paused: {
    dot: "bg-amber-400",
    badge: "border-amber-300/25 bg-amber-300/10 text-amber-200",
    label: "Paused",
  },
  off: {
    dot: "bg-slate-500",
    badge: "border-white/15 bg-white/5 text-slate-400",
    label: "Off",
  },
};

const approvalConfig: Record<string, { label: string; cls: string }> = {
  ask_first: { label: "Ask first", cls: "border-teal-300/25 bg-teal-300/10 text-teal-200" },
  auto_hold: { label: "Auto hold", cls: "border-sky-300/25 bg-sky-300/10 text-sky-200" },
  auto_execute: { label: "Auto execute", cls: "border-violet-300/25 bg-violet-300/10 text-violet-200" },
};

export default async function AutopilotsPage() {
  const autopilots = await listAutopilots();
  const activeCount = autopilots.filter((a) => a.status === "on").length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-1 flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-300/10 text-lg">
                ⚡
              </span>
              <h1 className="text-2xl font-semibold">Autopilots</h1>
              {activeCount > 0 && (
                <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-0.5 text-xs text-emerald-200">
                  {activeCount} active
                </span>
              )}
            </div>
            <p className="text-sm text-slate-400">Goal · Trigger · Action · Approval</p>
          </div>
          <Link
            href="/autopilots/new"
            className="shrink-0 rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm text-amber-100 transition-colors hover:bg-amber-300/20"
          >
            + New autopilot
          </Link>
        </header>

        {autopilots.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#0d1422] px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-amber-300/10 text-2xl">
              ⚡
            </div>
            <p className="text-sm font-medium text-slate-300">No autopilots yet</p>
            <p className="mt-1 text-xs text-slate-500">
              Set a goal, trigger, and action — beetlebot does the rest.
            </p>
            <Link
              href="/autopilots/new"
              className="mt-4 inline-block rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm text-amber-200 hover:bg-amber-300/20"
            >
              Create your first autopilot
            </Link>
          </div>
        ) : (
          <div className="grid gap-3">
            {autopilots.map((item) => {
              const s = statusConfig[item.status] ?? statusConfig.off;
              const a = approvalConfig[item.approvalRule] ?? approvalConfig.ask_first;
              return (
                <Link
                  key={item.id}
                  href={`/autopilots/${item.id}`}
                  className="group rounded-2xl border border-white/10 bg-[#0d1422] p-5 transition-all hover:border-white/20 hover:bg-[#0f1728]"
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className={`mt-0.5 h-2 w-2 shrink-0 rounded-full ${s.dot}`} />
                      <h2 className="truncate text-base font-semibold group-hover:text-white">
                        {item.name}
                      </h2>
                    </div>
                    <span className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs ${s.badge}`}>
                      {s.label}
                    </span>
                  </div>

                  <p className="mb-4 line-clamp-2 text-sm text-slate-400">{item.goal}</p>

                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md border border-white/8 bg-white/4 px-2 py-1 text-xs text-slate-300">
                      <span className="text-slate-500">trigger:</span>{" "}
                      {item.trigger}
                    </span>
                    <span className="rounded-md border border-white/8 bg-white/4 px-2 py-1 text-xs text-slate-300">
                      <span className="text-slate-500">mode:</span>{" "}
                      {item.mode}
                    </span>
                    <span className={`rounded-md border px-2 py-1 text-xs ${a.cls}`}>
                      {a.label}
                    </span>
                    {"budgetCap" in item && (item as { budgetCap?: number }).budgetCap ? (
                      <span className="rounded-md border border-white/8 bg-white/4 px-2 py-1 text-xs text-slate-300">
                        ${(item as { budgetCap?: number }).budgetCap} cap
                      </span>
                    ) : null}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
