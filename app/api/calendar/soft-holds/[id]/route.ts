import { fromError, ok } from "@/lib/api/http";
import { updateSoftHoldSchema } from "@/lib/api/schemas";
import { releaseSoftHold, updateSoftHold } from "@/lib/repositories/misc";

type Params = { params: Promise<{ id: string }> };

export async function DELETE(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const hold = await releaseSoftHold(id);
    return ok(hold);
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params;
    const body = updateSoftHoldSchema.parse(await request.json());

    if (body.startAt && body.endAt && new Date(body.startAt) >= new Date(body.endAt)) {
      throw new Error("startAt must be before endAt.");
    }

    const hold = await updateSoftHold(id, body);
    return ok(hold);
  } catch (error) {
    return fromError(error);
  }
}

