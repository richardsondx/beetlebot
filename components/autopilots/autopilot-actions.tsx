"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PLANNING_MODES } from "@/lib/constants";

type Autopilot = {
  id: string;
  name: string;
  goal: string;
  triggerType: string;
  trigger: string;
  action: string;
  approvalRule: string;
  mode: string;
  budgetCap: number;
  status: string;
};

type Props = { autopilot: Autopilot };

const approvalOptions = [
  {
    value: "ask_first",
    label: "Ask first",
    description: "Proposes, you confirm.",
    active: "border-[#E7E5E0] bg-[#E6F4EA] ring-1 ring-teal-300/30",
    idle: "border-[#E7E5E0] bg-[#E6F4EA]",
    text: "text-[#2F7D4F]",
  },
  {
    value: "auto_hold",
    label: "Auto hold",
    description: "Soft-hold, no confirm.",
    active: "border-[#E7E5E0] bg-[#E5EFFB] ring-1 ring-sky-300/30",
    idle: "border-[#E7E5E0] bg-[#E5EFFB]",
    text: "text-[#2F5FA8]",
  },
  {
    value: "auto_execute",
    label: "Auto execute",
    description: "Books without asking.",
    active: "border-[#E7E5E0] bg-[#EFEAFB] ring-1 ring-violet-300/30",
    idle: "border-[#E7E5E0] bg-[#EFEAFB]",
    text: "text-[#6146A8]",
  },
] as const;

const inputCls =
  "w-full rounded-lg border border-[#E7E5E0] bg-white px-3 py-2.5 text-sm text-[#1C1B19] placeholder-slate-600 outline-none transition-colors focus:border-[#E7E5E0] focus:ring-1 focus:ring-[#E7E5E0]";
const labelCls = "flex flex-col gap-1.5 text-sm text-[#6B6862]";

