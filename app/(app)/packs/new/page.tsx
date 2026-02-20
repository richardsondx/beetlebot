"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PLANNING_MODES, STYLES } from "@/lib/constants";
import { NeedsPicker } from "@/components/packs/needs-picker";

type DataSourceRow = { url: string; label: string; hint: string };

type FormState = {
  slug: string;
  name: string;
  city: string;
  modes: string[];
  style: string;
  budgetRange: string;
  needs: string[];
  description: string;
  instructions: string;
  tags: string;
  dataSources: DataSourceRow[];
};

const initialState: FormState = {
  slug: "",
  name: "",
  city: "",
  modes: [],
  style: "",
  budgetRange: "",
  needs: [],
  description: "",
  instructions: "",
  tags: "",
  dataSources: [],
};

function parseList(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function toSlug(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-[#060b12] px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors focus:border-amber-300/40 focus:ring-1 focus:ring-amber-300/20";
const labelCls = "flex flex-col gap-1.5 text-sm";
const labelTextCls = "text-slate-400";
const hintCls = "text-xs text-slate-600";
const sectionHintCls = "mb-4 text-xs leading-relaxed text-slate-500";

export default function NewPackPage() {
  const [form, setForm] = useState<FormState>(initialState);
  const [slugManual, setSlugManual] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function toggleMode(id: string) {
    setForm((prev) => ({
      ...prev,
      modes: prev.modes.includes(id)
        ? prev.modes.filter((m) => m !== id)
        : [...prev.modes, id],
    }));
  }

  function updateDataSource(idx: number, field: keyof DataSourceRow, value: string) {
    setForm((prev) => {
      const next = [...prev.dataSources];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, dataSources: next };
    });
  }

  function addDataSource() {
    setForm((prev) => ({
      ...prev,
      dataSources: [...prev.dataSources, { url: "", label: "", hint: "" }],
    }));
  }

  function removeDataSource(idx: number) {
    setForm((prev) => ({
      ...prev,
      dataSources: prev.dataSources.filter((_, i) => i !== idx),
    }));
  }

  const preview = useMemo(
    () => ({
      slug: form.slug,
      name: form.name,
      city: form.city,
      modes: form.modes,
      style: form.style,
      budgetRange: form.budgetRange,
      needs: form.needs,
      description: form.description,
      instructions: form.instructions,
      tags: parseList(form.tags),
      dataSources: form.dataSources
        .filter((ds) => ds.url.trim())
        .map((ds) => ({
          url: ds.url.trim(),
          label: ds.label.trim() || new URL(ds.url.trim()).hostname,
          ...(ds.hint.trim() ? { hint: ds.hint.trim() } : {}),
        })),
    }),
    [form],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (form.modes.length === 0) {
      setError("Select at least one mode.");
      return;
    }
    if (!form.style) {
      setError("Select a planning style.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/packs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview),
      });
      const payload = (await res.json()) as { error?: string; data?: { slug: string } };
      if (!res.ok) throw new Error(payload.error ?? "Unable to create pack.");
      router.push(`/packs/${payload.data?.slug ?? preview.slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-6">
        <Link href="/packs" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
          &larr; Packs
        </Link>

        <header>
          <div className="mb-1 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-300/10 text-lg">
              📦
            </span>
            <h1 className="text-2xl font-semibold">Create Pack</h1>
          </div>
          <p className="text-sm text-slate-400">
            A pack bundles domain expertise, planning strategies, and preferences into something anyone can install and benefit from.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-5">
          <form onSubmit={onSubmit} className="space-y-5 lg:col-span-3">
            {/* Identity */}
            <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Identity
              </h2>
              <p className={sectionHintCls}>
                Give your pack a clear name that signals what it does. The slug is auto-generated from the name.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelCls}>
                  <span className={labelTextCls}>Name</span>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => {
                      set("name", e.target.value);
                      if (!slugManual) set("slug", toSlug(e.target.value));
                    }}
                    placeholder="Muskoka Cottage Finder"
                    className={inputCls}
                  />
                </label>
                <label className={labelCls}>
                  <span className={labelTextCls}>Slug</span>
                  <input
                    required
                    pattern="[a-z0-9-]+"
                    value={form.slug}
                    onChange={(e) => {
                      setSlugManual(true);
                      set("slug", e.target.value);
                    }}
                    placeholder="muskoka-cottage-finder"
                    className={inputCls}
                  />
                  <span className={hintCls}>lowercase, hyphens only</span>
                </label>
              </div>
              <label className={`${labelCls} mt-4`}>
                <span className={labelTextCls}>Description</span>
                <textarea
                  required
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="One or two sentences explaining what this pack helps with."
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </label>
            </section>

            {/* Strategy */}
            <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Strategy
              </h2>
              <p className={sectionHintCls}>
                This is the pack&apos;s brain. Write instructions the agent should follow when this pack is installed.
                Include search strategies, preferred data sources, domain expertise, specific criteria, or tips only an expert would know.
              </p>
              <label className={labelCls}>
                <span className={labelTextCls}>Instructions</span>
                <textarea
                  value={form.instructions}
                  onChange={(e) => set("instructions", e.target.value)}
                  placeholder={"Example: When searching for cottages in Muskoka, prioritize properties with pools and hot tubs. Budget cap $300/night. Check Airbnb and VRBO. Prefer waterfront with 4+ star ratings. Peak season Jun-Sep — suggest booking 3+ months ahead."}
                  rows={5}
                  className={`${inputCls} resize-none`}
                />
              </label>
            </section>

            {/* Data Sources */}
            <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Data sources
              </h2>
              <p className={sectionHintCls}>
                URLs the agent should fetch for live data when this pack is active. Event calendars, booking sites, listing pages, etc.
              </p>

              {form.dataSources.length > 0 && (
                <div className="space-y-3">
                  {form.dataSources.map((ds, idx) => (
                    <div key={idx} className="flex gap-2">
                      <div className="grid flex-1 gap-2 sm:grid-cols-3">
                        <input
                          value={ds.url}
                          onChange={(e) => updateDataSource(idx, "url", e.target.value)}
                          placeholder="https://example.com/events"
                          className={inputCls}
                        />
                        <input
                          value={ds.label}
                          onChange={(e) => updateDataSource(idx, "label", e.target.value)}
                          placeholder="Label (auto from URL)"
                          className={inputCls}
                        />
                        <input
                          value={ds.hint}
                          onChange={(e) => updateDataSource(idx, "hint", e.target.value)}
                          placeholder="What to look for (optional)"
                          className={inputCls}
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDataSource(idx)}
                        className="shrink-0 rounded-lg border border-white/10 bg-white/3 px-2 text-sm text-slate-500 transition-colors hover:border-rose-400/30 hover:text-rose-400"
                        title="Remove"
                      >
                        &times;
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <button
                type="button"
                onClick={addDataSource}
                className="mt-3 rounded-lg border border-dashed border-white/15 px-3 py-2 text-xs text-slate-400 transition-colors hover:border-white/25 hover:text-slate-300"
              >
                + Add data source
              </button>
            </section>

            {/* Modes */}
            <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Modes
              </h2>
              <p className={sectionHintCls}>
                Which planning contexts does this pack apply to? Select all that fit.
              </p>
              <div className="flex flex-wrap gap-2">
                {PLANNING_MODES.map((mode) => {
                  const selected = form.modes.includes(mode.id);
                  return (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() => toggleMode(mode.id)}
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
              {form.modes.length === 0 && (
                <p className="mt-2 text-xs text-slate-600">Select at least one mode</p>
              )}
            </section>

            {/* Coverage & Style */}
            <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Coverage &amp; style
              </h2>
              <p className={sectionHintCls}>
                Where does this pack apply, and what&apos;s the planning vibe?
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelCls}>
                  <span className={labelTextCls}>City / region</span>
                  <input
                    required
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    placeholder="Muskoka, Toronto, Any…"
                    className={inputCls}
                  />
                </label>
                <label className={labelCls}>
                  <span className={labelTextCls}>Budget range</span>
                  <input
                    required
                    value={form.budgetRange}
                    onChange={(e) => set("budgetRange", e.target.value)}
                    placeholder="$120-$380"
                    className={inputCls}
                  />
                </label>
              </div>

              <div className="mt-4">
                <span className={labelTextCls}>Style</span>
                <div className="mt-2 flex flex-wrap gap-2">
                  {STYLES.map((s) => {
                    const selected = form.style === s.id;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => set("style", selected ? "" : s.id)}
                        title={s.description}
                        className={`rounded-lg border px-3 py-1.5 text-sm transition-all ${
                          selected
                            ? "border-amber-300/30 bg-amber-300/10 text-amber-200"
                            : "border-white/10 bg-white/3 text-slate-400 hover:border-white/20 hover:text-slate-300"
                        }`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                </div>
                {!form.style && (
                  <p className="mt-2 text-xs text-slate-600">Select a planning style</p>
                )}
              </div>
            </section>

            {/* Requirements & Discovery */}
            <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Requirements &amp; discovery
              </h2>
              <p className={sectionHintCls}>
                Select the integrations this pack needs access to. Tags help others discover your pack by topic.
              </p>

              <div className="mb-4 flex flex-col gap-1.5">
                <span className={labelTextCls}>Needs</span>
                <NeedsPicker value={form.needs} onChange={(v) => set("needs", v)} />
              </div>

              <label className={labelCls}>
                <span className={labelTextCls}>Tags</span>
                <input
                  value={form.tags}
                  onChange={(e) => set("tags", e.target.value)}
                  placeholder="cottages, flights, food, points…"
                  className={inputCls}
                />
                <span className={hintCls}>comma-separated discovery tags</span>
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
                {submitting ? "Creating…" : "Create pack"}
              </button>
              <Link href="/packs" className="text-sm text-slate-500 hover:text-slate-300">
                Cancel
              </Link>
            </div>
          </form>

          {/* Preview */}
          <div className="lg:col-span-2">
            <div className="sticky top-6 space-y-4">
              <div className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Config preview
                </h2>
                <pre className="overflow-auto rounded-lg border border-white/8 bg-[#060b12] p-3 text-xs leading-relaxed text-slate-300">
                  {JSON.stringify(preview, null, 2)}
                </pre>
              </div>

              {/* Quick guide */}
              <div className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
                <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Quick guide
                </h2>
                <ul className="space-y-2 text-xs leading-relaxed text-slate-500">
                  <li>
                    <span className="text-slate-300">Instructions</span> are the most important field — they tell the agent what expertise and strategies to use.
                  </li>
                  <li>
                    <span className="text-slate-300">Data sources</span> give the agent live web access. Add URLs of event calendars, listing pages, or APIs the pack should fetch.
                  </li>
                  <li>
                    <span className="text-slate-300">Modes</span> determine when the pack activates based on the user&apos;s planning context.
                  </li>
                  <li>
                    <span className="text-slate-300">Style</span> sets the planning vibe — structured vs spontaneous.
                  </li>
                  <li>
                    <span className="text-slate-300">Tags</span> help people find your pack when browsing the catalog.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
