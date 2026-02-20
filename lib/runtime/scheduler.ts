import { db } from "@/lib/db";

export type TriggerCompilation = {
  triggerType: "time" | "context" | "event";
  cron?: string;
  watcher?: string;
};

export function compileTrigger(triggerType: string, trigger: string): TriggerCompilation {
  if (triggerType === "time") {
    // Stub compiler: converts human trigger to default cron template.
    return { triggerType: "time", cron: "0 12 * * FRI" };
  }
  if (triggerType === "context") {
    return { triggerType: "context", watcher: `context:${trigger}` };
  }
  return { triggerType: "event", watcher: `event:${trigger}` };
}

export async function reconcileSchedulerJobs() {
  const autopilots = await db.autopilot.findMany();

  for (const autopilot of autopilots) {
    const compiled = compileTrigger(autopilot.triggerType, autopilot.trigger);
    await db.schedulerJob.upsert({
      where: { id: `job-${autopilot.id}` },
      update: {
        triggerType: compiled.triggerType,
        cron: compiled.cron,
        watcher: compiled.watcher,
        status: autopilot.status === "on" ? "active" : "paused",
      },
      create: {
        id: `job-${autopilot.id}`,
        autopilotId: autopilot.id,
        triggerType: compiled.triggerType,
        cron: compiled.cron,
        watcher: compiled.watcher,
        status: autopilot.status === "on" ? "active" : "paused",
      },
    });
  }

  return db.schedulerJob.findMany({
    orderBy: { createdAt: "desc" },
  });
}

