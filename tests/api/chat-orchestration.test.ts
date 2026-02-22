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
    await db.memoryEntry.deleteMany({
      where: {
        key: { in: ["home_area", "liked_activity", "disliked_activity", "like_reason", "dislike_reason"] },
      },
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

  it("keeps greeting-only turns lightweight and conversational", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    isActionCommand: false,
                    isCalendarWrite: false,
                    isCalendarQuery: false,
                    referencesPriorSuggestions: false,
                    isTravelQuery: false,
                    isUpcomingQuery: false,
                    isResearchRequest: false,
                    isDiscoveryQuery: false,
                    isGreeting: true,
                    isSmallTalk: false,
                    isCapabilityQuery: false,
                    isLocationInfoQuery: false,
                    isExplicitSuggestionRequest: false,
                    isMetaConversationQuery: false,
                    isProfileCaptureTurn: false,
                    isProximityPreferenceQuery: false,
                    extractedPreferredName: null,
                    extractedCity: null,
                    extractedHomeArea: null,
                    preferenceFeedback: null,
                    capabilityTopic: "general",
                    suggestedMode: "explore",
                    autopilotOperation: "none",
                    autopilotTargetName: null,
                    autopilotCreateFields: null,
                    autopilotOperationConfidence: 0,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "resp_smalltalk_hi",
            model: "openai/gpt-5-nano",
            choices: [{ message: { content: "Hey! How can I help you today?" } }],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "hi",
          mode: "auto",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string; model?: string } };
    expect(payload.data?.model).toBe("openai/gpt-5-nano");
    expect(payload.data?.reply?.toLowerCase()).toContain("how can i help");
    expect(payload.data?.reply?.toLowerCase()).not.toContain("cozy");
    expect(payload.data?.reply?.toLowerCase()).not.toContain("vibe");
  });

  it("does not jump into recommendations on 'how are you' small-talk", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    isActionCommand: false,
                    isCalendarWrite: false,
                    isCalendarQuery: false,
                    referencesPriorSuggestions: false,
                    isTravelQuery: false,
                    isUpcomingQuery: false,
                    isResearchRequest: false,
                    isDiscoveryQuery: false,
                    isGreeting: false,
                    isSmallTalk: true,
                    isCapabilityQuery: false,
                    isLocationInfoQuery: false,
                    isExplicitSuggestionRequest: false,
                    isMetaConversationQuery: false,
                    isProfileCaptureTurn: false,
                    isProximityPreferenceQuery: false,
                    extractedPreferredName: null,
                    extractedCity: null,
                    extractedHomeArea: null,
                    preferenceFeedback: null,
                    capabilityTopic: "general",
                    suggestedMode: "explore",
                    autopilotOperation: "none",
                    autopilotTargetName: null,
                    autopilotCreateFields: null,
                    autopilotOperationConfidence: 0,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "resp_smalltalk_howareyou",
            model: "openai/gpt-5-nano",
            choices: [{ message: { content: "I'm doing great, thanks for asking. What should I call you?" } }],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const thread = await createConversationThread("small talk thread");
    await addConversationMessage({
      threadId: thread.id,
      role: "user",
      content: "hi",
    });
    await addConversationMessage({
      threadId: thread.id,
      role: "assistant",
      content: "Hey! How can I help you today?",
    });

    const response = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          threadId: thread.id,
          message: "how are you?",
          mode: "auto",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string; model?: string } };
    expect(payload.data?.model).toBe("openai/gpt-5-nano");
    expect(payload.data?.reply?.toLowerCase()).toContain("thanks for asking");
    expect(payload.data?.reply?.toLowerCase()).toContain("what should i call you");
    expect(payload.data?.reply?.toLowerCase()).not.toContain("cozy");
    expect(payload.data?.reply?.toLowerCase()).not.toContain("gallery");
  });

  it("answers integration capability questions directly without cards", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  isActionCommand: false,
                  isCalendarWrite: false,
                  isCalendarQuery: false,
                  referencesPriorSuggestions: false,
                  isTravelQuery: false,
                  isUpcomingQuery: false,
                  isResearchRequest: false,
                  isDiscoveryQuery: false,
                  isGreeting: false,
                  isSmallTalk: false,
                  isCapabilityQuery: true,
                  isLocationInfoQuery: false,
                  isExplicitSuggestionRequest: false,
                  isMetaConversationQuery: false,
                  isProfileCaptureTurn: false,
                  isProximityPreferenceQuery: false,
                  extractedPreferredName: null,
                  extractedCity: null,
                  extractedHomeArea: null,
                  preferenceFeedback: null,
                  capabilityTopic: "integrations",
                  suggestedMode: "explore",
                  autopilotOperation: "none",
                  autopilotTargetName: null,
                  autopilotCreateFields: null,
                  autopilotOperationConfidence: 0,
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await db.integrationConnection.upsert({
      where: { provider: "google_calendar" },
      update: {
        status: "connected",
        configJson: JSON.stringify({ grantedScopes: ["read", "write", "delete"] }),
      },
      create: {
        provider: "google_calendar",
        kind: "calendar",
        displayName: "Google Calendar",
        status: "connected",
        configJson: JSON.stringify({ grantedScopes: ["read", "write", "delete"] }),
      },
    });

    const response = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "what integrations do you have enabled right now?",
          mode: "auto",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data?: { reply?: string; model?: string; blocks?: unknown[] };
    };
    expect(payload.data?.model).toBe("policy/capability");
    expect(payload.data?.reply?.toLowerCase()).toContain("enabled integrations");
    expect(payload.data?.reply?.toLowerCase()).toContain("google calendar");
    expect(payload.data?.blocks).toBeUndefined();
  });

  it("answers autopilot + approval gate questions as system-awareness info", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  isActionCommand: false,
                  isCalendarWrite: false,
                  isCalendarQuery: false,
                  referencesPriorSuggestions: false,
                  isTravelQuery: false,
                  isUpcomingQuery: false,
                  isResearchRequest: false,
                  isDiscoveryQuery: false,
                  isGreeting: false,
                  isSmallTalk: false,
                  isCapabilityQuery: true,
                  isLocationInfoQuery: false,
                  isExplicitSuggestionRequest: false,
                  isMetaConversationQuery: false,
                  isProfileCaptureTurn: false,
                  isProximityPreferenceQuery: false,
                  extractedPreferredName: null,
                  extractedCity: null,
                  extractedHomeArea: null,
                  preferenceFeedback: null,
                  capabilityTopic: "general",
                  suggestedMode: "explore",
                  autopilotOperation: "none",
                  autopilotTargetName: null,
                  autopilotCreateFields: null,
                  autopilotOperationConfidence: 0,
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
          message: "what autopilots and approval gate settings do i have?",
          mode: "auto",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data?: { reply?: string; model?: string; blocks?: unknown[] };
    };
    expect(payload.data?.model).toBe("policy/capability");
    expect(payload.data?.reply?.toLowerCase()).toContain("autopilot");
    expect(payload.data?.reply?.toLowerCase()).toContain("approval");
    expect(payload.data?.blocks).toBeUndefined();
  });

  it("proactively checks calendar when user grants/asks access in planning context", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const mockedTool: ChatToolDefinition = {
      name: "google_calendar_events",
      description: "mock",
      parameters: {},
      execute: async (args: Record<string, unknown>) => {
        if (args.operation === "list_multi") {
          return {
            count: 1,
            events: [
              {
                id: "evt_science_fair",
                summary: "Science Fair",
                start: "2026-04-03T16:00:00.000Z",
                end: "2026-04-03T18:00:00.000Z",
                calendarId: "managed",
                calendarName: "Managed Calendar",
                primary: false,
              },
            ],
          };
        }
        return { count: 0, events: [] };
      },
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
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  intentExtractionOk: true,
                  isActionCommand: false,
                  isCalendarWrite: false,
                  isCalendarQuery: false,
                  shouldProactiveCalendarCheck: true,
                  referencesPriorSuggestions: false,
                  isTravelQuery: false,
                  isUpcomingQuery: true,
                  isResearchRequest: false,
                  isDiscoveryQuery: false,
                  isGreeting: false,
                  isSmallTalk: false,
                  isCapabilityQuery: true,
                  isLocationInfoQuery: false,
                  isExplicitSuggestionRequest: false,
                  isMetaConversationQuery: false,
                  isProfileCaptureTurn: false,
                  isProximityPreferenceQuery: false,
                  extractedPreferredName: null,
                  extractedCity: null,
                  extractedHomeArea: null,
                  preferenceFeedback: null,
                  capabilityTopic: "integrations",
                  suggestedMode: "explore",
                  autopilotOperation: "none",
                  autopilotTargetName: null,
                  autopilotCreateFields: null,
                  autopilotOperationConfidence: 0,
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
          message: "Toronto. Do you have access to my calendar?",
          mode: "auto",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string; model?: string } };
    expect(payload.data?.model).toBe("tool/google_calendar_events");
    expect(payload.data?.reply?.toLowerCase()).toContain("next plan");

    connSpy.mockRestore();
    toolSpy.mockRestore();
  });

  it("checks calendar for event-anchored planning even when discovery intent is present", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const mockedTool: ChatToolDefinition = {
      name: "google_calendar_events",
      description: "mock",
      parameters: {},
      execute: async (args: Record<string, unknown>) => {
        if (args.operation === "list_multi") {
          return {
            count: 1,
            events: [
              {
                id: "evt_science_fair_anchor",
                summary: "Ontario Science Centre Event",
                start: "2026-04-03T16:00:00.000Z",
                end: "2026-04-03T18:00:00.000Z",
                calendarId: "managed",
                calendarName: "Managed Calendar",
                primary: false,
              },
            ],
          };
        }
        return { count: 0, events: [] };
      },
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intentExtractionOk: true,
                    isActionCommand: false,
                    isCalendarWrite: false,
                    isCalendarQuery: false,
                    shouldProactiveCalendarCheck: false,
                    referencesPriorSuggestions: false,
                    isTravelQuery: false,
                    isUpcomingQuery: true,
                    isResearchRequest: false,
                    isDiscoveryQuery: true,
                    isGreeting: false,
                    isSmallTalk: false,
                    isCapabilityQuery: false,
                    isLocationInfoQuery: false,
                    isExplicitSuggestionRequest: true,
                    wantsBestEffortNow: false,
                    isMetaConversationQuery: false,
                    isProfileCaptureTurn: false,
                    isProximityPreferenceQuery: false,
                    extractedPreferredName: null,
                    extractedCity: null,
                    extractedHomeArea: null,
                    preferenceFeedback: null,
                    capabilityTopic: "general",
                    suggestedMode: "explore",
                    autopilotOperation: "none",
                    autopilotTargetName: null,
                    autopilotCreateFields: null,
                    autopilotOperationConfidence: 0,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    needsCalendarAnchor: true,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "resp_anchor_plan_1",
            model: "openai/gpt-5-nano",
            choices: [{ message: { content: "Great, I checked your calendar anchor and here are some options before it." } }],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "find me something fun to do just before the Ontario science centre event i have tomorrow",
          mode: "auto",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string; model?: string } };
    expect(payload.data?.model).toBe("openai/gpt-5-nano");
    expect(payload.data?.reply?.toLowerCase()).toContain("before");
    connSpy.mockRestore();
    toolSpy.mockRestore();
  });

  it("rescues missed event-anchor intent with secondary model pass and checks calendar", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const mockedTool: ChatToolDefinition = {
      name: "google_calendar_events",
      description: "mock",
      parameters: {},
      execute: async (args: Record<string, unknown>) => {
        if (args.operation === "list_multi") {
          return {
            count: 1,
            events: [
              {
                id: "evt_science_fair_rescue",
                summary: "Ontario Science Centre Event",
                start: "2026-04-03T16:00:00.000Z",
                end: "2026-04-03T18:00:00.000Z",
                calendarId: "managed",
                calendarName: "Managed Calendar",
                primary: false,
              },
            ],
          };
        }
        return { count: 0, events: [] };
      },
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intentExtractionOk: true,
                    isActionCommand: false,
                    isCalendarWrite: false,
                    isCalendarQuery: false,
                    shouldProactiveCalendarCheck: false,
                    referencesPriorSuggestions: false,
                    isTravelQuery: false,
                    isUpcomingQuery: false,
                    isResearchRequest: false,
                    isDiscoveryQuery: true,
                    isGreeting: false,
                    isSmallTalk: false,
                    isCapabilityQuery: false,
                    isLocationInfoQuery: false,
                    isExplicitSuggestionRequest: true,
                    wantsBestEffortNow: false,
                    isMetaConversationQuery: false,
                    isProfileCaptureTurn: false,
                    isProximityPreferenceQuery: false,
                    extractedPreferredName: null,
                    extractedCity: null,
                    extractedHomeArea: null,
                    preferenceFeedback: null,
                    capabilityTopic: "general",
                    suggestedMode: "explore",
                    autopilotOperation: "none",
                    autopilotTargetName: null,
                    autopilotCreateFields: null,
                    autopilotOperationConfidence: 0,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    shouldProactiveCalendarCheck: true,
                    isUpcomingQuery: true,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    needsCalendarAnchor: true,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "resp_anchor_plan_2",
            model: "openai/gpt-5-nano",
            choices: [{ message: { content: "Perfect — I checked your calendar and here are options you can do before your event." } }],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "find me something fun to do before the Ontario science centre event i have tomorrow",
          mode: "auto",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string; model?: string } };
    expect(payload.data?.model).toBe("openai/gpt-5-nano");
    expect(payload.data?.reply?.toLowerCase()).toContain("before your event");
    connSpy.mockRestore();
    toolSpy.mockRestore();
  });

  it("recovers from failed primary intent extraction via anchor rescue and checks calendar", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const mockedTool: ChatToolDefinition = {
      name: "google_calendar_events",
      description: "mock",
      parameters: {},
      execute: async (args: Record<string, unknown>) => {
        if (args.operation === "list_multi") {
          return {
            count: 1,
            events: [
              {
                id: "evt_science_fair_failover",
                summary: "Ontario Science Centre Event",
                start: "2026-04-03T16:00:00.000Z",
                end: "2026-04-03T18:00:00.000Z",
                calendarId: "managed",
                calendarName: "Managed Calendar",
                primary: false,
              },
            ],
          };
        }
        return { count: 0, events: [] };
      },
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        // Primary classification returns invalid JSON -> intentExtractionOk=false fallback.
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "not-json" } }],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        // Anchor rescue pass recovers proactive-check intent.
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    shouldProactiveCalendarCheck: true,
                    isUpcomingQuery: true,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    isCalendarWriteIntent: false,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    needsCalendarAnchor: true,
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
          message: "hey can you find me something to do before the ontario science fair event i have tomorrow?",
          mode: "auto",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string; model?: string } };
    expect(payload.data?.model).toBe("tool/google_calendar_events");
    expect(payload.data?.reply?.toLowerCase()).toContain("your next plan is");
    connSpy.mockRestore();
    toolSpy.mockRestore();
  });

  it("uses calendar anchor then continues with suggestions for explicit pre-event planning", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const mockedTool: ChatToolDefinition = {
      name: "google_calendar_events",
      description: "mock",
      parameters: {},
      execute: async (args: Record<string, unknown>) => {
        if (args.operation === "list_multi") {
          return {
            count: 1,
            events: [
              {
                id: "evt_pre_event_suggestions",
                summary: "Ontario Science Centre Event",
                start: "2026-04-03T16:00:00.000Z",
                end: "2026-04-03T18:00:00.000Z",
                location: "770 Don Mills Rd, North York, ON",
                calendarId: "managed",
                calendarName: "Managed Calendar",
                primary: false,
              },
            ],
          };
        }
        return { count: 0, events: [] };
      },
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intentExtractionOk: true,
                    isActionCommand: false,
                    isCalendarWrite: false,
                    isCalendarQuery: false,
                    shouldProactiveCalendarCheck: true,
                    referencesPriorSuggestions: false,
                    isTravelQuery: false,
                    isUpcomingQuery: true,
                    isResearchRequest: false,
                    isDiscoveryQuery: true,
                    isGreeting: false,
                    isSmallTalk: false,
                    isCapabilityQuery: false,
                    isLocationInfoQuery: false,
                    isExplicitSuggestionRequest: true,
                    wantsBestEffortNow: false,
                    isMetaConversationQuery: false,
                    isProfileCaptureTurn: false,
                    isProximityPreferenceQuery: false,
                    extractedPreferredName: null,
                    extractedCity: null,
                    extractedHomeArea: null,
                    preferenceFeedback: null,
                    capabilityTopic: "general",
                    suggestedMode: "explore",
                    autopilotOperation: "none",
                    autopilotTargetName: null,
                    autopilotCreateFields: null,
                    autopilotOperationConfidence: 0,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    preferredName: null,
                    city: null,
                    homeArea: null,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    needsCalendarAnchor: true,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "resp_pre_event_suggestions",
            model: "openai/gpt-5-nano",
            choices: [
              {
                message: {
                  content:
                    "Great — your event starts at 12:30 PM. Here are a few fun options nearby you can do before then.",
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
          message: "hey can you find me something to do before the ontario science fair event i have tomorrow?",
          mode: "auto",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string; model?: string } };
    expect(payload.data?.model).toBe("openai/gpt-5-nano");
    expect(payload.data?.reply?.toLowerCase()).toContain("here are a few");
    connSpy.mockRestore();
    toolSpy.mockRestore();
  });

  it("does not misroute calendar add action into read-only calendar intent", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    intentExtractionOk: true,
                    isActionCommand: true,
                    isCalendarWrite: false,
                    isCalendarQuery: true,
                    shouldProactiveCalendarCheck: false,
                    referencesPriorSuggestions: true,
                    isTravelQuery: false,
                    isUpcomingQuery: false,
                    isResearchRequest: false,
                    isDiscoveryQuery: false,
                    isGreeting: false,
                    isSmallTalk: false,
                    isCapabilityQuery: false,
                    isLocationInfoQuery: false,
                    isExplicitSuggestionRequest: false,
                    wantsBestEffortNow: false,
                    isMetaConversationQuery: false,
                    isProfileCaptureTurn: false,
                    isProximityPreferenceQuery: false,
                    extractedPreferredName: null,
                    extractedCity: null,
                    extractedHomeArea: null,
                    preferenceFeedback: null,
                    capabilityTopic: "general",
                    suggestedMode: "explore",
                    autopilotOperation: "none",
                    autopilotTargetName: null,
                    autopilotCreateFields: null,
                    autopilotOperationConfidence: 0,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "resp_calendar_add_action",
            model: "openai/gpt-5-nano",
            choices: [
              {
                message: {
                  content: "Done — I added the first suggestion to your calendar.",
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
          message: "add the first suggestion to my calendar",
          mode: "auto",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string; model?: string } };
    expect(payload.data?.model).toBe("openai/gpt-5-nano");
    expect(payload.data?.reply?.toLowerCase()).toContain("added");
    expect(payload.data?.reply?.toLowerCase()).not.toContain("your next plan is");
  });

  it("keeps location-info questions in direct info mode without unrelated cards", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
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
                    isActionCommand: false,
                    isCalendarWrite: false,
                    isCalendarQuery: false,
                    referencesPriorSuggestions: false,
                    isTravelQuery: false,
                    isUpcomingQuery: false,
                    isResearchRequest: false,
                    isDiscoveryQuery: false,
                    isGreeting: false,
                    isSmallTalk: false,
                    isCapabilityQuery: false,
                    isLocationInfoQuery: true,
                    isExplicitSuggestionRequest: false,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      // generateModelReply
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "resp_info_1",
            model: "openai/gpt-5-nano",
            choices: [
              {
                message: {
                  content: "The CN Tower is located at 290 Bremner Blvd in downtown Toronto.",
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
          message: "where is the CN Tower located?",
          mode: "auto",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as {
      data?: { reply?: string; blocks?: unknown[] };
    };
    expect(payload.data?.reply?.toLowerCase()).toContain("bremner");
    expect(payload.data?.blocks).toBeUndefined();
  });

  it("handles profile capture turn after name input without jumping into planning", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    isActionCommand: false,
                    isCalendarWrite: false,
                    isCalendarQuery: false,
                    referencesPriorSuggestions: false,
                    isTravelQuery: false,
                    isUpcomingQuery: false,
                    isResearchRequest: false,
                    isDiscoveryQuery: false,
                    isGreeting: false,
                    isSmallTalk: true,
                    isCapabilityQuery: false,
                    isLocationInfoQuery: false,
                    isExplicitSuggestionRequest: false,
                    isMetaConversationQuery: false,
                    isProfileCaptureTurn: true,
                    isProximityPreferenceQuery: false,
                    extractedPreferredName: "Richardson",
                    extractedCity: null,
                    extractedHomeArea: null,
                    preferenceFeedback: null,
                    capabilityTopic: "general",
                    suggestedMode: "explore",
                    autopilotOperation: "none",
                    autopilotTargetName: null,
                    autopilotCreateFields: null,
                    autopilotOperationConfidence: 0,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "resp_profile_capture",
            model: "openai/gpt-5-nano",
            choices: [{ message: { content: "Nice to meet you, Richardson. How can I help you today?" } }],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const thread = await createConversationThread("profile capture");
    await addConversationMessage({
      threadId: thread.id,
      role: "assistant",
      content: "Nice to meet you. What should I call you?",
    });

    const response = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          threadId: thread.id,
          message: "Richardson",
          mode: "auto",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string; model?: string } };
    expect(payload.data?.model).toBe("openai/gpt-5-nano");
    expect(payload.data?.reply?.toLowerCase()).toContain("how can i help");
    expect(payload.data?.reply?.toLowerCase()).not.toContain("indoor options");
  });

  it("handles meta memory nudges without planning pivots", async () => {
    await db.memoryEntry.create({
      data: {
        bucket: "profile_memory",
        key: "preferred_name",
        value: "Richardson",
        source: "inferred",
        confidence: 0.9,
      },
    });
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    isActionCommand: false,
                    isCalendarWrite: false,
                    isCalendarQuery: false,
                    referencesPriorSuggestions: false,
                    isTravelQuery: false,
                    isUpcomingQuery: false,
                    isResearchRequest: false,
                    isDiscoveryQuery: false,
                    isGreeting: false,
                    isSmallTalk: false,
                    isCapabilityQuery: false,
                    isLocationInfoQuery: false,
                    isExplicitSuggestionRequest: false,
                    isMetaConversationQuery: true,
                    isProfileCaptureTurn: false,
                    isProximityPreferenceQuery: false,
                    extractedPreferredName: null,
                    extractedCity: null,
                    extractedHomeArea: null,
                    preferenceFeedback: null,
                    capabilityTopic: "general",
                    suggestedMode: "explore",
                    autopilotOperation: "none",
                    autopilotTargetName: null,
                    autopilotCreateFields: null,
                    autopilotOperationConfidence: 0,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "resp_meta_nudge",
            model: "openai/gpt-5-nano",
            choices: [{ message: { content: "You're right, Richardson. Thanks for the nudge. How can I help you right now?" } }],
          }),
          { status: 200 },
        ),
      );
    vi.stubGlobal("fetch", fetchMock);

    const response = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "didn't i tell you my name the other time?",
          mode: "auto",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string; model?: string; blocks?: unknown[] } };
    expect(payload.data?.model).toBe("openai/gpt-5-nano");
    expect(payload.data?.reply?.toLowerCase()).toContain("how can i help you right now");
    expect(payload.data?.reply?.toLowerCase()).not.toContain("quick check");
    expect(payload.data?.reply?.toLowerCase()).not.toContain("tonight");
    expect(payload.data?.blocks).toBeUndefined();
  });

  it("asks for home area when user requests nearby ideas without location granularity", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  isActionCommand: false,
                  isCalendarWrite: false,
                  isCalendarQuery: false,
                  referencesPriorSuggestions: false,
                  isTravelQuery: false,
                  isUpcomingQuery: false,
                  isResearchRequest: false,
                  isDiscoveryQuery: true,
                  isGreeting: false,
                  isSmallTalk: false,
                  isCapabilityQuery: false,
                  isLocationInfoQuery: false,
                  isExplicitSuggestionRequest: true,
                  isProfileCaptureTurn: false,
                  isProximityPreferenceQuery: true,
                  extractedPreferredName: null,
                  extractedCity: null,
                  extractedHomeArea: null,
                  preferenceFeedback: null,
                  capabilityTopic: "general",
                  suggestedMode: "explore",
                  autopilotOperation: "none",
                  autopilotTargetName: null,
                  autopilotCreateFields: null,
                  autopilotOperationConfidence: 0,
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
          message: "give me nearby dinner options",
          mode: "auto",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string; model?: string } };
    expect(payload.data?.model).toBe("policy/profile_clarifier");
    expect(payload.data?.reply?.toLowerCase()).toContain("area should i center around");
  });

  it("does not re-ask city when known and only asks for area granularity", async () => {
    await db.memoryEntry.create({
      data: {
        bucket: "profile_memory",
        key: "city",
        value: "Toronto",
        source: "inferred",
        confidence: 0.91,
      },
    });
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    isActionCommand: false,
                    isCalendarWrite: false,
                    isCalendarQuery: false,
                    referencesPriorSuggestions: false,
                    isTravelQuery: false,
                    isUpcomingQuery: false,
                    isResearchRequest: false,
                    isDiscoveryQuery: true,
                    isGreeting: false,
                    isSmallTalk: false,
                    isCapabilityQuery: false,
                    isLocationInfoQuery: false,
                    isExplicitSuggestionRequest: true,
                    isProfileCaptureTurn: false,
                    isProximityPreferenceQuery: true,
                    extractedPreferredName: null,
                    extractedCity: null,
                    extractedHomeArea: null,
                    preferenceFeedback: null,
                    capabilityTopic: "general",
                    suggestedMode: "explore",
                    autopilotOperation: "none",
                    autopilotTargetName: null,
                    autopilotCreateFields: null,
                    autopilotOperationConfidence: 0,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    preferredName: null,
                    city: null,
                    homeArea: null,
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
          message: "show nearby dinner ideas",
          mode: "auto",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string; model?: string } };
    expect(payload.data?.model).toBe("policy/profile_clarifier");
    expect(payload.data?.reply?.toLowerCase()).toContain("in toronto");
    expect(payload.data?.reply?.toLowerCase()).not.toContain("what city are you in");
  });

  it("breaks clarification loops by switching to best-effort suggestions", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const thread = await createConversationThread("clarifier loop thread");
    await addConversationMessage({
      threadId: thread.id,
      role: "assistant",
      content:
        "I can keep it close to home. Which area should I center around in Toronto (neighborhood or nearest major intersection)?",
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    isActionCommand: false,
                    isCalendarWrite: false,
                    isCalendarQuery: false,
                    referencesPriorSuggestions: false,
                    isTravelQuery: false,
                    isUpcomingQuery: false,
                    isResearchRequest: false,
                    isDiscoveryQuery: true,
                    isGreeting: false,
                    isSmallTalk: false,
                    isCapabilityQuery: false,
                    isLocationInfoQuery: false,
                    isExplicitSuggestionRequest: true,
                    isProfileCaptureTurn: false,
                    isProximityPreferenceQuery: true,
                    extractedPreferredName: null,
                    extractedCity: null,
                    extractedHomeArea: null,
                    preferenceFeedback: null,
                    capabilityTopic: "general",
                    suggestedMode: "explore",
                    autopilotOperation: "none",
                    autopilotTargetName: null,
                    autopilotCreateFields: null,
                    autopilotOperationConfidence: 0,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    preferredName: null,
                    city: null,
                    homeArea: null,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "resp_loop_break",
            model: "openai/gpt-5-nano",
            choices: [{ message: { content: "Let me suggest a few solid nearby-leaning options and you can pick one." } }],
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
          message: "nearby dinner options please",
          mode: "auto",
        }),
      }),
    );
    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string; model?: string } };
    expect(payload.data?.model).toBe("openai/gpt-5-nano");
    expect(payload.data?.reply?.toLowerCase()).toContain("suggest");
    expect(payload.data?.reply?.toLowerCase()).not.toContain("which area should i center around");
  });

  it("persists extracted home area and preference feedback from model intent", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    isActionCommand: false,
                    isCalendarWrite: false,
                    isCalendarQuery: false,
                    referencesPriorSuggestions: false,
                    isTravelQuery: false,
                    isUpcomingQuery: false,
                    isResearchRequest: false,
                    isDiscoveryQuery: false,
                    isGreeting: false,
                    isSmallTalk: true,
                    isCapabilityQuery: false,
                    isLocationInfoQuery: false,
                    isExplicitSuggestionRequest: false,
                    isProfileCaptureTurn: true,
                    isProximityPreferenceQuery: false,
                    extractedPreferredName: null,
                    extractedCity: "Toronto",
                    extractedHomeArea: "Queen West",
                    preferenceFeedback: {
                      subject: "escape rooms",
                      sentiment: "disliked",
                      reason: "too crowded",
                    },
                    capabilityTopic: "general",
                    suggestedMode: "explore",
                    autopilotOperation: "none",
                    autopilotTargetName: null,
                    autopilotCreateFields: null,
                    autopilotOperationConfidence: 0,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "resp_smalltalk_1",
            model: "openai/gpt-5-nano",
            choices: [
              {
                message: {
                  content: "Thanks for sharing that. I noted it and I can adapt future picks.",
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
          message: "Queen West and I did not like escape rooms, too crowded",
          mode: "auto",
        }),
      }),
    );
    expect(response.status).toBe(200);

    const homeArea = await db.memoryEntry.findFirst({
      where: { bucket: "profile_memory", key: "home_area" },
      orderBy: { createdAt: "desc" },
    });
    const disliked = await db.memoryEntry.findFirst({
      where: { bucket: "taste_memory", key: "disliked_activity" },
      orderBy: { createdAt: "desc" },
    });
    const reason = await db.memoryEntry.findFirst({
      where: { bucket: "logistics_memory", key: "dislike_reason" },
      orderBy: { createdAt: "desc" },
    });

    expect(homeArea?.value).toBe("Queen West");
    expect(disliked?.value.toLowerCase()).toContain("escape rooms");
    expect(reason?.value.toLowerCase()).toContain("too crowded");
  });

  it("creates a pack from explicit chat command", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  isActionCommand: false,
                  isCalendarWrite: false,
                  isCalendarQuery: false,
                  referencesPriorSuggestions: false,
                  isTravelQuery: false,
                  isUpcomingQuery: false,
                  isResearchRequest: false,
                  isDiscoveryQuery: false,
                  isGreeting: false,
                  isSmallTalk: false,
                  isCapabilityQuery: false,
                  isLocationInfoQuery: false,
                  isExplicitSuggestionRequest: false,
                  isMetaConversationQuery: false,
                  isProfileCaptureTurn: false,
                  isProximityPreferenceQuery: false,
                  extractedPreferredName: null,
                  extractedCity: null,
                  extractedHomeArea: null,
                  preferenceFeedback: null,
                  capabilityTopic: "general",
                  suggestedMode: "explore",
                  autopilotOperation: "none",
                  autopilotTargetName: null,
                  autopilotCreateFields: null,
                  autopilotOperationConfidence: 0,
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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
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
                    isDiscoveryQuery: false,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    isCalendarWriteIntent: false,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    isPersonalCalendarRead: true,
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
    expect(fetchMock).toHaveBeenCalledTimes(4);

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
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
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
                    isDiscoveryQuery: false,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    isCalendarWriteIntent: false,
                  }),
                },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    isPersonalCalendarRead: true,
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
                  isDiscoveryQuery: false,
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

  it("answers booking recall questions without forcing calendar write mode", async () => {
    const thread = await createConversationThread("booking recall");
    await addConversationMessage({
      threadId: thread.id,
      role: "user",
      content: "Please book Velvet Lantern dinner for tomorrow at 7pm.",
    });

    const response = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          threadId: thread.id,
          message: "what's the event I asked you to book for me yesterday?",
          mode: "auto",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string; model?: string } };
    expect(payload.data?.model).toBe("policy/memory_recall");
    expect(payload.data?.reply).toContain("Velvet Lantern");
    expect(payload.data?.reply?.toLowerCase()).not.toContain("calendar change yet");
  });

  it("answers who-am-I-meeting-today from calendar attendees", async () => {
    const now = Date.now();
    const startIso = new Date(now + 30 * 60 * 1000).toISOString();
    const endIso = new Date(now + 90 * 60 * 1000).toISOString();
    await db.integrationConnection.upsert({
      where: { provider: "google_calendar" },
      update: {
        status: "connected",
        configJson: JSON.stringify({ grantedScopes: ["read"] }),
      },
      create: {
        provider: "google_calendar",
        kind: "calendar",
        displayName: "Google Calendar",
        status: "connected",
        configJson: JSON.stringify({ grantedScopes: ["read"] }),
      },
    });

    const mockedTool: ChatToolDefinition = {
      name: "google_calendar_events",
      description: "mock",
      parameters: {},
      execute: async () => ({
        count: 1,
        events: [
          {
            id: "evt_today",
            summary: "Lunch Sync",
            start: startIso,
            end: endIso,
            attendees: ["alex.morgan@example.com", "sam@example.com"],
            calendarId: "managed",
            calendarName: "Managed Calendar",
          },
        ],
      }),
    };
    const toolSpy = vi.spyOn(toolRegistry, "getChatToolByName").mockImplementation((name) =>
      name === "google_calendar_events" ? mockedTool : null,
    );

    const response = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "who am i meeting today?",
          mode: "auto",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string; model?: string } };
    expect(payload.data?.model).toBe("policy/memory_recall");
    expect(payload.data?.reply?.toLowerCase()).toContain("today you're meeting");
    expect(payload.data?.reply).toContain("Alex Morgan");
    expect(payload.data?.reply).toContain("Sam");
    toolSpy.mockRestore();
  });

  it("recalls restaurant recommendations from prior assistant option cards", async () => {
    const thread = await createConversationThread("restaurant recall");
    await addConversationMessage({
      threadId: thread.id,
      role: "assistant",
      content: "Here is a dinner option.",
      blocksJson: JSON.stringify([
        {
          type: "option_set",
          items: [
            {
              index: 1,
              card: {
                type: "image_card",
                title: "Sora Bistro",
                subtitle: "Quiet modern Japanese spot",
                imageUrl: "https://example.com/sora.jpg",
                actionUrl: "https://example.com/sora",
                meta: { category: "restaurant" },
              },
            },
          ],
        },
      ]),
    });

    const response = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          threadId: thread.id,
          message: "remember the restaurant you recommended two days ago? what was the name of that restaurant?",
          mode: "auto",
        }),
      }),
    );

    expect(response.status).toBe(200);
    const payload = (await response.json()) as { data?: { reply?: string; model?: string } };
    expect(payload.data?.model).toBe("policy/memory_recall");
    expect(payload.data?.reply).toContain("Sora Bistro");
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
                  isDiscoveryQuery: false,
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

  it("injects weather brief context for time-specific planning turns", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    await db.integrationConnection.upsert({
      where: { provider: "weather" },
      update: {
        status: "connected",
        configJson: JSON.stringify({ defaultLocation: "Toronto", grantedScopes: ["read"] }),
      },
      create: {
        provider: "weather",
        kind: "context",
        status: "connected",
        displayName: "Weather",
        configJson: JSON.stringify({ defaultLocation: "Toronto", grantedScopes: ["read"] }),
      },
    });

    let openRouterCalls = 0;
    let weatherBriefSeen = false;
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("geocoding-api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            results: [{ latitude: 43.65, longitude: -79.38, name: "Toronto", country: "Canada" }],
          }),
          { status: 200 },
        );
      }
      if (url.includes("api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            current: { temperature_2m: 7.8, precipitation_probability: 55, weather_code: 3 },
            hourly: {
              time: ["2026-02-22T17:00:00Z", "2026-02-22T18:00:00Z"],
              temperature_2m: [7.4, 7.1],
              precipitation_probability: [72, 68],
              weather_code: [61, 61],
            },
            daily: {
              time: ["2026-02-22", "2026-02-23", "2026-02-24", "2026-02-25", "2026-02-26", "2026-02-27", "2026-02-28"],
              temperature_2m_max: [8, 7, 6, 5, 7, 8, 9],
              temperature_2m_min: [2, 1, 0, -1, 1, 2, 3],
              precipitation_probability_max: [70, 55, 40, 30, 35, 42, 65],
              weather_code: [61, 3, 3, 3, 3, 3, 61],
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("openrouter.ai")) {
        openRouterCalls += 1;
        const body = JSON.parse(String(init?.body ?? "{}")) as { messages?: Array<{ content?: string }> };
        const messageContents = (body.messages ?? []).map((m) => (typeof m.content === "string" ? m.content : ""));
        weatherBriefSeen = weatherBriefSeen || messageContents.some((content) => content.includes("WEATHER BRIEF:"));
        if (openRouterCalls === 1) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      isActionCommand: false,
                      isCalendarWrite: false,
                      isCalendarQuery: false,
                      shouldProactiveCalendarCheck: false,
                      referencesPriorSuggestions: false,
                      isTravelQuery: false,
                      isUpcomingQuery: false,
                      isResearchRequest: false,
                      isDiscoveryQuery: true,
                      isGreeting: false,
                      isSmallTalk: false,
                      isCapabilityQuery: false,
                      isLocationInfoQuery: false,
                      isExplicitSuggestionRequest: true,
                      wantsBestEffortNow: false,
                      isMetaConversationQuery: false,
                      isProfileCaptureTurn: false,
                      isProximityPreferenceQuery: false,
                      capabilityTopic: "general",
                      suggestedMode: "explore",
                      extractedPreferredName: null,
                      extractedCity: "Toronto",
                      extractedHomeArea: null,
                      preferenceFeedback: null,
                      autopilotOperation: "none",
                      autopilotTargetName: null,
                      autopilotCreateFields: null,
                      autopilotOperationConfidence: 0,
                    }),
                  },
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            id: "resp_weather_1",
            model: "openai/gpt-5-nano",
            choices: [{ message: { content: "At 5 PM rain looks likely, so I suggest an indoor-first option." } }],
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "Plan me something for 5pm today in Toronto.",
          mode: "auto",
          timezone: "America/Toronto",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(weatherBriefSeen).toBe(true);
  });

  it("injects week-ahead weather signal for future planning requests", async () => {
    process.env.OPENROUTER_API_KEY = "test-key";
    await db.integrationConnection.upsert({
      where: { provider: "weather" },
      update: {
        status: "connected",
        configJson: JSON.stringify({ defaultLocation: "Toronto", grantedScopes: ["read"] }),
      },
      create: {
        provider: "weather",
        kind: "context",
        status: "connected",
        displayName: "Weather",
        configJson: JSON.stringify({ defaultLocation: "Toronto", grantedScopes: ["read"] }),
      },
    });

    let openRouterCalls = 0;
    let capturedWeatherBrief = "";
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (url.includes("geocoding-api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            results: [{ latitude: 43.65, longitude: -79.38, name: "Toronto", country: "Canada" }],
          }),
          { status: 200 },
        );
      }
      if (url.includes("api.open-meteo.com")) {
        return new Response(
          JSON.stringify({
            current: { temperature_2m: 6.8, precipitation_probability: 31, weather_code: 3 },
            hourly: {
              time: ["2026-02-22T17:00:00Z", "2026-02-22T18:00:00Z"],
              temperature_2m: [6.2, 6.1],
              precipitation_probability: [22, 26],
              weather_code: [3, 3],
            },
            daily: {
              time: ["2026-02-22", "2026-02-23", "2026-02-24", "2026-02-25", "2026-02-26", "2026-02-27", "2026-02-28"],
              temperature_2m_max: [8, 7, 7, 8, 6, 5, 4],
              temperature_2m_min: [2, 1, 1, 2, 0, -1, -2],
              precipitation_probability_max: [25, 30, 22, 35, 40, 52, 74],
              weather_code: [3, 3, 3, 3, 3, 51, 61],
            },
          }),
          { status: 200 },
        );
      }
      if (url.includes("openrouter.ai")) {
        openRouterCalls += 1;
        const body = JSON.parse(String(init?.body ?? "{}")) as { messages?: Array<{ content?: string }> };
        const weatherMessage = (body.messages ?? [])
          .map((m) => (typeof m.content === "string" ? m.content : ""))
          .find((content) => content.includes("WEATHER BRIEF:"));
        if (weatherMessage) capturedWeatherBrief = weatherMessage;
        if (openRouterCalls === 1) {
          return new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      isActionCommand: false,
                      isCalendarWrite: false,
                      isCalendarQuery: false,
                      shouldProactiveCalendarCheck: false,
                      referencesPriorSuggestions: false,
                      isTravelQuery: false,
                      isUpcomingQuery: false,
                      isResearchRequest: false,
                      isDiscoveryQuery: true,
                      isGreeting: false,
                      isSmallTalk: false,
                      isCapabilityQuery: false,
                      isLocationInfoQuery: false,
                      isExplicitSuggestionRequest: true,
                      wantsBestEffortNow: false,
                      isMetaConversationQuery: false,
                      isProfileCaptureTurn: false,
                      isProximityPreferenceQuery: false,
                      capabilityTopic: "general",
                      suggestedMode: "travel",
                      extractedPreferredName: null,
                      extractedCity: "Toronto",
                      extractedHomeArea: null,
                      preferenceFeedback: null,
                      autopilotOperation: "none",
                      autopilotTargetName: null,
                      autopilotCreateFields: null,
                      autopilotOperationConfidence: 0,
                    }),
                  },
                },
              ],
            }),
            { status: 200 },
          );
        }
        return new Response(
          JSON.stringify({
            id: "resp_weather_2",
            model: "openai/gpt-5-nano",
            choices: [{ message: { content: "Next week looks mixed, so keep an indoor backup for Saturday." } }],
          }),
          { status: 200 },
        );
      }
      throw new Error(`Unexpected fetch URL: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await chatPost(
      new Request("http://localhost/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message: "Plan something fun for next Saturday night in Toronto.",
          mode: "auto",
          timezone: "America/Toronto",
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(capturedWeatherBrief).toContain("Week-ahead signal");
  });
});
