import { beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../lib/db";
import { POST as chatPost } from "../../app/api/chat/route";
import * as integrationsRepo from "../../lib/repositories/integrations";
import * as toolRegistry from "../../lib/tools/registry";
import type { ChatToolDefinition } from "../../lib/tools/types";

describe("chat orchestration", () => {
  beforeEach(async () => {
    await db.debugTrace.deleteMany({
      where: { scope: "chat" },
    });
    await db.pack.deleteMany({
      where: {
        description: {
          contains: "Generated from chat preferences",
        },
      },
    });
  });

  it("asks a clarifying question for underspecified requests", async () => {
    const response = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "Need ideas",
          mode: "explore",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string } };
    expect(payload.data?.reply?.toLowerCase()).toContain("quick check");
  });

  it("creates a pack from explicit chat command", async () => {
    const response = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "create a pack from this",
          mode: "explore",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string } };
    expect(payload.data?.reply).toContain("/packs/");

    const created = await db.pack.findFirst({
      where: {
        description: {
          contains: "Generated from chat preferences",
        },
      },
      orderBy: { createdAt: "desc" },
    });
    expect(created).toBeTruthy();
    expect(created?.slug).toBeTruthy();
  });

  it("finds next travel plan across calendars within 90-day window", async () => {
    const listMulti = [
      { count: 0, events: [] },
      {
        count: 1,
        events: [
          {
            id: "evt_1",
            summary: "2. Spring Reset",
            start: "2026-04-03T14:00:00.000Z",
            end: "2026-04-12T18:00:00.000Z",
            calendarId: "travel_plans",
            calendarName: "Travel Plans",
            primary: false,
          },
        ],
      },
    ];

    const execute = async (args: Record<string, unknown>) => {
      if (args.operation === "list_multi") {
        return (listMulti.shift() ?? { count: 0, events: [] }) as Record<string, unknown>;
      }
      return { error: "unsupported operation in test" };
    };

    const mockedTool: ChatToolDefinition = {
      name: "google_calendar_events",
      description: "mock",
      parameters: {},
      execute,
    };

    const connSpy = vi
      .spyOn(integrationsRepo, "getIntegrationConnection")
      .mockResolvedValue({
        id: "integration_google_calendar",
        provider: "google_calendar",
        kind: "calendar",
        displayName: "Google Calendar",
        description: "",
        status: "connected",
        config: {},
        externalAccountLabel: "Google Calendar",
        externalAccountId: "primary",
        lastError: null,
        lastCheckedAt: null,
        hasAccessToken: true,
        hasRefreshToken: true,
        grantedScopes: ["read"],
        availableScopes: ["read", "write", "delete"],
        tokenExpiresAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as Awaited<ReturnType<typeof integrationsRepo.getIntegrationConnection>>);
    const toolSpy = vi
      .spyOn(toolRegistry, "getChatToolByName")
      .mockImplementation((name) => (name === "google_calendar_events" ? mockedTool : null));

    const response = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "What's my next travel plans on my calendar?",
          mode: "travel",
          timezone: "America/Toronto",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string; model?: string } };
    expect(payload.data?.reply).toContain("2. Spring Reset");
    expect(payload.data?.reply).toContain("Travel Plans");
    expect(payload.data?.model).toBe("tool/google_calendar_events");
    expect(connSpy).toHaveBeenCalled();
    expect(toolSpy).toHaveBeenCalledWith("google_calendar_events");

    const trace = await db.debugTrace.findFirst({
      where: {
        scope: "chat",
        message: { contains: "calendar_intent_detected scope=all window_days=90" },
      },
      orderBy: { at: "desc" },
    });
    expect(trace).toBeTruthy();

    connSpy.mockRestore();
    toolSpy.mockRestore();
  });
});
