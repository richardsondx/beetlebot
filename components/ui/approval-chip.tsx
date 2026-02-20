type ApprovalChipProps = {
  state: "ask_first" | "auto_hold" | "auto_execute";
};

const labelMap = {
  ask_first: "Ask first",
  auto_hold: "Auto hold",
  auto_execute: "Auto execute",
};

export function ApprovalChip({ state }: ApprovalChipProps) {
  return (
    <span className="rounded-full border border-teal-300/30 bg-teal-400/10 px-2 py-1 text-xs font-medium text-teal-100">
      {labelMap[state]}
    </span>
  );
}

