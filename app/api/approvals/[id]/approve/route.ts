import { fromError, ok } from "@/lib/api/http";
import { approve } from "@/lib/repositories/misc";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const data = await approve(id);
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}

