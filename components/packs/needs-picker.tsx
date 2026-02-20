"use client";

import { PERMISSION_GROUPS, PermissionDefinition } from "@/lib/constants";

type NeedsPickerProps = {
  value: string[];
  onChange: (needs: string[]) => void;
};

function PermissionCard({
  permission,
  selected,
  onToggle,
}: {
  permission: PermissionDefinition;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`group relative flex flex-col gap-1.5 rounded-xl border p-3 text-left transition-all ${
        selected
          ? "border-amber-300/40 bg-amber-300/8 ring-1 ring-amber-300/20"
          : "border-white/8 bg-white/2 hover:border-white/15 hover:bg-white/4"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={`text-sm font-medium leading-tight ${
            selected ? "text-amber-100" : "text-slate-300 group-hover:text-slate-200"
          }`}
        >
          {permission.label}
        </span>
        <span
          className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] transition-all ${
            selected
              ? "border-amber-300/60 bg-amber-300/20 text-amber-200"
              : "border-white/15 text-transparent"
          }`}
        >
          ✓
        </span>
      </div>
      <p
        className={`text-xs leading-snug ${
          selected ? "text-amber-200/60" : "text-slate-600 group-hover:text-slate-500"
        }`}
      >
        {permission.description}
      </p>
      <code
        className={`mt-0.5 text-[10px] font-mono ${
          selected ? "text-amber-300/50" : "text-slate-700"
        }`}
      >
        {permission.key}
      </code>
    </button>
  );
}

export function NeedsPicker({ value, onChange }: NeedsPickerProps) {
  function toggle(key: string) {
    if (value.includes(key)) {
      onChange(value.filter((k) => k !== key));
    } else {
      onChange([...value, key]);
    }
  }

  return (
    <div className="space-y-4">
      {PERMISSION_GROUPS.map((group) => (
        <div key={group.integration}>
          <div className="mb-2 flex items-center gap-1.5">
            <span className="text-sm">{group.integrationIcon}</span>
            <span className="text-xs font-medium text-slate-400">{group.integration}</span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {group.permissions.map((perm) => (
              <PermissionCard
                key={perm.key}
                permission={perm}
                selected={value.includes(perm.key)}
                onToggle={() => toggle(perm.key)}
              />
            ))}
          </div>
        </div>
      ))}

      {value.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {value.map((key) => (
            <span
              key={key}
              className="inline-flex items-center gap-1 rounded-md border border-amber-300/20 bg-amber-300/8 px-2 py-0.5 font-mono text-[10px] text-amber-300/70"
            >
              {key}
              <button
                type="button"
                onClick={() => toggle(key)}
                className="ml-0.5 leading-none text-amber-300/40 hover:text-amber-200"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      {value.length === 0 && (
        <p className="text-xs text-slate-600">No permissions selected — pack won&apos;t require any integrations</p>
      )}
    </div>
  );
}
