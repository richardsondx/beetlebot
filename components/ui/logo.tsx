export function Logo({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <ellipse cx="12" cy="14" rx="7" ry="9" />
      <circle cx="12" cy="4.5" r="3" />
      <line x1="12" y1="7.5" x2="12" y2="22" />
      <line x1="5.5" y1="11" x2="2.5" y2="9" />
      <line x1="5" y1="15" x2="1.5" y2="15" />
      <line x1="5.5" y1="19" x2="2.5" y2="21" />
      <line x1="18.5" y1="11" x2="21.5" y2="9" />
      <line x1="19" y1="15" x2="22.5" y2="15" />
      <line x1="18.5" y1="19" x2="21.5" y2="21" />
    </svg>
  );
}
