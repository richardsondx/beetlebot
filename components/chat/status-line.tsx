export function StatusLine({ text }: { text: string }) {
  return (
    <div
      aria-live="polite"
      className="flex items-center gap-2.5 px-1 py-1 text-sm text-slate-500"
    >
      <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-400 motion-reduce:animate-none" />
      <span>{text}</span>
    </div>
  );
}
