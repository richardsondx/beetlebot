"use client";

import type { FollowUp } from "@/lib/chat/rich-message";

export function FollowUpChips({
  items,
  disabled,
  onSend,
  onEdit,
}: {
  items: FollowUp[];
  disabled: boolean;
  onSend: (chip: FollowUp) => void;
  onEdit: (chip: FollowUp) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="relative mt-3">
      <div className="flex gap-2 overflow-x-auto pb-1 sm:flex-wrap sm:overflow-visible">
        {items.map((chip) => (
          <button
            key={chip.message}
            type="button"
            disabled={disabled}
            onClick={(e) => {
              if (e.altKey) {
                onEdit(chip);
              } else {
                onSend(chip);
              }
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              onEdit(chip);
            }}
            className="h-9 shrink-0 rounded-full border border-white/15 bg-transparent px-3.5 text-sm text-slate-300 transition-colors hover:border-amber-300/40 hover:text-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {chip.label}
          </button>
        ))}
      </div>
      <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-gradient-to-l from-[#131c2e] to-transparent sm:hidden" />
    </div>
  );
}
