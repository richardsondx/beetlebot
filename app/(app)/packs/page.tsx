import Link from "next/link";
import { InstallPackButton } from "@/components/packs/install-pack-button";
import { listPacks } from "@/lib/repositories/packs";

type PackRow = {
  slug: string;
  name: string;
  city: string;
  style: string;
  budgetRange: string;
  description: string;
  installed: boolean;
  modes: string[];
  tags: string[];
  needs: string[];
};

export default async function PacksPage() {
  const packs = await (listPacks() as Promise<PackRow[]>);
  const installedCount = packs.filter((p: PackRow) => p.installed).length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        <header className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="mb-1 flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-300/10 text-lg">
                  📦
                </span>
                <h1 className="text-2xl font-semibold">Packs</h1>
                {installedCount > 0 && (
                  <span className="rounded-full border border-sky-300/25 bg-sky-300/10 px-2.5 py-0.5 text-xs text-sky-200">
                    {installedCount} installed
                  </span>
                )}
              </div>
              <p className="text-sm text-slate-400">
                Community capability packs for city and niche planning.
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/packs/new"
                className="shrink-0 rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm text-amber-100 transition-colors hover:bg-amber-300/20"
              >
                + Create pack
              </Link>
            </div>
          </div>
        </header>

        {packs.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#0d1422] px-6 py-16 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-sky-300/10 text-2xl">
              📦
            </div>
            <p className="text-sm font-medium text-slate-300">No packs available</p>
            <p className="mt-1 text-xs text-slate-500">
              Packs extend beetlebot with local knowledge and niche plans.
            </p>
            <Link
              href="/packs/new"
              className="mt-4 inline-block rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm text-amber-200 hover:bg-amber-300/20"
            >
              Create a pack
            </Link>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {packs.map((pack: PackRow) => (
              <article
                key={pack.slug}
                className="group flex flex-col rounded-2xl border border-white/10 bg-[#0d1422] transition-all hover:border-white/20"
              >
                <Link href={`/packs/${pack.slug}`} className="block flex-1 p-5">
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <h2 className="text-base font-semibold group-hover:text-white">
                      {pack.name}
                    </h2>
                    {pack.installed && (
                      <span className="shrink-0 rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2 py-0.5 text-xs text-emerald-200">
                        installed
                      </span>
                    )}
                  </div>
                  <p className="mb-4 line-clamp-2 text-sm text-slate-400">
                    {pack.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {pack.city && (
                      <span className="rounded-md border border-white/8 bg-white/4 px-2 py-1 text-slate-300">
                        📍 {pack.city}
                      </span>
                    )}
                    {pack.budgetRange && (
                      <span className="rounded-md border border-white/8 bg-white/4 px-2 py-1 text-slate-300">
                        {pack.budgetRange}
                      </span>
                    )}
                    {pack.style && (
                      <span className="rounded-md border border-amber-300/15 bg-amber-300/8 px-2 py-1 text-amber-200">
                        {pack.style}
                      </span>
                    )}
                  </div>
                  {pack.modes && pack.modes.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {pack.modes.map((m: string) => (
                        <span
                          key={m}
                          className="rounded-md border border-sky-300/15 bg-sky-300/8 px-1.5 py-0.5 text-xs text-sky-300"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                  {pack.tags && pack.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {pack.tags.map((t: string) => (
                        <span
                          key={t}
                          className="rounded-md border border-violet-300/15 bg-violet-300/8 px-1.5 py-0.5 text-xs text-violet-300"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                </Link>
                <div className="border-t border-white/8 px-5 py-3">
                  <InstallPackButton slug={pack.slug} installed={pack.installed} needs={pack.needs} />
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
