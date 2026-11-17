import { AgentConsole } from "@/components/debug/agent-console";

export default function DebugPage() {
  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto max-w-[760px] space-y-6 px-4 py-8 md:px-8">
        <header>
          <h1 className="text-2xl font-semibold leading-8 text-[#1C1B19]">Debug</h1>
          <p className="mt-1 text-[13px] leading-[18px] text-[#6B6862]">
            Run context, tool call traces, and agent state for builders.
          </p>
        </header>
        <div className="rounded-xl bg-[#F2F1EE] p-4 font-mono text-[13px] leading-5 text-[#1C1B19]">
          <AgentConsole />
        </div>
      </div>
    </div>
  );
}
