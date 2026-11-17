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
    <span className="rounded-full border border-[#E7E5E0] bg-[#E6F4EA] px-2 py-1 text-xs font-medium text-[#2F7D4F]">
      {labelMap[state]}
    </span>
  );
}

