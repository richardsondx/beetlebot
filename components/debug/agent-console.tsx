import { db } from "@/lib/db";
import { fmtTime, fmtRelative } from "@/lib/format";

const approvalBadge: Record<string, string> = {
  ask_first: "border-[#E7E5E0] bg-[#E6F4EA] text-[#2F7D4F]",
  auto_hold: "border-[#E7E5E0] bg-[#E5EFFB] text-[#2F5FA8]",
  auto_execute: "border-[#E7E5E0] bg-[#EFEAFB] text-[#6146A8]",
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
        <div className="rounded-xl border border-[#E7E5E0] bg-white p-4">
          <p className="mb-1 text-xs text-[#6B6862]">Status</p>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#2F7D4F] shadow-[0_0_6px_theme(colors.emerald.400)]" />
            <span className="text-sm font-medium text-[#2F7D4F]">Connected</span>
          </div>
        </div>
        <div className="rounded-xl border border-[#E7E5E0] bg-white p-4">
          <p className="mb-1 text-xs text-[#6B6862]">Active autopilot</p>
          <p className="text-sm font-medium text-[#1C1B19] truncate">
            {autopilot?.name ?? "None"}
          </p>
        </div>
        <div className="rounded-xl border border-[#E7E5E0] bg-white p-4">
          <p className="mb-1 text-xs text-[#6B6862]">Approval gate</p>
          <span className={`rounded-full border px-2.5 py-0.5 text-xs ${apBadge}`}>
            {apGate.replace(/_/g, " ")}
          </span>
        </div>
      </section>

      {/* Trace stream */}
      <section className="rounded-2xl border border-[#E7E5E0] bg-white">
        <header className="flex items-center justify-between border-b border-[#E7E5E0] px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#2F7D4F]" />
            <h2 className="text-sm font-semibold text-[#1C1B19]">Trace stream</h2>
          </div>
          <span className="rounded-full border border-[#E7E5E0] bg-[#F2F1EE] px-2 py-0.5 text-xs text-[#6B6862]">
            {debugTraces.length} entries
          </span>
        </header>

        {debugTraces.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <p className="text-sm text-[#6B6862]">No trace events yet.</p>
            <p className="mt-1 text-xs text-[#9A968F]">
              Tool calls and agent steps will appear here.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E7E5E0]">
            {debugTraces.map((trace, idx) => (
              <div key={trace.id} className="flex gap-4 px-5 py-3">
                <div className="w-14 shrink-0 text-right">
                  <p className="font-mono text-xs text-[#6B6862]">{fmtTime(trace.at)}</p>
                  {idx === 0 && (
                    <p className="mt-0.5 text-xs text-[#9A968F]">{fmtRelative(trace.at)}</p>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {"scope" in trace && trace.scope && (
                    <span className="mr-2 rounded border border-[#E7E5E0] bg-[#F2F1EE] px-1.5 py-0.5 font-mono text-xs text-[#6B6862]">
                      {String(trace.scope)}
                    </span>
                  )}
                  <span className="font-mono text-sm text-[#1C1B19]">{trace.message}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
