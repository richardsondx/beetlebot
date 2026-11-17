import Link from "next/link";
import { listPacks } from "@/lib/repositories/packs";
import { PackDirectory } from "@/components/packs/pack-directory";
import type { PackRowData } from "@/components/packs/pack-row";

export default async function PacksPage() {
  const packs = (await listPacks()) as PackRowData[];
  const installedCount = packs.filter((p) => p.installed).length;

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto max-w-[760px] space-y-6 px-4 py-8 md:px-8">
        <header className="space-y-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-semibold leading-8 text-[#1C1B19]">Packs</h1>
              <p className="mt-1 text-[13px] leading-[18px] text-[#6B6862]">
                Add skills that shape how Beetlebot plans.
              </p>
            </div>
            <Link
              href="/packs/new"
              className="shrink-0 rounded-[10px] bg-[#C8811A] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#A96B12]"
            >
              + Create pack
            </Link>
          </div>
          {installedCount > 0 && (
            <p className="text-[13px] text-[#6B6862]">{installedCount} installed</p>
          )}
        </header>

        {packs.length === 0 ? (
          <div className="rounded-2xl border border-[#E7E5E0] bg-white px-6 py-16 text-center">
            <p className="text-sm font-medium text-[#1C1B19]">No packs available</p>
            <p className="mt-1 text-[13px] text-[#6B6862]">
              Packs extend Beetlebot with local knowledge and niche plans.
            </p>
            <Link
              href="/packs/new"
              className="mt-4 inline-block rounded-[10px] bg-[#C8811A] px-4 py-2 text-sm font-medium text-white hover:bg-[#A96B12]"
            >
              Create a pack
            </Link>
          </div>
        ) : (
          <PackDirectory packs={packs} />
        )}
      </div>
    </div>
  );
}
