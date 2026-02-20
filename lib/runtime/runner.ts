import { db } from "@/lib/db";
import { createGoogleCalendarEvent } from "@/lib/calendar/google-calendar";
import { Prisma } from "@prisma/client";

type RunInput = {
  autopilotId: string;
  reason: "manual" | "scheduled";
};

const RUN_IDEMPOTENCY_WINDOW_MS = 5 * 60 * 1000;

function buildRunIdempotencyKey(autopilotId: string, runAt: Date) {
  const bucket = Math.floor(runAt.getTime() / RUN_IDEMPOTENCY_WINDOW_MS);
  return `${autopilotId}:${bucket}`;
}

export function canExecute(approvalRule: string) {
  return approvalRule !== "ask_first";
}

export async function previewRun(autopilotId: string) {
  const autopilot = await db.autopilot.findUnique({ where: { id: autopilotId } });
  if (!autopilot) return null;

  return {
    title: `${autopilot.name} preview`,
    mode: autopilot.mode,
    weatherAssumption: "Rain probability medium, indoor fallback ready.",
    steps: ["suggest", "soft_hold", "approval", "book_if_approved"],
    confidence: 0.82,
    fallbackPlan: "Indoor alternatives ranked by travel time.",
  };
}

export async function runAutopilot({ autopilotId, reason }: RunInput) {
  const autopilot = await db.autopilot.findUnique({ where: { id: autopilotId } });
  if (!autopilot) return null;

  const scheduledAt = new Date();
  const startedAt = new Date();
  const idempotencyKey = buildRunIdempotencyKey(autopilot.id, startedAt);
  const approvalState = canExecute(autopilot.approvalRule) ? "approved" : "pending";

  const existing = await db.autopilotRun.findUnique({ where: { idempotencyKey } });
  if (existing) return existing;

  let run;
  try {
    run = await db.autopilotRun.create({
      data: {
        autopilotId,
        scheduledAt,
        startedAt,
        status: "pending",
        decisionTrace: `Run reason=${reason}; mode=${autopilot.mode}; trigger=${autopilot.trigger}; state=started.`,
        actions: JSON.stringify(["run_started"]),
        approvalState,
        idempotencyKey,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const existing = await db.autopilotRun.findUnique({ where: { idempotencyKey } });
      if (existing) return existing;
    }
    throw error;
  }

  const status = approvalState === "approved" ? "success" : "pending";
  const actionsTaken = ["generated_suggestions"];

  const holdStart = autopilot.nextCheckIn > startedAt ? autopilot.nextCheckIn : startedAt;
  const holdEnd = new Date(holdStart.getTime() + 2 * 60 * 60 * 1000);
  const holdTitle = `Soft hold: ${autopilot.name}`;
  const existingActiveHold = await db.softHold.findFirst({
    where: {
      title: holdTitle,
      status: "held",
      endAt: { gt: startedAt },
    },
    orderBy: { createdAt: "desc" },
  });
  const softHold =
    existingActiveHold ??
    (await db.softHold.create({
      data: {
        title: holdTitle,
        startAt: holdStart,
        endAt: holdEnd,
        status: "held",
      },
    }));
  actionsTaken.push(existingActiveHold ? "reused_existing_soft_hold" : "created_soft_hold");

  // Check if we already pushed a Google Calendar event for this autopilot
  // covering the same time window to avoid duplicates on restart.
  const existingRunWithEvent = await db.autopilotRun.findFirst({
    where: {
      autopilotId,
      googleEventId: { not: null },
      holdStartAt: holdStart,
      holdEndAt: holdEnd,
    },
  });

  let syncedGoogleEventId: string | null = existingRunWithEvent?.googleEventId ?? null;
  let googleSyncError: string | null = null;
  if (syncedGoogleEventId) {
    actionsTaken.push("reused_existing_google_calendar_event");
  } else {
    try {
      const created = await createGoogleCalendarEvent({
        summary: `[beetlebot] ${autopilot.name}`,
        description: `Autopilot: ${autopilot.name}\nGoal: ${autopilot.goal}\nReason: ${reason}`,
        start: holdStart.toISOString(),
        end: holdEnd.toISOString(),
      });
      syncedGoogleEventId = created.event.id;
      actionsTaken.push("synced_google_calendar_event");
    } catch (error) {
      googleSyncError = error instanceof Error ? error.message : "unknown";
    }
  }

  actionsTaken.push(approvalState === "approved" ? "booked" : "requested_approval");
  const actions = JSON.stringify(actionsTaken);
  const decisionTrace = `Run reason=${reason}; mode=${autopilot.mode}; trigger=${autopilot.trigger}; softHold=${softHold.id}; googleEvent=${syncedGoogleEventId ?? "none"}${googleSyncError ? `; googleSyncError=${googleSyncError}` : ""}.`;

  run = await db.autopilotRun.update({
    where: { id: run.id },
    data: {
      status,
      decisionTrace,
      actions,
      googleEventId: syncedGoogleEventId,
      holdStartAt: holdStart,
      holdEndAt: holdEnd,
    },
  });

  await db.auditEvent.create({
    data: {
      actor: `autopilot:${autopilot.id}`,
      action: "autopilot_run_created",
      details: decisionTrace,
    },
  });

  await db.debugTrace.create({
    data: {
      scope: "autopilot_run",
      message: `${autopilot.name} run created with status=${status}, approval=${approvalState}.`,
    },
  });

  return run;
}

export async function retryRun(runId: string) {
  const existing = await db.autopilotRun.findUnique({ where: { id: runId } });
  if (!existing) return null;

  const nextRetry = existing.retryCount + 1;
  const updated = await db.autopilotRun.update({
    where: { id: runId },
    data: {
      status: "pending",
      startedAt: new Date(),
      retryCount: nextRetry,
      decisionTrace: `${existing.decisionTrace} Retry #${nextRetry}.`,
    },
  });

  await db.auditEvent.create({
    data: {
      actor: `run:${runId}`,
      action: "autopilot_run_retried",
      details: `Retry count is now ${nextRetry}.`,
    },
  });

  return updated;
}

