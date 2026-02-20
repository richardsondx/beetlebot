type ContextBadgeProps = {
  label: string;
  value: string;
};

export function ContextBadge({ label, value }: ContextBadgeProps) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-sky-300/30 bg-sky-400/10 px-2 py-1 text-xs text-sky-100">
      <span className="text-sky-200/80">{label}:</span>
      <span>{value}</span>
    </span>
  );
}

