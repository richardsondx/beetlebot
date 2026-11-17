type ContextBadgeProps = {
  label: string;
  value: string;
};

export function ContextBadge({ label, value }: ContextBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#E7E5E0] bg-[#E5EFFB] px-2 py-1 text-xs text-[#2F5FA8]">
      <span className="text-[#2F5FA8]">{label}:</span>
      <span>{value}</span>
    </span>
  );
}

