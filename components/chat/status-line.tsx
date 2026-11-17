export function StatusLine({ text }: { text: string }) {
  return (
    <div
      aria-live="polite"
      className="flex items-center gap-2.5 px-1 py-1 text-sm text-[#6B6862]"
    >
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-[#C8811A] motion-reduce:animate-none" />
      <span>{text}</span>
    </div>
  );
}
