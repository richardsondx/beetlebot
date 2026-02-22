"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PLANNING_MODES } from "@/lib/constants";

type FormState = {
  name: string;
  goal: string;
  triggerType: "time" | "context" | "event";
  trigger: string;
  action: string;
  approvalRule: "ask_first" | "auto_hold" | "auto_execute";
  mode: string;
  budgetCap: number;
};

const initialState: FormState = {
  name: "Date Night Autopilot",
  goal: "Propose weekly date-night options with weather fallback.",
  triggerType: "time",
  trigger: "Tuesday 15:00",
  action: "Hold 18:00-21:00 and suggest 2 plans",
  approvalRule: "ask_first",
  mode: "dating",
  budgetCap: 150,
};

const approvalOptions = [
  {
    value: "ask_first",
    label: "Ask first",
    description: "Beetlebot proposes, you confirm.",
    cls: "border-teal-300/25 bg-teal-300/8",
    active: "border-teal-300/50 bg-teal-300/15 ring-1 ring-teal-300/30",
    text: "text-teal-200",
  },
  {
    value: "auto_hold",
    label: "Auto hold",
    description: "Soft-hold time, no confirmation.",
    cls: "border-sky-300/25 bg-sky-300/8",
    active: "border-sky-300/50 bg-sky-300/15 ring-1 ring-sky-300/30",
    text: "text-sky-200",
  },
  {
    value: "auto_execute",
    label: "Auto execute",
    description: "Book and act without asking.",
    cls: "border-violet-300/25 bg-violet-300/8",
    active: "border-violet-300/50 bg-violet-300/15 ring-1 ring-violet-300/30",
    text: "text-violet-200",
  },
] as const;

const inputCls =
  "w-full rounded-lg border border-white/10 bg-[#060b12] px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors focus:border-amber-300/40 focus:ring-1 focus:ring-amber-300/20";

const labelCls = "flex flex-col gap-1.5 text-sm";
const labelTextCls = "text-slate-400";

export default function NewAutopilotPage() {
  const [form, setForm] = useState<FormState>(initialState);
  const [budgetCapInput, setBudgetCapInput] = useState(String(initialState.budgetCap));
  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!form.mode) {
      setError("Select a mode.");
      return;
    }
    const parsedBudgetCap = Number.parseInt(budgetCapInput, 10);
    if (!Number.isFinite(parsedBudgetCap) || parsedBudgetCap < 1 || parsedBudgetCap > 10000) {
      setError("Budget cap must be a whole number between 1 and 10000.");
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/autopilots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, budgetCap: parsedBudgetCap }),
      });
      const payload = (await res.json()) as { error?: string; data?: { id?: string } };
      if (!res.ok) throw new Error(payload.error ?? "Unable to create autopilot.");
      const id = payload.data?.id;
      router.push(id ? `/autopilots/${id}` : "/autopilots");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-2xl space-y-6 px-6 py-6">
        <Link href="/autopilots" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
          ← Autopilots
        </Link>

        <header>
          <div className="mb-1 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-300/10 text-lg">⚡</span>
            <h1 className="text-2xl font-semibold">New Autopilot</h1>
          </div>
          <p className="text-sm text-slate-400">
            Set an objective, define when it triggers, and tell Beetlebot what to do.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-5">
          {/* Identity */}
          <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Identity
            </h2>
            <label className={labelCls}>
              <span className={labelTextCls}>Name</span>
              <input
                required
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Date Night Autopilot"
                className={inputCls}
              />
            </label>
            <label className={`${labelCls} mt-4`}>
              <span className={labelTextCls}>Objective</span>
              <span className="text-xs text-slate-600">The big picture — what is this autopilot working toward?</span>
              <textarea
                required
                value={form.goal}
                onChange={(e) => set("goal", e.target.value)}
                placeholder="e.g. Plan a great date night every week, adjusting for weather and mood"
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </label>
          </section>

          {/* Mode */}
          <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Mode
            </h2>
            <p className="mb-3 text-xs text-slate-500">
              Which planning context does this autopilot operate in?
            </p>
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
            {!form.mode && (
              <p className="mt-2 text-xs text-slate-600">Select a mode</p>
            )}
          </section>

          {/* Trigger: When → Then */}
          <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
            <h2 className="mb-5 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Trigger
            </h2>

            {/* ── WHEN ── */}
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">When</span>
              <span className="text-xs text-slate-600">What causes this autopilot to run?</span>
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
                      ? "border-amber-300/50 bg-amber-300/10 ring-1 ring-amber-300/25"
                      : "border-white/10 bg-white/3 hover:border-white/20"
                  }`}
                >
                  <p className={`text-sm font-medium ${form.triggerType === opt.value ? "text-amber-200" : "text-slate-300"}`}>
                    <span className="mr-1.5">{opt.icon}</span>{opt.label}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{opt.description}</p>
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
            <div className="my-5 border-t border-white/5" />

            {/* ── THEN ── */}
            <div className="mb-2 flex items-center gap-2">
              <span className="rounded bg-slate-700/50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-widest text-slate-400">Then</span>
              <span className="text-xs text-slate-600">Tell Beetlebot what to do — like giving instructions to a smart assistant.</span>
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
          <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Approval mode
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              {approvalOptions.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => set("approvalRule", opt.value)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    form.approvalRule === opt.value ? opt.active : opt.cls
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
            <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
              Budget cap
            </h2>
            <label className={labelCls}>
              <span className={labelTextCls}>Max spend per action (USD)</span>
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
              disabled={submitting}
              className="rounded-lg border border-amber-300/25 bg-amber-300/15 px-5 py-2.5 text-sm font-medium text-amber-100 transition-colors hover:bg-amber-300/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? "Creating…" : "Create autopilot"}
            </button>
            <Link
              href="/autopilots"
              className="text-sm text-slate-500 hover:text-slate-300"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
