import { fromError, ok } from "@/lib/api/http";
import { db } from "@/lib/db";
import { reconcileSchedulerJobs } from "@/lib/runtime/scheduler";

export async function GET() {
  try {
    await reconcileSchedulerJobs();
    const data = await db.schedulerJob.findMany({ orderBy: { createdAt: "desc" } });
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}

