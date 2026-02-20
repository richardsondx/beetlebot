import { fromError, ok } from "@/lib/api/http";
import { db } from "@/lib/db";

export async function GET() {
  try {
    const data = await db.autopilotRun.findMany({ orderBy: { createdAt: "desc" } });
    return ok(
      data.map((run) => ({
        ...run,
        actions: JSON.parse(run.actions),
      })),
    );
  } catch (error) {
    return fromError(error);
  }
}

