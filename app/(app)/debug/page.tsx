import { AgentConsole } from "@/components/debug/agent-console";

export default function DebugPage() {
  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        <header>
          <div className="mb-1 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-300/10 text-lg">
              🐛
            </span>
            <h1 className="text-2xl font-semibold">Debug</h1>
          </div>
          <p className="text-sm text-slate-400">
            Run context, tool call traces, and agent state for builders.
          </p>
        </header>
        <AgentConsole />
      </div>
    </div>
  );
}
