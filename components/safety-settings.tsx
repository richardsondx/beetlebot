"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { SafetySettings } from "@/lib/types";

const APPROVAL_OPTIONS: { value: SafetySettings["defaultApproval"]; label: string }[] = [
  { value: "ask_first", label: "Ask before booking" },
  { value: "auto_hold", label: "Auto hold" },
  { value: "auto_execute", label: "Auto execute" },
];

type EditingField = "defaultApproval" | "spendCap" | "quietHours" | null;

export function SafetySettingsCard({ initial }: { initial: SafetySettings }) {
  const [settings, setSettings] = useState<SafetySettings>(initial);
  const [editing, setEditing] = useState<EditingField>(null);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ spendCap: "", quietStart: "", quietEnd: "" });
  const wrapperRef = useRef<HTMLDivElement>(null);

  const save = useCallback(
    async (patch: Partial<SafetySettings>) => {
      setSaving(true);
      try {
        const res = await fetch("/api/settings", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (res.ok) {
          const { data } = await res.json();
          setSettings(data);
        }
      } finally {
        setSaving(false);
        setEditing(null);
      }
    },
    [],
  );

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (editing && wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setEditing(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [editing]);

  const approvalLabel =
    APPROVAL_OPTIONS.find((o) => o.value === settings.defaultApproval)?.label ??
    settings.defaultApproval;

  return (
    <section ref={wrapperRef} className="rounded-2xl border border-[#E7E5E0] bg-white p-5">
      <div className="mb-4 flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#E6F4EA] text-sm">
          🛡️
        </span>
        <h2 className="text-sm font-semibold text-[#1C1B19]">Safety &amp; Approvals</h2>
      </div>

      <div className="space-y-3">
        {/* Default approval */}
        <Row
          label="Default approval"
          editing={editing === "defaultApproval"}
          onEdit={() => setEditing("defaultApproval")}
          display={approvalLabel}
          saving={saving}
        >
          <div className="flex flex-col gap-1">
            {APPROVAL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => save({ defaultApproval: opt.value })}
                className={`rounded-md px-3 py-1.5 text-left text-xs transition-colors ${
                  settings.defaultApproval === opt.value
                    ? "bg-[#E6F4EA] text-[#2F7D4F]"
                    : "text-[#6B6862] hover:bg-[#F2F1EE]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </Row>

        {/* Spend cap */}
        <Row
          label="Spend cap"
          editing={editing === "spendCap"}
          onEdit={() => {
            setDraft((d) => ({ ...d, spendCap: String(settings.spendCap) }));
            setEditing("spendCap");
          }}
          display={`$${settings.spendCap} / action`}
          saving={saving}
        >
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const val = parseInt(draft.spendCap, 10);
              if (val > 0 && val <= 10000) save({ spendCap: val });
            }}
          >
            <div className="flex items-center rounded-md border border-[#E7E5E0] bg-[#F2F1EE] px-2">
              <span className="text-xs text-[#6B6862]">$</span>
              <input
                autoFocus
                type="number"
                min={1}
                max={10000}
                value={draft.spendCap}
                onChange={(e) => setDraft((d) => ({ ...d, spendCap: e.target.value }))}
                className="w-20 bg-transparent py-1.5 pl-1 text-xs text-[#1C1B19] outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-[#E6F4EA] px-2.5 py-1.5 text-xs font-medium text-[#2F7D4F] transition-colors hover:bg-[#E6F4EA]"
            >
              Save
            </button>
          </form>
        </Row>

        {/* Quiet hours */}
        <Row
          label="Quiet hours"
          editing={editing === "quietHours"}
          onEdit={() => {
            setDraft((d) => ({
              ...d,
              quietStart: settings.quietStart,
              quietEnd: settings.quietEnd,
            }));
            setEditing("quietHours");
          }}
          display={`${settings.quietStart} – ${settings.quietEnd}`}
          saving={saving}
        >
          <form
            className="flex items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              save({ quietStart: draft.quietStart, quietEnd: draft.quietEnd });
            }}
          >
            <input
              autoFocus
              type="time"
              value={draft.quietStart}
              onChange={(e) => setDraft((d) => ({ ...d, quietStart: e.target.value }))}
              className="rounded-md border border-[#E7E5E0] bg-[#F2F1EE] px-2 py-1.5 text-xs text-[#1C1B19] outline-none [color-scheme:dark]"
            />
            <span className="text-xs text-[#6B6862]">–</span>
            <input
              type="time"
              value={draft.quietEnd}
              onChange={(e) => setDraft((d) => ({ ...d, quietEnd: e.target.value }))}
              className="rounded-md border border-[#E7E5E0] bg-[#F2F1EE] px-2 py-1.5 text-xs text-[#1C1B19] outline-none [color-scheme:dark]"
            />
            <button
              type="submit"
              className="rounded-md bg-[#E6F4EA] px-2.5 py-1.5 text-xs font-medium text-[#2F7D4F] transition-colors hover:bg-[#E6F4EA]"
            >
              Save
            </button>
          </form>
        </Row>
      </div>
    </section>
  );
}

function Row({
  label,
  display,
  editing,
  onEdit,
  saving,
  children,
}: {
  label: string;
  display: string;
  editing: boolean;
  onEdit: () => void;
  saving: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-[#6B6862]">{label}</span>
      {editing ? (
        <div className="relative">{children}</div>
      ) : (
        <button
          onClick={onEdit}
          disabled={saving}
          className="group rounded-md border border-[#E7E5E0] bg-[#F2F1EE] px-2.5 py-1 text-xs text-[#1C1B19] transition-colors hover:border-[#E7E5E0] hover:bg-[#E6F4EA] hover:text-[#2F7D4F]"
        >
          {display}
          <span className="ml-1.5 text-[10px] text-[#9A968F] opacity-0 transition-opacity group-hover:opacity-100">
            edit
          </span>
        </button>
      )}
    </div>
  );
}
