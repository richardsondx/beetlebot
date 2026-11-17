type SoftHoldRowProps = {
  title: string;
  window: string;
  status: "held" | "released";
};

export function SoftHoldRow({ title, window, status }: SoftHoldRowProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-[#E7E5E0] bg-white px-3 py-2">
      <div>
        <p className="text-sm font-medium text-[#1C1B19]">{title}</p>
        <p className="text-xs text-[#6B6862]">{window}</p>
      </div>
      <span
        className={`rounded-full px-2 py-1 text-xs ${
          status === "held"
            ? "bg-[#E6F4EA] text-[#2F7D4F]"
            : "bg-[#EEF0F3] text-[#4A5361]"
        }`}
      >
        {status}
      </span>
    </div>
  );
}

