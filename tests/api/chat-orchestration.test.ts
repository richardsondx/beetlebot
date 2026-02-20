import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "../../lib/db";
import {
  extractThreadSuggestionsForIntent,
  POST as chatPost,
} from "../../app/api/chat/route";
import { createConversationThread, addConversationMessage } from "../../lib/repositories/conversations";
import * as integrationsRepo from "../../lib/repositories/integrations";
import * as toolRegistry from "../../lib/tools/registry";
import type { ChatToolDefinition } from "../../lib/tools/types";

describe("chat orchestration", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.OPENROUTER_API_KEY;
  });

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
    process.env.OPENROUTER_API_KEY = "test-key";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: "resp_1",
            model: "openai/gpt-5-nano",
            choices: [{ message: { content: "Quick check — what city should I focus on?" } }],
          }),
          { status: 200 },
        ),
      ),
    );

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
    process.env.OPENROUTER_API_KEY = "test-key";
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
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  isActionCommand: false,
                  isCalendarWrite: false,
                  isCalendarQuery: true,
                  referencesPriorSuggestions: false,
                  isTravelQuery: true,
                  isUpcomingQuery: true,
                  isResearchRequest: false,
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

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
    expect(fetchMock).toHaveBeenCalledTimes(1);

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

  it("surfaces calendar tool errors instead of reporting empty calendars", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";

    const mockedTool: ChatToolDefinition = {
      name: "google_calendar_events",
      description: "mock",
      parameters: {},
      execute: async () => ({ error: "Google Calendar token expired" }),
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
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  isActionCommand: false,
                  isCalendarWrite: false,
                  isCalendarQuery: true,
                  referencesPriorSuggestions: false,
                  isTravelQuery: false,
                  isUpcomingQuery: true,
                  isResearchRequest: false,
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    const response = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "what's next on my calendar?",
          mode: "explore",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string } };
    expect(payload.data?.reply).toContain("couldn't read your calendar");
    expect(payload.data?.reply).not.toContain("couldn’t find any");

    const trace = await db.debugTrace.findFirst({
      where: {
        scope: "chat",
        message: { contains: "calendar_intent_tool_error" },
      },
      orderBy: { at: "desc" },
    });
    expect(trace).toBeTruthy();

    connSpy.mockRestore();
    toolSpy.mockRestore();
  });

  it("routes 'fix duplicate in my calendar' through calendar write path", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";

    const executeCalls: Array<Record<string, unknown>> = [];
    const mockedTool: ChatToolDefinition = {
      name: "google_calendar_events",
      description: "mock",
      parameters: {},
      execute: async (args: Record<string, unknown>) => {
        executeCalls.push(args);
        if (args.operation === "create") {
          return { created: true, eventId: "evt_new" };
        }
        return { count: 0, events: [] };
      },
    };

    const toolSpy = vi
      .spyOn(toolRegistry, "getChatToolByName")
      .mockImplementation((name) => (name === "google_calendar_events" ? mockedTool : null));

    const fetchMock = vi
      .fn()
      // classifyMessageIntent
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    isActionCommand: true,
                    isCalendarWrite: true,
                    isCalendarQuery: true,
                    referencesPriorSuggestions: false,
                    isTravelQuery: false,
                    isUpcomingQuery: false,
                    isResearchRequest: false,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      // generateModelReply round 1 => create tool call
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "resp_1",
            model: "openai/gpt-5-nano",
            choices: [
              {
                message: {
                  content: "",
                  tool_calls: [
                    {
                      id: "call_1",
                      type: "function",
                      function: {
                        name: "google_calendar_events",
                        arguments: JSON.stringify({
                          operation: "create",
                          summary: "🍰 Dessert Crawl",
                          start: "2026-02-22T19:00:00.000Z",
                          end: "2026-02-22T21:00:00.000Z",
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      // generateModelReply round 2 => final assistant response
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "resp_2",
            model: "openai/gpt-5-nano",
            choices: [{ message: { content: "Done — I fixed it on your calendar." } }],
          }),
          { status: 200 },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const response = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "fix duplicate in my calendar",
          mode: "social",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string; model?: string } };
    expect(payload.data?.reply).toContain("fixed it on your calendar");
    expect(payload.data?.model).toBe("openai/gpt-5-nano");

    const operations = executeCalls
      .map((call) => (typeof call.operation === "string" ? call.operation : null))
      .filter((op): op is string => Boolean(op));
    expect(operations).toContain("create");
    expect(operations).not.toEqual(["list_multi"]);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    toolSpy.mockRestore();
  });

  it("extracts prior thread suggestions from assistant blocks", () => {
    const suggestions = extractThreadSuggestionsForIntent([
      {
        role: "assistant",
        blocksJson: JSON.stringify([
          {
            type: "option_set",
            items: [
              {
                index: 1,
                card: {
                  type: "image_card",
                  title: "Nadege Patisserie",
                  subtitle: "French pastries near Ossington",
                  imageUrl: "https://example.com/pic1.jpg",
                  actionUrl: "https://example.com/nadege",
                },
              },
              {
                index: 2,
                card: {
                  type: "image_card",
                  title: "Le Gourmand",
                  subtitle: "Cookies and cafe stop",
                  imageUrl: "https://example.com/pic2.jpg",
                  actionUrl: "https://example.com/gourmand",
                },
              },
            ],
          },
        ]),
      },
      {
        role: "user",
        blocksJson: null,
      },
    ]);

    expect(suggestions).toHaveLength(2);
    expect(suggestions[0]?.index).toBe(1);
    expect(suggestions[0]?.title).toBe("Nadege Patisserie");
    expect(suggestions[1]?.title).toBe("Le Gourmand");
  });

  it("updates existing duplicate event when intent is clear", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";

    const thread = await createConversationThread("dessert crawl");
    await addConversationMessage({
      threadId: thread.id,
      role: "assistant",
      content: "Here are options",
      blocksJson: JSON.stringify([
        {
          type: "option_set",
          items: [
            {
              index: 1,
              card: {
                type: "image_card",
                title: "Le Gourmand",
                subtitle: "Cookies and cafe stop",
                imageUrl: "https://example.com/pic2.jpg",
                actionUrl: "https://example.com/gourmand",
              },
            },
          ],
        },
      ]),
    });

    const executeCalls: Array<Record<string, unknown>> = [];
    const mockedTool: ChatToolDefinition = {
      name: "google_calendar_events",
      description: "mock",
      parameters: {},
      execute: async (args: Record<string, unknown>) => {
        executeCalls.push(args);
        if (args.operation === "list_multi") {
          return {
            events: [
              {
                id: "evt_existing",
                summary: "Dessert Crawl (Suggestion) - Ossington/Junction",
                description: "Afternoon dessert crawl",
                start: "2026-02-22T19:00:00.000Z",
                end: "2026-02-22T21:00:00.000Z",
                location: "Ossington/Junction area",
                calendarId: "managed_1",
                calendarName: "🪲 Managed Calendar",
              },
            ],
          };
        }
        if (args.operation === "update") {
          return { updated: true, eventId: args.eventId };
        }
        if (args.operation === "create") {
          return { created: true };
        }
        return { ok: true };
      },
    };

    const toolSpy = vi
      .spyOn(toolRegistry, "getChatToolByName")
      .mockImplementation((name) => (name === "google_calendar_events" ? mockedTool : null));

    const fetchMock = vi
      .fn()
      // classifyMessageIntent
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    isActionCommand: true,
                    isCalendarWrite: true,
                    isCalendarQuery: true,
                    referencesPriorSuggestions: true,
                    isTravelQuery: false,
                    isUpcomingQuery: false,
                    isResearchRequest: false,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      // resolveSuggestionIntentFromThread
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    selectedIndices: [1],
                    confidence: 0.93,
                    rationale: "The user refers to the prior dessert suggestion.",
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      // generateModelReply round 1 => create tool call
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "resp_1",
            model: "openai/gpt-5-nano",
            choices: [
              {
                message: {
                  content: "",
                  tool_calls: [
                    {
                      id: "call_1",
                      type: "function",
                      function: {
                        name: "google_calendar_events",
                        arguments: JSON.stringify({
                          operation: "create",
                          summary: "Dessert Crawl (Suggestion) - Ossington/Junction",
                          start: "2026-02-22T19:00:00.000Z",
                          end: "2026-02-22T21:00:00.000Z",
                          description: "Afternoon dessert crawl in Ossington/Junction area.",
                          location: "Ossington/Junction area",
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      // generateModelReply round 2 => final assistant response
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "resp_2",
            model: "openai/gpt-5-nano",
            choices: [{ message: { content: "Done — I updated the existing event with the suggestion details." } }],
          }),
          { status: 200 },
        ),
      );

    vi.stubGlobal("fetch", fetchMock);

    const response = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          threadId: thread.id,
          message: "add those suggestions to my calendar Sunday afternoon",
          mode: "social",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string } };
    expect(payload.data?.reply).toContain("updated the existing event");

    const operations = executeCalls
      .map((call) => (typeof call.operation === "string" ? call.operation : null))
      .filter((op): op is string => Boolean(op));
    expect(operations).toContain("list_multi");
    expect(operations).toContain("update");
    expect(operations).not.toContain("create");

    const updateCall = executeCalls.find((call) => call.operation === "update");
    expect(typeof updateCall?.description).toBe("string");
    expect(String(updateCall?.description)).toContain("Le Gourmand");

    toolSpy.mockRestore();
  });
});
