import { fromError, ok } from "@/lib/api/http";
import { retryRun } from "@/lib/runtime/runner";

type Params = { params: Promise<{ id: string }> };

export async function POST(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const run = await retryRun(id);
    if (!run) return ok({ message: "Not found" }, 404);
    return ok({
      ...run,
      actions: JSON.parse(run.actions),
    });
  } catch (error) {
    return fromError(error);
  }
}

