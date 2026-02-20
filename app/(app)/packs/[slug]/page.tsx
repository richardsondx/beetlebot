import { notFound } from "next/navigation";
import Link from "next/link";
import { InstallPackButton } from "@/components/packs/install-pack-button";
import { getPackBySlug } from "@/lib/repositories/packs";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function PackDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const pack = await getPackBySlug(slug);
  if (!pack) notFound();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 px-6 py-6">
        <Link href="/packs" className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-300">
          ← Packs
        </Link>

        <section className="rounded-2xl border border-white/10 bg-[#0d1422] p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <h1 className="text-xl font-semibold">{pack.name}</h1>
            <div className="flex shrink-0 items-center gap-2">
              {pack.installed && (
                <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-0.5 text-xs text-emerald-200">
                  installed
                </span>
              )}
              <Link
                href={`/packs/${pack.slug}/edit`}
                className="rounded-lg border border-white/10 bg-white/5 px-3 py-1 text-xs text-slate-300 transition-colors hover:bg-white/10"
              >
                Edit
              </Link>
            </div>
          </div>

          <p className="mb-6 text-sm leading-relaxed text-slate-400">{pack.description}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            {pack.city && (
              <div className="rounded-lg border border-white/8 bg-white/3 p-3">
                <p className="mb-1 text-xs text-slate-500">City / Region</p>
                <p className="text-sm text-slate-200">📍 {pack.city}</p>
              </div>
            )}
            {pack.budgetRange && (
              <div className="rounded-lg border border-white/8 bg-white/3 p-3">
                <p className="mb-1 text-xs text-slate-500">Typical budget</p>
                <p className="text-sm text-slate-200">{pack.budgetRange}</p>
              </div>
            )}
            {pack.style && (
              <div className="rounded-lg border border-white/8 bg-white/3 p-3">
                <p className="mb-1 text-xs text-slate-500">Style</p>
                <span className="rounded-md border border-amber-300/15 bg-amber-300/8 px-2 py-0.5 text-xs text-amber-200">
                  {pack.style}
                </span>
              </div>
            )}
            {pack.modes && pack.modes.length > 0 && (
              <div className="rounded-lg border border-white/8 bg-white/3 p-3">
                <p className="mb-1.5 text-xs text-slate-500">Modes</p>
                <div className="flex flex-wrap gap-1.5">
                  {pack.modes.map((m: string) => (
                    <span
                      key={m}
                      className="rounded-md border border-sky-300/15 bg-sky-300/8 px-1.5 py-0.5 text-xs text-sky-300"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {pack.instructions && (
            <div className="mt-4 rounded-lg border border-white/8 bg-white/3 p-3">
              <p className="mb-1.5 text-xs text-slate-500">Strategy / Instructions</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-300">
                {pack.instructions}
              </p>
            </div>
          )}

          {pack.dataSources && pack.dataSources.length > 0 && (
            <div className="mt-4 rounded-lg border border-white/8 bg-white/3 p-3">
              <p className="mb-1.5 text-xs text-slate-500">Data sources</p>
              <div className="space-y-1.5">
                {pack.dataSources.map((ds: { url: string; label: string; hint?: string }) => (
                  <div key={ds.url} className="flex items-center gap-2 text-sm">
                    <span className="text-slate-500">🔗</span>
                    <a
                      href={ds.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sky-300 underline decoration-sky-300/30 hover:decoration-sky-300/60"
                    >
                      {ds.label}
                    </a>
                    {ds.hint && (
                      <span className="text-xs text-slate-500">— {ds.hint}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pack.tags && pack.tags.length > 0 && (
            <div className="mt-4 rounded-lg border border-white/8 bg-white/3 p-3">
              <p className="mb-1.5 text-xs text-slate-500">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {pack.tags.map((t: string) => (
                  <span
                    key={t}
                    className="rounded-md border border-violet-300/15 bg-violet-300/8 px-1.5 py-0.5 text-xs text-violet-300"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {pack.needs && pack.needs.length > 0 && (
            <div className="mt-4 rounded-lg border border-white/8 bg-white/3 p-3">
              <p className="mb-1.5 text-xs text-slate-500">Requirements</p>
              <div className="flex flex-wrap gap-1.5">
                {pack.needs.map((n: string) => (
                  <span
                    key={n}
                    className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-xs text-slate-300"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-white/8 pt-5">
            <InstallPackButton slug={pack.slug} installed={pack.installed} needs={pack.needs} />
          </div>
        </section>
      </div>
    </div>
  );
}
