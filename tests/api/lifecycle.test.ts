import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { db } from "../../lib/db";
import { POST as createAutopilot } from "../../app/api/autopilots/route";
import { POST as runAutopilot } from "../../app/api/autopilots/[id]/run/route";
import { GET as listRuns } from "../../app/api/autopilot-runs/route";
import { POST as upsertMemory } from "../../app/api/memory/upsert/route";
import { POST as forgetMemory } from "../../app/api/memory/forget/route";

const createdAutopilotIds: string[] = [];

beforeAll(async () => {
  await db.autopilotRun.deleteMany();
  await db.autopilot.deleteMany({ where: { name: "Test Autopilot" } });
});

afterEach(async () => {
  if (!createdAutopilotIds.length) return;
  await db.autopilotRun.deleteMany({
    where: { autopilotId: { in: createdAutopilotIds } },
  });
  await db.autopilot.deleteMany({
    where: { id: { in: createdAutopilotIds } },
  });
  createdAutopilotIds.length = 0;
});

describe("API lifecycle", () => {
  it("creates autopilot and runs it", async () => {
    const createResponse = await createAutopilot(
      new Request("http://localhost/api/autopilots", {
        method: "POST",
        body: JSON.stringify({
          name: "Test Autopilot",
          goal: "Test goal for lifecycle",
          triggerType: "time",
          trigger: "Friday 12:00",
          action: "Create a draft and ask for approval",
          approvalRule: "ask_first",
          mode: "social",
          budgetCap: 99,
        }),
      }),
    );
    const createdPayload = (await createResponse.json()) as { data: { id: string } };
    expect(createResponse.status).toBe(201);
    expect(createdPayload.data.id).toBeTruthy();
    createdAutopilotIds.push(createdPayload.data.id);

    const runResponse = await runAutopilot(new Request("http://localhost/api/autopilots/test/run", { method: "POST" }), {
      params: Promise.resolve({ id: createdPayload.data.id }),
    });
    expect(runResponse.status).toBe(200);

    const duplicateRunResponse = await runAutopilot(
      new Request("http://localhost/api/autopilots/test/run", { method: "POST" }),
      {
        params: Promise.resolve({ id: createdPayload.data.id }),
      },
    );
    expect(duplicateRunResponse.status).toBe(200);

    const runsResponse = await listRuns();
    const runsPayload = (await runsResponse.json()) as { data: Array<{ autopilotId: string }> };
    expect(runsPayload.data.filter((run) => run.autopilotId === createdPayload.data.id)).toHaveLength(1);
  });

  it("upserts and forgets memory", async () => {
    const upsertResponse = await upsertMemory(
      new Request("http://localhost/api/memory/upsert", {
        method: "POST",
        body: JSON.stringify({
          bucket: "taste_memory",
          key: "test_preference",
          value: "sushi",
          source: "user_input",
          confidence: 1,
        }),
      }),
    );
    const upsertPayload = (await upsertResponse.json()) as { data: { id: string } };
    expect(upsertResponse.status).toBe(201);

    const forgetResponse = await forgetMemory(
      new Request("http://localhost/api/memory/forget", {
        method: "POST",
        body: JSON.stringify({ id: upsertPayload.data.id }),
      }),
    );
    expect(forgetResponse.status).toBe(200);
  });
});

