import { fromError, ok } from "@/lib/api/http";
import { previewRun } from "@/lib/runtime/runner";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const preview = await previewRun(id);
    if (!preview) return ok({ message: "Not found" }, 404);
    return ok({ autopilotId: id, preview });
  } catch (error) {
    return fromError(error);
  }
}

