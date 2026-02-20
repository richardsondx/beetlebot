import { fail, fromError, ok } from "@/lib/api/http";
import { createPackSchema, updatePackSchema } from "@/lib/api/schemas";
import { createPack, deletePack, listPacks, updatePack } from "@/lib/repositories/packs";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const city = searchParams.get("city");
    const mode = searchParams.get("mode");
    const data = await listPacks(city, mode);
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const payload = createPackSchema.parse(await request.json());
    const created = await createPack(payload);
    return ok(created, 201);
  } catch (error) {
    return fromError(error);
  }
}

export async function PUT(request: Request) {
  try {
    const payload = updatePackSchema.parse(await request.json());
    const { slug, ...fields } = payload;
    if (!slug) return fail("slug is required", 400);
    const updated = await updatePack(slug, fields);
    return ok(updated);
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get("slug");
    if (!slug) return fail("slug query param is required", 400);
    await deletePack(slug);
    return ok({ deleted: slug });
  } catch (error) {
    return fromError(error);
  }
}

