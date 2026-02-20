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
    active: "border-teal-300/50 bg-teal-300/15 ring-1 ring-teal-300/30",
    idle: "border-teal-300/20 bg-teal-300/8",
    text: "text-teal-200",
  },
  {
    value: "auto_hold",
    label: "Auto hold",
    description: "Soft-hold, no confirm.",
    active: "border-sky-300/50 bg-sky-300/15 ring-1 ring-sky-300/30",
    idle: "border-sky-300/20 bg-sky-300/8",
    text: "text-sky-200",
  },
  {
    value: "auto_execute",
    label: "Auto execute",
    description: "Books without asking.",
    active: "border-violet-300/50 bg-violet-300/15 ring-1 ring-violet-300/30",
    idle: "border-violet-300/20 bg-violet-300/8",
    text: "text-violet-200",
  },
] as const;

const inputCls =
  "w-full rounded-lg border border-white/10 bg-[#060b12] px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors focus:border-amber-300/40 focus:ring-1 focus:ring-amber-300/20";
const labelCls = "flex flex-col gap-1.5 text-sm text-slate-400";

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
          className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-slate-300 transition-colors hover:border-white/20 hover:bg-white/8 hover:text-slate-100"
        >
          Edit
        </button>
        <button
          onClick={() => setMode("delete")}
          className="rounded-lg border border-rose-300/20 bg-rose-300/8 px-3 py-1.5 text-sm text-rose-300 transition-colors hover:bg-rose-300/15"
        >
          Delete
        </button>
      </div>
    );
  }

  /* ── Delete confirm ── */
  if (mode === "delete") {
    return (
      <div className="rounded-2xl border border-rose-300/20 bg-rose-300/6 p-5">
        <p className="text-sm font-medium text-rose-200">
          Delete &ldquo;{autopilot.name}&rdquo;?
        </p>
        <p className="mt-1 text-xs text-rose-300/70">
          This will remove the autopilot and all its runs. This cannot be undone.
        </p>
        {error && (
          <p className="mt-2 text-xs text-rose-400">{error}</p>
        )}
        <div className="mt-4 flex items-center gap-3">
          <button
            onClick={() => void handleDelete()}
            disabled={deleting}
            className="rounded-lg border border-rose-300/30 bg-rose-300/15 px-4 py-2 text-sm text-rose-200 transition-colors hover:bg-rose-300/25 disabled:opacity-50"
          >
            {deleting ? "Deleting…" : "Yes, delete"}
          </button>
          <button
            onClick={() => { setMode("view"); setError(""); }}
            className="text-sm text-slate-500 hover:text-slate-300"
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
        <h3 className="text-sm font-semibold text-slate-200">Edit autopilot</h3>
        <button
          type="button"
          onClick={() => { setMode("view"); setError(""); }}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          Discard
        </button>
      </div>

      {/* Identity */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
        <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Identity
        </h4>
        <label className={labelCls}>
          Name
          <input required value={form.name} onChange={(e) => set("name", e.target.value)} className={inputCls} />
        </label>
        <label className={`${labelCls} mt-4`}>
          Goal
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
      <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
        <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
                    : "border-white/10 bg-white/3 text-slate-400 hover:border-white/20 hover:text-slate-300"
                }`}
              >
                <span>{mode.icon}</span>
                <span>{mode.label}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Trigger */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
        <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Trigger
        </h4>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className={labelCls}>
            Type
            <select
              value={form.triggerType}
              onChange={(e) => set("triggerType", e.target.value as typeof form.triggerType)}
              className={inputCls}
            >
              <option value="time">Time</option>
              <option value="context">Context</option>
              <option value="event">Event</option>
            </select>
          </label>
          <label className={labelCls}>
            Expression
            <input required value={form.trigger} onChange={(e) => set("trigger", e.target.value)} className={inputCls} />
          </label>
        </div>
        <label className={`${labelCls} mt-4`}>
          Action
          <input required value={form.action} onChange={(e) => set("action", e.target.value)} className={inputCls} />
        </label>
      </section>

      {/* Approval */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
        <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
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
              <p className="mt-0.5 text-xs text-slate-500">{opt.description}</p>
            </button>
          ))}
        </div>
      </section>

      {/* Budget */}
      <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
        <h4 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
          Budget cap
        </h4>
        <label className={labelCls}>
          Max spend per action (USD)
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-500">$</span>
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
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">
          <span>⚠</span>
          <span>{error}</span>
        </div>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg border border-amber-300/25 bg-amber-300/15 px-5 py-2.5 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-300/25 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={() => { setMode("view"); setError(""); }}
          className="text-sm text-slate-500 hover:text-slate-300"
        >
          Discard
        </button>
      </div>
    </form>
  );
}
