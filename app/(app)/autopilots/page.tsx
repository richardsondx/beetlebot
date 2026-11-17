import Link from "next/link";
import { listAutopilots } from "@/lib/repositories/autopilots";
import { ZapIcon } from "@/components/ui/icons";

const statusConfig: Record<string, { badge: string; label: string }> = {
  on: { badge: "bg-[#E6F4EA] text-[#2F7D4F]", label: "On" },
  paused: { badge: "bg-[#F2F1EE] text-[#6B6862]", label: "Paused" },
  off: { badge: "bg-[#F2F1EE] text-[#6B6862]", label: "Off" },
};

const approvalConfig: Record<string, { label: string }> = {
  ask_first: { label: "Ask first" },
  auto_hold: { label: "Auto hold" },
  auto_execute: { label: "Auto execute" },
};

type AutopilotRow = {
  id: string;
  name: string;
  goal: string;
  trigger: string;
  approvalRule: string;
  mode: string;
  status: string;
  budgetCap?: number | null;
};

export default async function AutopilotsPage() {
  const autopilots = await (listAutopilots() as Promise<AutopilotRow[]>);
  const activeCount = autopilots.filter((a: AutopilotRow) => a.status === "on").length;

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto max-w-[760px] space-y-6 px-4 py-8 md:px-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold leading-8 text-[#1C1B19]">Autopilots</h1>
            <p className="mt-1 text-[13px] leading-[18px] text-[#6B6862]">
              Recurring plans Beetlebot runs for you.
            </p>
            {activeCount > 0 && (
              <p className="mt-1 text-[13px] text-[#6B6862]">{activeCount} active</p>
            )}
          </div>
          <Link
            href="/autopilots/new"
            className="shrink-0 rounded-[10px] bg-[#C8811A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#A96B12]"
          >
            + New autopilot
          </Link>
        </header>

        {autopilots.length === 0 ? (
          <div className="rounded-2xl border border-[#E7E5E0] bg-white px-6 py-16 text-center">
            <p className="text-sm font-medium text-[#1C1B19]">No autopilots yet</p>
            <p className="mt-1 text-[13px] text-[#6B6862]">
              Ask in chat: &ldquo;Every Friday, plan a date night.&rdquo;
            </p>
            <Link
              href="/autopilots/new"
              className="mt-4 inline-block rounded-[10px] bg-[#C8811A] px-4 py-2 text-sm font-medium text-white hover:bg-[#A96B12]"
            >
              Create your first autopilot
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-[#E7E5E0]">
            {autopilots.map((item: AutopilotRow) => {
              const s = statusConfig[item.status] ?? statusConfig.off;
              const a = approvalConfig[item.approvalRule] ?? approvalConfig.ask_first;
              return (
                <Link
                  key={item.id}
                  href={`/autopilots/${item.id}`}
                  className="flex items-center gap-4 rounded-xl px-4 py-3 transition-colors hover:bg-[#F2F1EE]"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] bg-[#FBF1E1] text-[#A96B12]">
                    <ZapIcon size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium leading-5 text-[#1C1B19]">
                      {item.name}
                    </span>
                    <span className="block truncate text-[13px] leading-[18px] text-[#6B6862]">
                      {item.trigger} · {item.mode} · {a.label}
                      {item.budgetCap ? ` · $${item.budgetCap} cap` : ""}
                    </span>
                    <span className="block truncate text-[13px] leading-[18px] text-[#6B6862]">{item.goal}</span>
                  </span>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${s.badge}`}>
                    {s.label}
                  </span>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
