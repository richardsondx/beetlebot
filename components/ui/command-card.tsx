type CommandCardProps = {
  title: string;
  subtitle: string;
  tag?: string;
};

export function CommandCard({ title, subtitle, tag }: CommandCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#101826] p-4 shadow-lg shadow-black/20">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {tag ? (
          <span className="rounded-full border border-amber-300/30 bg-amber-300/10 px-2 py-1 text-xs text-amber-200">
            {tag}
          </span>
        ) : null}
      </div>
      <p className="text-sm text-slate-300">{subtitle}</p>
    </div>
  );
}

