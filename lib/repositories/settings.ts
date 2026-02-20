import { db } from "@/lib/db";
import type { SafetySettings } from "@/lib/types";

const SINGLETON_ID = "singleton";

export async function getSafetySettings(): Promise<SafetySettings> {
  const row = await db.settings.upsert({
    where: { id: SINGLETON_ID },
    create: { id: SINGLETON_ID },
    update: {},
  });
  return {
    defaultApproval: row.defaultApproval as SafetySettings["defaultApproval"],
    spendCap: row.spendCap,
    quietStart: row.quietStart,
    quietEnd: row.quietEnd,
  };
}

export async function updateSafetySettings(
  patch: Partial<SafetySettings>,
): Promise<SafetySettings> {
  const row = await db.settings.upsert({
    where: { id: SINGLETON_ID },
    create: {
      id: SINGLETON_ID,
      ...(patch.defaultApproval !== undefined && { defaultApproval: patch.defaultApproval }),
      ...(patch.spendCap !== undefined && { spendCap: patch.spendCap }),
      ...(patch.quietStart !== undefined && { quietStart: patch.quietStart }),
      ...(patch.quietEnd !== undefined && { quietEnd: patch.quietEnd }),
    },
    update: {
      ...(patch.defaultApproval !== undefined && { defaultApproval: patch.defaultApproval }),
      ...(patch.spendCap !== undefined && { spendCap: patch.spendCap }),
      ...(patch.quietStart !== undefined && { quietStart: patch.quietStart }),
      ...(patch.quietEnd !== undefined && { quietEnd: patch.quietEnd }),
    },
  });
  await db.auditEvent.create({
    data: {
      actor: "api:settings",
      action: "safety_settings_updated",
      details: JSON.stringify(patch),
    },
  });
  return {
    defaultApproval: row.defaultApproval as SafetySettings["defaultApproval"],
    spendCap: row.spendCap,
    quietStart: row.quietStart,
    quietEnd: row.quietEnd,
  };
}
