import { fromError, ok } from "@/lib/api/http";
import { runAutopilot } from "@/lib/runtime/runner";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const run = await runAutopilot({ autopilotId: id, reason: "manual" });
    if (!run) return ok({ message: "Not found" }, 404);
    return ok(run);
  } catch (error) {
    return fromError(error);
  }
}

