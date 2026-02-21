import { fromError, ok } from "@/lib/api/http";
import { installFromForageSchema } from "@/lib/api/schemas";
import { upsertPackFromForage } from "@/lib/repositories/packs";
import type { PackDataSource } from "@/lib/types";

const FORAGE_REGISTRY_URL =
  process.env.FORAGE_REGISTRY_URL ?? "https://forage.beetlebot.dev";

type ForagePackPayload = {
  slug: string;
  name: string;
  city: string;
  modes: string[];
  style: string;
  budgetRange: string;
  needs: string[];
  description: string;
  instructions: string;
  tags: string[];
  dataSources: PackDataSource[];
};

export async function POST(request: Request) {
  try {
    const body = installFromForageSchema.parse(await request.json());

    const ref = body.packRef.replace(/^@/, "");
    const slashIdx = ref.indexOf("/");
    const author = ref.slice(0, slashIdx);
    const slug = ref.slice(slashIdx + 1);

    const res = await fetch(
      `${FORAGE_REGISTRY_URL}/api/packs/${encodeURIComponent(author)}/${slug}/download`,
    );

    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `Pack not found in Forage registry (${res.status})`);
    }

    const json = (await res.json()) as { data: ForagePackPayload };
    const pack = await upsertPackFromForage(json.data);

    return ok({ slug: pack.slug, name: pack.name, installed: pack.installed });
  } catch (error) {
    return fromError(error);
  }
}
