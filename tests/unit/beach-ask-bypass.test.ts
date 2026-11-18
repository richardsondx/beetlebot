import { describe, expect, it } from "vitest";
import {
  composePolicySections,
  resolveBeachAskIntent,
  type BeachAskIntentInput,
  type PromptPolicyContext,
} from "../../app/api/chat/route";
import { mentionsBeachDestination } from "../../lib/travel/beach-compare";

/** Intent extraction failed: the exact state fix round 1 mishandled. */
const FAILED_PARSE: BeachAskIntentInput = {
  isExplicitSuggestionRequest: false,
  wantsBestEffortNow: false,
  intentExtractionOk: false,
};

const OK_PARSE: BeachAskIntentInput = {
  isExplicitSuggestionRequest: false,
  wantsBestEffortNow: false,
  intentExtractionOk: true,
};

function buildContext(
  overrides: Partial<PromptPolicyContext> = {},
): PromptPolicyContext {
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

describe("beach asks survive a failed intent parse", () => {
  it("short compare ask does not take the clarification path", () => {
    // Fix round 1 verdict: this prompt got a clarifying question both
    // live runs because shouldUseSafeNoIntentMode fired before the
    // smalltalk branch. The guard must not fire for it.
    const resolved = resolveBeachAskIntent(
      "Bali vs Maldives vs Palawan, which should I pick?",
      FAILED_PARSE,
    );
    expect(resolved.isBeachAsk).toBe(true);
    expect(resolved.shouldUseSafeNoIntentMode).toBe(false);
    expect(resolved.explicitSuggestionRequest).toBe(true);
    expect(resolved.allowBestEffortSuggestions).toBe(true);
  });

  it("'Tell me more about Palawan' reaches enrichment", () => {
    // allowBestEffortSuggestions is the flag the enrichment gate reads
    // (suppressVisualEnrichment is false when it is true), and the
    // safe-no-intent guard must not fire, so the reply goes to
    // recommendation mode instead of the clarification path.
    const resolved = resolveBeachAskIntent(
      "Tell me more about Palawan",
      FAILED_PARSE,
    );
    expect(resolved.isBeachAsk).toBe(true);
    expect(resolved.shouldUseSafeNoIntentMode).toBe(false);
    expect(resolved.explicitSuggestionRequest).toBe(true);
    expect(resolved.allowBestEffortSuggestions).toBe(true);
  });

  it("covers the other tell-me-about phrasings", () => {
    for (const message of [
      "Tell me about Bali",
      "Tell me more about Bali",
      "Tell me about Maldives",
      "Tell me more about the Maldives",
      "Tell me about Palawan",
    ]) {
      const resolved = resolveBeachAskIntent(message, FAILED_PARSE);
      expect(resolved.isBeachAsk).toBe(true);
      expect(resolved.shouldUseSafeNoIntentMode).toBe(false);
      expect(resolved.allowBestEffortSuggestions).toBe(true);
    }
  });

  it("keeps the guard for non-beach asks when parsing fails", () => {
    const resolved = resolveBeachAskIntent("hello there", FAILED_PARSE);
    expect(resolved.isBeachAsk).toBe(false);
    expect(resolved.shouldUseSafeNoIntentMode).toBe(true);
    expect(resolved.allowBestEffortSuggestions).toBe(false);
    expect(resolved.explicitSuggestionRequest).toBe(false);
  });

  it("keeps the guard for a one-beach plan ask without tell-me-about wording", () => {
    const resolved = resolveBeachAskIntent(
      "Plan a beach trip to Bali",
      FAILED_PARSE,
    );
    expect(resolved.isBeachAsk).toBe(false);
    expect(resolved.shouldUseSafeNoIntentMode).toBe(true);
    expect(resolved.allowBestEffortSuggestions).toBe(false);
  });

  it("does not change the outcome when parsing succeeds", () => {
    const resolved = resolveBeachAskIntent(
      "Bali vs Maldives vs Palawan, which should I pick?",
      OK_PARSE,
    );
    expect(resolved.shouldUseSafeNoIntentMode).toBe(false);
    expect(resolved.allowBestEffortSuggestions).toBe(true);
    const plain = resolveBeachAskIntent("hello there", OK_PARSE);
    expect(plain.shouldUseSafeNoIntentMode).toBe(false);
    expect(plain.allowBestEffortSuggestions).toBe(false);
  });

  it("tell-me-about asks are not typed beach picks", () => {
    // The typed-pick short-circuit upstream of the intent guard must
    // not swallow a preview ask: "Tell me more about Palawan" is a
    // tell-me-about ask, while "Maldives" and "Pick Bali" stay picks.
    expect(mentionsBeachDestination("Tell me more about Palawan")).toBe(true);
    expect(mentionsBeachDestination("Maldives")).toBe(false);
    expect(mentionsBeachDestination("Pick Bali")).toBe(false);
  });
});

describe("bypass flags remove the clarification policy lines", () => {
  it("beach-ask flags drop the safe-fallback and no-recommendations lines", () => {
    const resolved = resolveBeachAskIntent(
      "Bali vs Maldives vs Palawan, which should I pick?",
      FAILED_PARSE,
    );
    const sections = composePolicySections(
      buildContext({
        allowBestEffortSuggestions: resolved.allowBestEffortSuggestions,
        explicitSuggestionRequest: resolved.explicitSuggestionRequest,
        shouldUseSafeNoIntentMode: resolved.shouldUseSafeNoIntentMode,
      }),
    );
    const joined = sections.join("\n");
    expect(joined).not.toContain("Intent extraction is unavailable");
    expect(joined).not.toContain(
      "Do not provide concrete recommendation lists/options",
    );
  });

  it("guard flags keep the safe-fallback line for a non-beach ask", () => {
    const resolved = resolveBeachAskIntent("hello there", FAILED_PARSE);
    const sections = composePolicySections(
      buildContext({
        allowBestEffortSuggestions: resolved.allowBestEffortSuggestions,
        explicitSuggestionRequest: resolved.explicitSuggestionRequest,
        shouldUseSafeNoIntentMode: resolved.shouldUseSafeNoIntentMode,
      }),
    );
    const joined = sections.join("\n");
    expect(joined).toContain("Intent extraction is unavailable");
    expect(joined).toContain(
      "Do not provide concrete recommendation lists/options",
    );
  });
});
