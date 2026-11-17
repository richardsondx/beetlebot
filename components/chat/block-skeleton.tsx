/** Skeleton frames the same height as the real cards, so nothing jumps. */
export function BlockSkeleton({ type }: { type: string }) {
  return (
    <div className="mt-3" aria-hidden="true">
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-2xl border border-[#E7E5E0] bg-white p-4"
          >
            <div className="h-4 w-2/3 animate-pulse rounded bg-[#F2F1EE] motion-reduce:animate-none" />
            <div className="mt-3 h-3 w-full animate-pulse rounded bg-[#F2F1EE] motion-reduce:animate-none" />
            <div className="mt-2 h-3 w-4/5 animate-pulse rounded bg-[#F2F1EE] motion-reduce:animate-none" />
            <div className="mt-4 h-6 w-1/2 animate-pulse rounded bg-[#F2F1EE] motion-reduce:animate-none" />
            <div className="mt-2 h-3 w-3/5 animate-pulse rounded bg-[#F2F1EE] motion-reduce:animate-none" />
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-[#9A968F]">
        {type === "flight_compare" ? "Finding flights…" : "Loading…"}
      </p>
    </div>
  );
}