export function AutopilotActions({ autopilot }: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"view" | "edit" | "delete">("view");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const [budgetCapInput, setBudgetCapInput] = useState(String(autopilot.budgetCap));
  const [form, setForm] = useState({
    name: autopilot.name,
    goal: autopilot.goal,
    triggerType: autopilot.triggerType as "time" | "context" | "event",
    trigger: autopilot.trigger,
    action: autopilot.action,
    approvalRule: autopilot.approvalRule as "ask_first" | "auto_hold" | "auto_execute",
    mode: autopilot.mode,
    budgetCap: autopilot.budgetCap,
    status: autopilot.status as "on" | "paused",
  });

  function set<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const parsedBudgetCap = Number.parseInt(budgetCapInput, 10);
    if (!Number.isFinite(parsedBudgetCap) || parsedBudgetCap < 1 || parsedBudgetCap > 10000) {
      setError("Budget cap must be a whole number between 1 and 10000.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/autopilots/${autopilot.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, budgetCap: parsedBudgetCap }),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Could not save changes.");
      setMode("view");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/autopilots/${autopilot.id}`, { method: "DELETE" });
      if (!res.ok) {
        const payload = (await res.json()) as { error?: string };
        throw new Error(payload.error ?? "Could not delete autopilot.");
      }
      router.push("/autopilots");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
      setDeleting(false);
    }
  }

  /* ── Action bar (view mode) ── */
  if (mode === "view") {
    return (
      <div className="flex flex-wrap items-center gap-2">
        <button
          onClick={() => setMode("edit")}
          className="rounded-lg border border-[#E7E5E0] bg-[#F2F1EE] px-3 py-1.5 text-sm text-[#6B6862] transition-colors hover:border-[#E7E5E0] hover:bg-[#F2F1EE] hover:text-[#1C1B19]"
        >
          Edit
        </button>
        <button
          onClick={() => setMode("delete")}
          className="rounded-lg border border-[#E7E5E0] bg-[#FBE8EC] px-3 py-1.5 text-sm text-[#C23B32] transition-colors hover:bg-[#FBE8EC]"
        >
          Delete
        </button>
      </div>
    );
  }

  /* ── Delete confirm ── */
  if (mode === "delete") {
    return (
      <div className="rounded-2xl border border-[#E7E5E0] bg-[#FBE8EC] p-5">
        <p className="text-sm font-medium text-[#C23B32]">
          Delete &ldquo;{autopilot.name}&rdquo;?
        </p>
        <p className="mt-1 text-xs text-[#C23B32]">
          This will remove the autopilot and all its runs. This cannot be undone.
        </p>
        {error && (
          <p className="mt-2 text-xs text-rose-400">{error}</p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="rounded-lg border border-[#E7E5E0] bg-[#FBE8EC] px-4 py-2 text-sm text-[#C23B32] transition-colors hover:bg-[#FBE8EC] disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            onClick={() => { setMode("view"); setError(""); }}
            className="text-sm text-[#6B6862] hover:text-[#6B6862]"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  /* ── Edit form ── */
  return (
    <form onSubmit={(e) => void handleSave(e)} className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-[#1C1B19]">Edit autopilot</h3>
        <button
          type="button"
          onClick={() => { setMode("view"); setError(""); }}
          className="text-xs text-[#6B6862] hover:text-[#6B6862]"
        >
          Discard
        </button>
      </div>

      {/* Identity */}
      <section className="rounded-2xl border border-[#E7E5E0] bg-white p-5">
        <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#6B6862]">
          Identity
        </h4>
        <label className={labelCls}>
          Name
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
        </label>
        <label className={`${labelCls} mt-4`}>
          Objective
          <span className="text-xs text-[#9A968F]">The big picture — what is this autopilot working toward?</span>
          <textarea
            required
            value={form.goal}
            onChange={(e) => set("goal", e.target.value)}
            rows={2}
            className={`${inputCls} resize-none`}
          />
        </label>
        <label className={`${labelCls} mt-4`}>
          Status
          <select
            value={form.status}
            onChange={(e) => set("status", e.target.value as "on" | "paused")}
            className={inputCls}
          >
            <option value="on">On</option>
            <option value="paused">Paused</option>
          </select>
        </label>
      </section>

      {/* Mode */}
      <section className="rounded-2xl border border-[#E7E5E0] bg-white p-5">
        <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#6B6862]">
          Mode
        </h4>
        <div className="flex flex-wrap gap-2">
          {PLANNING_MODES.map((mode) => {
            const selected = form.mode === mode.id;
            return (
              <button
                key={mode.id}
                type="button"
                onClick={() => set("mode", mode.id)}
                className={`flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-all ${
                  selected
                    ? mode.activeColor + " border-current"
                    : "border-[#E7E5E0] bg-[#F2F1EE] text-[#6B6862] hover:border-[#E7E5E0] hover:text-[#6B6862]"
                }`}
              >
                <span>{mode.icon}</span>
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Trigger: When → Then */}
      <section className="rounded-2xl border border-[#E7E5E0] bg-white p-5">
        <h4 className="mb-5 text-xs font-semibold uppercase tracking-wider text-[#6B6862]">
          Trigger
        </h4>

        {/* ── WHEN ── */}
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#6B6862]">When</span>
          <span className="text-xs text-[#9A968F]">What causes this autopilot to run?</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {([
            { value: "time", label: "Time", icon: "🕐", description: "On a schedule or at a specific time." },
            { value: "context", label: "Context", icon: "📍", description: "When conditions change — weather, location, etc." },
            { value: "event", label: "Event", icon: "⚡", description: "In response to an external event or notification." },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set("triggerType", opt.value)}
              className={`rounded-xl border p-3 text-left transition-all ${
                form.triggerType === opt.value
                  ? "border-[#E7E5E0] bg-[#FBF1E1] ring-1 ring-[#E7E5E0]"
                  : "border-[#E7E5E0] bg-[#F2F1EE] hover:border-[#E7E5E0]"
              }`}
            >
              <p className={`text-sm font-medium ${form.triggerType === opt.value ? "text-[#8A5710]" : "text-[#6B6862]"}`}>
                <span className="mr-1.5">{opt.icon}</span>{opt.label}
              </p>
              <p className="mt-0.5 text-xs text-[#6B6862]">{opt.description}</p>
            </button>
          ))}
        </div>
        <label className={`${labelCls} mt-3`}>
          <input
            required
            value={form.trigger}
            onChange={(e) => set("trigger", e.target.value)}
            placeholder={
              form.triggerType === "time" ? "e.g. Every Tuesday at 15:00"
                : form.triggerType === "context" ? "e.g. When it's raining in the evening"
                : "e.g. When a new calendar invite arrives"
            }
            className={inputCls}
          />
        </label>

        {/* ── divider ── */}
        <div className="my-5 border-t border-[#E7E5E0]" />

        {/* ── THEN ── */}
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#6B6862]">Then</span>
          <span className="text-xs text-[#9A968F]">Tell Beetlebot what to do — like giving instructions to a smart assistant.</span>
        </div>
        <label className={labelCls}>
          <textarea
            required
            value={form.action}
            onChange={(e) => set("action", e.target.value)}
            placeholder={"e.g. Block 18:00\u201321:00 on my calendar and suggest 2 restaurant options under $80.\nIf it\u2019s raining, suggest indoor plans instead."}
            rows={4}
            className={`${inputCls} resize-none`}
          />
        </label>
      </section>

      {/* Approval */}
      <section className="rounded-2xl border border-[#E7E5E0] bg-white p-5">
        <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#6B6862]">
          Approval mode
        </h4>
        <div className="grid gap-3 sm:grid-cols-3">
          {approvalOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => set("approvalRule", opt.value)}
              className={`rounded-xl border p-3 text-left transition-all ${
                form.approvalRule === opt.value ? opt.active : opt.idle
              }`}
            >
              <p className={`text-sm font-medium ${opt.text}`}>{opt.label}</p>
              <p className="mt-0.5 text-xs text-[#6B6862]">{opt.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Budget */}
      <section className="rounded-2xl border border-[#E7E5E0] bg-white p-5">
        <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-[#6B6862]">
          Budget cap
        </h4>
        <label className={labelCls}>
          Max spend per action (USD)
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B6862]">$</span>
            <input
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              required
              value={budgetCapInput}
              onChange={(e) => {
                const value = e.target.value.replace(/\D/g, "");
                setBudgetCapInput(value);
              }}
              className={`${inputCls} pl-7`}
            />
          </div>
        </label>
      </section>

      {error && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-[#C23B32]">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg border border-[#E7E5E0] bg-[#FBF1E1] px-5 py-2.5 text-sm font-medium text-[#8A5710] transition-colors hover:bg-[#A96B12]/25 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => { setMode("view"); setError(""); }}
          className="text-sm text-[#6B6862] hover:text-[#6B6862]"
        >
          Discard
        </button>
      </div>
    </form>
  );
}
