import { db } from "@/lib/db";
import { fmtTime, fmtRelative } from "@/lib/format";

const approvalBadge: Record<string, string> = {
  ask_first: "border-teal-300/25 bg-teal-300/10 text-teal-200",
  auto_hold: "border-sky-300/25 bg-sky-300/10 text-sky-200",
  auto_execute: "border-violet-300/25 bg-violet-300/10 text-violet-200",
};

export async function AgentConsole() {
  const [debugTraces, autopilot] = await Promise.all([
    db.debugTrace.findMany({ orderBy: { at: "desc" }, take: 20 }),
    db.autopilot.findFirst({ where: { status: "on" }, orderBy: { createdAt: "desc" } }),
  ]);

  const apGate = autopilot?.approvalRule ?? "ask_first";
  const apBadge = approvalBadge[apGate] ?? approvalBadge.ask_first;

  return (
    <div className="space-y-4">
      {/* Status bar */}
      <section className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-[#0d1422] p-4">
          <p className="mb-1 text-xs text-slate-500">Status</p>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_theme(colors.emerald.400)]" />
            <span className="text-sm font-medium text-emerald-200">Connected</span>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0d1422] p-4">
          <p className="mb-1 text-xs text-slate-500">Active autopilot</p>
          <p className="text-sm font-medium text-slate-100 truncate">
            {autopilot?.name ?? "None"}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0d1422] p-4">
          <p className="mb-1 text-xs text-slate-500">Approval gate</p>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs ${apBadge}`}>
            {apGate.replace(/_/g, " ")}
          </span>
        </div>
      </section>

      {/* Trace stream */}
      <section className="rounded-2xl border border-white/10 bg-[#080f1b]">
        <header className="flex items-center justify-between border-b border-white/8 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            <h2 className="text-sm font-semibold text-slate-100">Trace stream</h2>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-400">
            {debugTraces.length} entries
          </span>
        </header>

        {debugTraces.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-slate-500">No trace events yet.</p>
            <p className="mt-1 text-xs text-slate-600">
              Tool calls and agent steps will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {debugTraces.map((trace, idx) => (
              <div key={trace.id} className="flex gap-4 px-5 py-3">
                <div className="w-14 shrink-0 text-right">
                  <p className="font-mono text-xs text-slate-500">{fmtTime(trace.at)}</p>
                  {idx === 0 && (
                    <p className="mt-0.5 text-xs text-slate-600">{fmtRelative(trace.at)}</p>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {"scope" in trace && trace.scope && (
                    <span className="mr-2 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-xs text-slate-400">
                      {String(trace.scope)}
                    </span>
                  )}
                  <span className="font-mono text-sm text-slate-200">{trace.message}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
