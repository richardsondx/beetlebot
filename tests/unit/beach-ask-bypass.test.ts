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

/** Successful parse where the classifier also flagged a place-info question. */
const INFO_PARSE_OK: BeachAskIntentInput = {
  ...OK_PARSE,
  isLocationInfoQuery: true,
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

describe("beach asks are not location-info questions", () => {
  it("'Tell me more about Palawan' clears isLocationInfoQuery on a successful parse", () => {
    // Fix cycle 2 root cause, live in both drive runs: the classifier
    // reads a tell-me-about ask as a factual place-info question, so
    // isLocationInfoQuery came back true with intentExtractionOk true.
    // The B1 bypass never engaged (it only repairs a failed parse),
    // and the flag then killed the preview twice: the dispatch sent
    // the ask to info mode, and suppressVisualEnrichment skipped
    // enrichLlmReply entirely, so 0 preview blocks were built. The
    // chip tap and a fresh typed ask send the same message text, so
    // both paths hit this same flag.
    for (const message of [
      "Tell me more about Palawan",
      "tell me more about palawan",
      "Tell me about Palawan",
    ]) {
      const resolved = resolveBeachAskIntent(message, INFO_PARSE_OK);
      expect(resolved.isBeachAsk).toBe(true);
      expect(resolved.isLocationInfoQuery).toBe(false);
      expect(resolved.allowBestEffortSuggestions).toBe(true);
      expect(resolved.shouldUseSafeNoIntentMode).toBe(false);
    }
  });

  it("a compare ask also clears isLocationInfoQuery", () => {
    const resolved = resolveBeachAskIntent(
      "Bali vs Maldives vs Palawan, which should I pick?",
      INFO_PARSE_OK,
    );
    expect(resolved.isBeachAsk).toBe(true);
    expect(resolved.isLocationInfoQuery).toBe(false);
    expect(resolved.allowBestEffortSuggestions).toBe(true);
  });

  it("a non-beach place-info question keeps the flag", () => {
    const resolved = resolveBeachAskIntent(
      "What are the hours of the Art Gallery of Ontario?",
      INFO_PARSE_OK,
    );
    expect(resolved.isBeachAsk).toBe(false);
    expect(resolved.isLocationInfoQuery).toBe(true);
    expect(resolved.allowBestEffortSuggestions).toBe(false);
  });

  it("a non-beach ask without the flag stays clear", () => {
    const resolved = resolveBeachAskIntent("hello there", OK_PARSE);
    expect(resolved.isLocationInfoQuery).toBe(false);
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

  it("a beach ask flagged as place-info drops the do-not-generate-cards line", () => {
    // The policy prompt is the third place the info flag bites: with
    // isLocationInfoQuery true it says "Do not generate option cards"
    // and withholds the visual format instruction, so the model
    // answers in prose. The route passes the beach-aware flag here,
    // so a tell-me-about ask must read as a suggestion turn.
    const resolved = resolveBeachAskIntent(
      "Tell me more about Palawan",
      INFO_PARSE_OK,
    );
    const sections = composePolicySections(
      buildContext({
        allowBestEffortSuggestions: resolved.allowBestEffortSuggestions,
        explicitSuggestionRequest: resolved.explicitSuggestionRequest,
        shouldUseSafeNoIntentMode: resolved.shouldUseSafeNoIntentMode,
        isLocationInfoQuery: resolved.isLocationInfoQuery,
      }),
    );
    const joined = sections.join("\n");
    expect(joined).not.toContain("Do not generate option cards");
    expect(joined).not.toContain("This is informational");
  });

  it("a genuine place-info question keeps the do-not-generate-cards line", () => {
    const sections = composePolicySections(
      buildContext({ isLocationInfoQuery: true }),
    );
    expect(sections.join("\n")).toContain("Do not generate option cards");
  });
});
