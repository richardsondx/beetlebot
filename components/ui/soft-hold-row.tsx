type SoftHoldRowProps = {
  title: string;
  window: string;
  status: "held" | "released";
};

export function SoftHoldRow({ title, window, status }: SoftHoldRowProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-white/10 bg-[#0d1422] px-3 py-2">
      <div>
        <p className="text-sm font-medium text-slate-100">{title}</p>
        <p className="text-xs text-slate-400">{window}</p>
      </div>
      <span
        className={`rounded-full px-2 py-1 text-xs ${
          status === "held"
            ? "bg-emerald-300/20 text-emerald-200"
            : "bg-zinc-300/20 text-zinc-200"
        }`}
      >
        {status}
      </span>
    </div>
  );
}

