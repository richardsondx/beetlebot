import { db } from "@/lib/db";
import { ensureSeedData } from "@/lib/repositories/seed";
import { reconcileSchedulerJobs } from "@/lib/runtime/scheduler";

export async function listAutopilots() {
  await ensureSeedData();
  return db.autopilot.findMany({ orderBy: { createdAt: "desc" } });
}

export async function createAutopilot(data: {
  name: string;
  goal: string;
  triggerType: string;
  trigger: string;
  action: string;
  approvalRule: string;
  mode: string;
  budgetCap: number;
  nextCheckIn?: string;
  status?: string;
}) {
  const autopilot = await db.autopilot.create({
    data: {
      name: data.name,
      goal: data.goal,
      triggerType: data.triggerType,
      trigger: data.trigger,
      action: data.action,
      approvalRule: data.approvalRule,
      mode: data.mode,
      budgetCap: data.budgetCap,
      nextCheckIn: data.nextCheckIn ? new Date(data.nextCheckIn) : new Date(Date.now() + 86400000),
      status: data.status ?? "on",
    },
  });

  await db.auditEvent.create({
    data: {
      actor: "api:autopilots",
      action: "autopilot_created",
      details: autopilot.name,
    },
  });

  await reconcileSchedulerJobs();
  return autopilot;
}

export async function getAutopilot(id: string) {
  return db.autopilot.findUnique({ where: { id } });
}

export async function updateAutopilot(id: string, data: Record<string, unknown>) {
  const mapped = {
    ...data,
    nextCheckIn:
      typeof data.nextCheckIn === "string" ? new Date(data.nextCheckIn as string) : undefined,
  };
  const autopilot = await db.autopilot.update({
    where: { id },
    data: mapped,
  });
  await db.auditEvent.create({
    data: {
      actor: "api:autopilots",
      action: "autopilot_updated",
      details: autopilot.name,
    },
  });
  await reconcileSchedulerJobs();
  return autopilot;
}

export async function deleteAutopilot(id: string) {
  const autopilot = await db.autopilot.delete({ where: { id } });
  await db.auditEvent.create({
    data: {
      actor: "api:autopilots",
      action: "autopilot_deleted",
      details: autopilot.name,
    },
  });
  return autopilot;
}

