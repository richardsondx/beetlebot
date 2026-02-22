import { describe, expect, it } from "vitest";
import { composePolicySections, type PromptPolicyContext } from "../../app/api/chat/route";

function buildContext(overrides: Partial<PromptPolicyContext> = {}): PromptPolicyContext {
  return {
    effectiveMode: "explore",
    isActionCmd: false,
    isCapabilityQuery: false,
    isCapabilityHelpTurn: false,
    isLocationInfoQuery: false,
    allowBestEffortSuggestions: false,
    preferredName: "Richardson",
    preferredCity: "Toronto",
    homeArea: null,
    isNewThread: false,
    isLightConversationTurn: false,
    isMetaConversationQuery: false,
    isLateNight: false,
    explicitSuggestionRequest: false,
    shouldUseSafeNoIntentMode: false,
    wantsBestEffortNow: false,
    calendarIntent: false,
    calendarWriteIntent: false,
    shouldProactiveCalendarCheck: false,
    integrationStatus: "Google Calendar: connected [calendar.read]",
    packStatus: "No packs enabled.",
    autopilotStatus: "No autopilots configured.",
    approvalGateStatus: "defaultApproval=ask_first; spendCap=120; quietHours=23-07",
    shouldInjectPackContext: false,
    packContext: null,
    hasRecentClarifier: false,
    ...overrides,
  };
}

describe("prompt policy composition", () => {
  it("emits policy sections in stable order", () => {
    const sections = composePolicySections(buildContext());
    expect(sections[0]).toContain("You are beetlebot");
    expect(sections[1]).toContain("TOOL CAPABILITY POLICY:");
    expect(sections[2]).toContain("MEMORY POLICY:");
    expect(sections[3]).toContain("CONVERSATION POLICY:");
    expect(sections[4]).toContain("OUTPUT FORMAT POLICY:");
  });

  it("keeps informational turns text-first", () => {
    const sections = composePolicySections(
      buildContext({
        isCapabilityQuery: true,
        isLocationInfoQuery: true,
        allowBestEffortSuggestions: false,
      }),
    );
    const outputSection = sections.at(-1) ?? "";
    expect(outputSection).toContain("OUTPUT FORMAT POLICY:");
    expect(outputSection).toContain("answer directly and concisely");
    expect(outputSection).toContain("concise text format");
    expect(outputSection).not.toContain("Return ONLY valid JSON");
  });

  it("enables visual response contract only when suggestion-eligible", () => {
    const sections = composePolicySections(
      buildContext({
        allowBestEffortSuggestions: true,
        isCapabilityQuery: false,
        isLocationInfoQuery: false,
      }),
    );
    const outputSection = sections.at(-1) ?? "";
    expect(outputSection).toContain("OUTPUT FORMAT POLICY:");
    expect(outputSection).toContain("respond ONLY with a JSON object");
  });
});
