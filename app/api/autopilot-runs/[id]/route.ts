import { fromError, ok } from "@/lib/api/http";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function GET(_: Request, { params }: Params) {
  try {
    const { id } = await params;
    const run = await db.autopilotRun.findUnique({ where: { id } });
    if (!run) return ok({ message: "Not found" }, 404);
    return ok({
      ...run,
      actions: JSON.parse(run.actions),
    });
  } catch (error) {
    return fromError(error);
  }
}

