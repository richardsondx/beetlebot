type CommandCardProps = {
  title: string;
  subtitle: string;
  tag?: string;
};

export function CommandCard({ title, subtitle, tag }: CommandCardProps) {
  return (
    <div className="rounded-2xl border border-[#E7E5E0] bg-white p-4 shadow-lg shadow-black/10">
      <div className="mb-2 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        {tag ? (
          <span className="rounded-full border border-[#E7E5E0] bg-[#FBF1E1] px-2 py-1 text-xs text-[#8A5710]">
            {tag}
          </span>
        ) : null}
      </div>
      <p className="text-sm text-[#6B6862]">{subtitle}</p>
    </div>
  );
}

