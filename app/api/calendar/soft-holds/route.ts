import { fromError, ok } from "@/lib/api/http";
import { createSoftHoldSchema } from "@/lib/api/schemas";
import { createSoftHold } from "@/lib/repositories/misc";

export async function POST(request: Request) {
  try {
    const body = createSoftHoldSchema.parse(await request.json());
    const hold = await createSoftHold(body);
    return ok(hold, 201);
  } catch (error) {
    return fromError(error);
  }
}

