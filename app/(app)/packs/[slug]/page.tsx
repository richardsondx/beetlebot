import { notFound } from "next/navigation";
import Link from "next/link";
import { InstallPackButton } from "@/components/packs/install-pack-button";
import { getPackBySlug } from "@/lib/repositories/packs";
import { PackTile } from "@/components/ui/pack-tile";

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
        <Link href="/packs" className="inline-flex items-center gap-1 text-xs text-[#6B6862] hover:text-[#6B6862]">
          ← Packs
        </Link>

        <section className="rounded-2xl border border-[#E7E5E0] bg-white p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <PackTile slug={pack.slug} />
              <h1 className="text-2xl font-semibold leading-8 text-[#1C1B19]">{pack.name}</h1>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {pack.installed && (
                <span className="rounded-full border border-[#E7E5E0] bg-[#E6F4EA] px-2.5 py-0.5 text-xs text-[#2F7D4F]">
                  installed
                </span>
              )}
              <Link
                href={`/packs/${pack.slug}/edit`}
                className="rounded-lg border border-[#E7E5E0] bg-[#F2F1EE] px-3 py-1 text-xs text-[#6B6862] transition-colors hover:bg-[#F2F1EE]"
              >
                Edit
              </Link>
            </div>
          </div>

          <p className="mb-6 text-sm leading-relaxed text-[#6B6862]">{pack.description}</p>

          <div className="grid gap-3 sm:grid-cols-2">
            {pack.city && (
              <div className="rounded-lg border border-[#E7E5E0] bg-[#F2F1EE] p-3">
                <p className="mb-1 text-xs text-[#6B6862]">City / Region</p>
                <p className="text-sm text-[#1C1B19]">📍 {pack.city}</p>
              </div>
            )}
            {pack.budgetRange && (
              <div className="rounded-lg border border-[#E7E5E0] bg-[#F2F1EE] p-3">
                <p className="mb-1 text-xs text-[#6B6862]">Typical budget</p>
                <p className="text-sm text-[#1C1B19]">{pack.budgetRange}</p>
              </div>
            )}
            {pack.style && (
              <div className="rounded-lg border border-[#E7E5E0] bg-[#F2F1EE] p-3">
                <p className="mb-1 text-xs text-[#6B6862]">Style</p>
                <span className="rounded-md border border-[#E7E5E0] bg-[#FBF1E1] px-2 py-0.5 text-xs text-[#8A5710]">
                  {pack.style}
                </span>
              </div>
            )}
            {pack.modes && pack.modes.length > 0 && (
              <div className="rounded-lg border border-[#E7E5E0] bg-[#F2F1EE] p-3">
                <p className="mb-1.5 text-xs text-[#6B6862]">Modes</p>
                <div className="flex flex-wrap gap-1.5">
                  {pack.modes.map((m: string) => (
                    <span
                      key={m}
                      className="rounded-md border border-[#E7E5E0] bg-[#E5EFFB] px-1.5 py-0.5 text-xs text-[#2F5FA8]"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          {pack.instructions && (
            <div className="mt-4 rounded-lg border border-[#E7E5E0] bg-[#F2F1EE] p-3">
              <p className="mb-1.5 text-xs text-[#6B6862]">Strategy / Instructions</p>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-[#6B6862]">
                {pack.instructions}
              </p>
            </div>
          )}

          {pack.dataSources && pack.dataSources.length > 0 && (
            <div className="mt-4 rounded-lg border border-[#E7E5E0] bg-[#F2F1EE] p-3">
              <p className="mb-1.5 text-xs text-[#6B6862]">Data sources</p>
              <div className="space-y-1.5">
                {pack.dataSources.map((ds: { url: string; label: string; hint?: string }) => (
                  <div key={ds.url} className="flex items-center gap-2 text-sm">
                    <span className="text-[#6B6862]">🔗</span>
                    <a
                      href={ds.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[#2F5FA8] underline decoration-sky-300/30 hover:decoration-sky-300/60"
                    >
                      {ds.label}
                    </a>
                    {ds.hint && (
                      <span className="text-xs text-[#6B6862]">— {ds.hint}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {pack.tags && pack.tags.length > 0 && (
            <div className="mt-4 rounded-lg border border-[#E7E5E0] bg-[#F2F1EE] p-3">
              <p className="mb-1.5 text-xs text-[#6B6862]">Tags</p>
              <div className="flex flex-wrap gap-1.5">
                {pack.tags.map((t: string) => (
                  <span
                    key={t}
                    className="rounded-md border border-[#E7E5E0] bg-[#EFEAFB] px-1.5 py-0.5 text-xs text-[#6146A8]"
                  >
                    {t}
                  </span>
                ))}
              </div>
            </div>
          )}

          {pack.needs && pack.needs.length > 0 && (
            <div className="mt-4 rounded-lg border border-[#E7E5E0] bg-[#F2F1EE] p-3">
              <p className="mb-1.5 text-xs text-[#6B6862]">Requirements</p>
              <div className="flex flex-wrap gap-1.5">
                {pack.needs.map((n: string) => (
                  <span
                    key={n}
                    className="rounded-md border border-[#E7E5E0] bg-[#F2F1EE] px-2 py-0.5 text-xs text-[#6B6862]"
                  >
                    {n}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-6 border-t border-[#E7E5E0] pt-5">
            <InstallPackButton slug={pack.slug} installed={pack.installed} needs={pack.needs} />
          </div>
        </section>
      </div>
    </div>
  );
}
