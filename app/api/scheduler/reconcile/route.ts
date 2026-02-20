import { fromError, ok } from "@/lib/api/http";
import { db } from "@/lib/db";
import { reconcileSchedulerJobs } from "@/lib/runtime/scheduler";

export async function POST() {
  try {
    const data = await reconcileSchedulerJobs();
    await db.auditEvent.create({
      data: {
        actor: "api:scheduler",
        action: "scheduler_reconciled",
        details: "Rebuilt scheduler jobs from autopilot definitions.",
      },
    });
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}

