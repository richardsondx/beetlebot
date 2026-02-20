import { fromError, ok } from "@/lib/api/http";
import { installPackSchema } from "@/lib/api/schemas";
import { installPack, uninstallPack } from "@/lib/repositories/packs";

export async function POST(request: Request) {
  try {
    const body = installPackSchema.parse(await request.json());
    const pack = await installPack(body.slug);
    return ok({ slug: pack.slug, installed: pack.installed });
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const body = installPackSchema.parse(await request.json());
    const pack = await uninstallPack(body.slug);
    return ok({ slug: pack.slug, installed: pack.installed });
  } catch (error) {
    return fromError(error);
  }
}

