"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MODES, STYLES } from "@/lib/constants";
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

function parseList(value: string) {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

const inputCls =
  "w-full rounded-lg border border-white/10 bg-[#060b12] px-3 py-2.5 text-sm text-slate-100 placeholder-slate-600 outline-none transition-colors focus:border-amber-300/40 focus:ring-1 focus:ring-amber-300/20";
const labelCls = "flex flex-col gap-1.5 text-sm";
const labelTextCls = "text-slate-400";
const hintCls = "text-xs text-slate-600";
const sectionHintCls = "mb-4 text-xs leading-relaxed text-slate-500";

export default function EditPackPage() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const [form, setForm] = useState<FormState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/packs?city=&mode=`);
        const payload = (await res.json()) as { data?: Array<Record<string, unknown>> };
        const packs = payload.data ?? payload;
        const pack = (packs as Array<Record<string, unknown>>).find(
          (p) => p.slug === params.slug,
        );
        if (!pack) {
          setError("Pack not found.");
          return;
        }
        const rawDs = (pack.dataSources as Array<{ url: string; label: string; hint?: string }>) ?? [];
        setForm({
          slug: pack.slug as string,
          name: pack.name as string,
          city: pack.city as string,
          modes: (pack.modes as string[]) ?? [],
          style: (pack.style as string) ?? "",
          budgetRange: pack.budgetRange as string,
          needs: (pack.needs as string[]) ?? [],
          description: pack.description as string,
          instructions: (pack.instructions as string) ?? "",
          tags: ((pack.tags as string[]) ?? []).join(", "),
          dataSources: rawDs.map((ds) => ({
            url: ds.url,
            label: ds.label,
            hint: ds.hint ?? "",
          })),
        });
      } catch {
        setError("Failed to load pack.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [params.slug]);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function toggleMode(id: string) {
    setForm((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        modes: prev.modes.includes(id)
          ? prev.modes.filter((m) => m !== id)
          : [...prev.modes, id],
      };
    });
  }

  function updateDataSource(idx: number, field: keyof DataSourceRow, value: string) {
    setForm((prev) => {
      if (!prev) return prev;
      const next = [...prev.dataSources];
      next[idx] = { ...next[idx], [field]: value };
      return { ...prev, dataSources: next };
    });
  }

  function addDataSource() {
    setForm((prev) =>
      prev ? { ...prev, dataSources: [...prev.dataSources, { url: "", label: "", hint: "" }] } : prev,
    );
  }

  function removeDataSource(idx: number) {
    setForm((prev) =>
      prev ? { ...prev, dataSources: prev.dataSources.filter((_, i) => i !== idx) } : prev,
    );
  }

  const preview = useMemo(
    () =>
      form
        ? {
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
              .map((ds) => {
                let label = ds.label.trim();
                if (!label) {
                  try { label = new URL(ds.url.trim()).hostname; } catch { label = ds.url.trim(); }
                }
                return {
                  url: ds.url.trim(),
                  label,
                  ...(ds.hint.trim() ? { hint: ds.hint.trim() } : {}),
                };
              }),
          }
        : null,
    [form],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!preview || !form) return;
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
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preview),
      });
      const payload = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(payload.error ?? "Unable to update pack.");
      router.push(`/packs/${params.slug}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected error.");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-sm text-slate-500">Loading pack…</p>
      </div>
    );
  }

  if (!form) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3">
        <p className="text-sm text-rose-300">{error || "Pack not found."}</p>
        <Link href="/packs" className="text-xs text-slate-500 hover:text-slate-300">
          &larr; Back to Packs
        </Link>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-6">
        <Link
          href={`/packs/${params.slug}`}
          className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300"
        >
          &larr; {form.name}
        </Link>

        <header>
          <div className="mb-1 flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-300/10 text-lg">
              ✏️
            </span>
            <h1 className="text-2xl font-semibold">Edit Pack</h1>
          </div>
          <p className="text-sm text-slate-400">
            Update this pack&apos;s configuration and strategy.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-5">
          <form onSubmit={onSubmit} className="space-y-5 lg:col-span-3">
            {/* Identity */}
            <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-5">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Identity
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className={labelCls}>
                  <span className={labelTextCls}>Name</span>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Cottage Weekend Pack"
                    className={inputCls}
                  />
                </label>
                <label className={labelCls}>
                  <span className={labelTextCls}>Slug</span>
                  <input
                    disabled
                    value={form.slug}
                    className={`${inputCls} cursor-not-allowed opacity-50`}
                  />
                  <span className={hintCls}>cannot be changed</span>
                </label>
              </div>
              <label className={`${labelCls} mt-4`}>
                <span className={labelTextCls}>Description</span>
                <textarea
                  required
                  value={form.description}
                  onChange={(e) => set("description", e.target.value)}
                  placeholder="What does this pack plan for?"
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
                Write instructions the agent should follow when this pack is installed.
                Include search strategies, preferred data sources, domain expertise, or tips only an expert would know.
              </p>
              <label className={labelCls}>
                <span className={labelTextCls}>Instructions</span>
                <textarea
                  value={form.instructions}
                  onChange={(e) => set("instructions", e.target.value)}
                  placeholder="Tell the agent what to do when this pack is active…"
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
                Which planning contexts does this pack apply to?
              </p>
              <div className="flex flex-wrap gap-2">
                {MODES.map((mode) => {
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
                {submitting ? "Saving…" : "Save changes"}
              </button>
              <Link
                href={`/packs/${params.slug}`}
                className="text-sm text-slate-500 hover:text-slate-300"
              >
                Cancel
              </Link>
            </div>
          </form>

          {/* Preview */}
          <div className="lg:col-span-2">
            <div className="sticky top-6 rounded-2xl border border-white/10 bg-[#0d1422] p-5">
              <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Config preview
              </h2>
              <pre className="overflow-auto rounded-lg border border-white/8 bg-[#060b12] p-3 text-xs leading-relaxed text-slate-300">
                {JSON.stringify(preview, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
