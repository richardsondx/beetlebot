import { db } from "@/lib/db";
import { ensureSeedData } from "@/lib/repositories/seed";
import { getGoogleCalendarAvailability } from "@/lib/calendar/google-calendar";

export async function listApprovals() {
  await ensureSeedData();
  return db.approval.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
  });
}

export async function approve(approvalId: string) {
  const approval = await db.approval.update({
    where: { id: approvalId },
    data: { status: "approved" },
  });
  await db.auditEvent.create({
    data: { actor: "api:approvals", action: "approval_approved", details: approval.title },
  });
  return approval;
}

export async function reject(approvalId: string, reason?: string) {
  const approval = await db.approval.update({
    where: { id: approvalId },
    data: { status: "rejected", reason },
  });
  await db.auditEvent.create({
    data: { actor: "api:approvals", action: "approval_rejected", details: approval.title },
  });
  return approval;
}

export async function listAudit(page = 1, pageSize = 50) {
  const skip = (page - 1) * pageSize;
  const [events, total] = await Promise.all([
    db.auditEvent.findMany({ orderBy: { at: "desc" }, skip, take: pageSize }),
    db.auditEvent.count(),
  ]);
  return { events, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
}

export async function listDebugTraces() {
  return db.debugTrace.findMany({ orderBy: { at: "desc" } });
}

export async function listCalendarAvailability() {
  await ensureSeedData();
  const softHolds = await db.softHold.findMany({ orderBy: { createdAt: "desc" } });
  try {
    const availability = await getGoogleCalendarAvailability();
    return {
      source: "google_calendar",
      freeSlots: availability.freeSlots.map((slot) => ({
        startAt: slot.start,
        endAt: slot.end,
      })),
      busySlots: availability.busy.map((slot) => ({
        startAt: slot.start,
        endAt: slot.end,
      })),
      softHolds,
    };
  } catch {
    return {
      source: "fallback",
      freeSlots: [
        {
          startAt: new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString(),
          endAt: new Date(Date.now() + 10 * 60 * 60 * 1000).toISOString(),
        },
        {
          startAt: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(),
          endAt: new Date(Date.now() + 34 * 60 * 60 * 1000).toISOString(),
        },
      ],
      busySlots: [],
      softHolds,
    };
  }
}

export async function createSoftHold(input: { title: string; startAt: string; endAt: string }) {
  const hold = await db.softHold.create({
    data: {
      title: input.title,
      startAt: new Date(input.startAt),
      endAt: new Date(input.endAt),
      status: "held",
    },
  });
  await db.auditEvent.create({
    data: { actor: "api:calendar", action: "soft_hold_created", details: hold.title },
  });
  return hold;
}

export async function releaseSoftHold(id: string) {
  const hold = await db.softHold.update({ where: { id }, data: { status: "released" } });
  await db.auditEvent.create({
    data: { actor: "api:calendar", action: "soft_hold_released", details: hold.title },
  });
  return hold;
}

export async function deleteSoftHold(id: string) {
  const hold = await db.softHold.delete({ where: { id } });
  await db.auditEvent.create({
    data: { actor: "api:calendar", action: "soft_hold_deleted", details: hold.title },
  });
  return hold;
}

export async function updateSoftHold(
  id: string,
  input: { title?: string; startAt?: string; endAt?: string; status?: "held" | "released" },
) {
  const hold = await db.softHold.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.startAt !== undefined ? { startAt: new Date(input.startAt) } : {}),
      ...(input.endAt !== undefined ? { endAt: new Date(input.endAt) } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    },
  });
  await db.auditEvent.create({
    data: { actor: "api:calendar", action: "soft_hold_updated", details: hold.title },
  });
  return hold;
}

