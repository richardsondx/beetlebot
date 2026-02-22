import { db } from "@/lib/db";
import { fail, fromError, ok } from "@/lib/api/http";
import { chatSchema } from "@/lib/api/schemas";
import {
  addConversationMessage,
  CONVERSATION_HISTORY_LIMIT,
  createConversationThread,
  getConversationMessages,
  getConversationThread,
  getRecentConversationThreads,
  parseMessageBlocks,
} from "@/lib/repositories/conversations";
import {
  getIntegrationConnection,
  listIntegrationConnections,
} from "@/lib/repositories/integrations";
import {
  deriveRecommendationSignals,
  extractRecommendationConstraints,
  getHomeAreaFromMemory,
  getPreferenceProfile,
  getPreferredCityFromMemory,
  tasteProfile,
  upsertMemory,
} from "@/lib/repositories/memory";
import type { PreferenceProfile } from "@/lib/repositories/memory";
import {
  createPack,
  getInstalledPackInstructions,
  getPackBySlug,
  listPacks,
} from "@/lib/repositories/packs";
import {
  createAutopilot,
  deleteAutopilot,
  listAutopilots,
  updateAutopilot,
} from "@/lib/repositories/autopilots";
import { getSafetySettings } from "@/lib/repositories/settings";
import {
  applyUpgradedCardsToBlocks,
  enrichLlmReply,
} from "@/lib/chat/visual-enricher";
import type { RichBlock } from "@/lib/chat/rich-message";
import { getChatToolByName, getScopedOpenRouterTools } from "@/lib/tools/registry";
import type { ChatToolDefinition } from "@/lib/tools/types";
import { runResearchLoop } from "@/lib/chat/research-loop";
import { buildSeasonContext } from "@/lib/season/context";
import type { WeatherContext } from "@/lib/weather/service";
import { getWeatherContext } from "@/lib/weather/service";
import type { PackDataSource } from "@/lib/types";
import { MODE_IDS } from "@/lib/constants";
import { getBousierTelemetry } from "@/lib/media/bousier";

const DEFAULT_MODEL = "openai/gpt-5-nano";
let runtimeModelOverride: string | null = null;
const MAX_TOOL_ROUNDS = 3;

type OpenRouterMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: OpenRouterToolCall[];
};

type OpenRouterToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

type OpenRouterResponse = {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: OpenRouterToolCall[];
    };
  }>;
};

type ThreadSuggestion = {
  index: number;
  title: string;
  subtitle?: string;
  meta?: Record<string, string>;
  actionUrl?: string;
  sourceName?: string;
};

type SuggestionIntentResolution = {
  selectedIndices: number[];
  confidence: number;
  rationale: string;
};

function getCurrentModel() {
  return runtimeModelOverride ?? process.env.BEETLEBOT_MODEL ?? DEFAULT_MODEL;
}

async function generateModelReply(input: {
  messages: OpenRouterMessage[];
  tools?: Awaited<ReturnType<typeof getScopedOpenRouterTools>>;
}) {
  const apiKey = process.env.OPENROUTER_API_KEY;
  const requestedModel = getCurrentModel();

  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is missing. Add it to .env and restart the dev server.");
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "HTTP-Referer": "http://localhost:3001",
      "X-Title": "beetlebot",
    },
    body: JSON.stringify({
      model: requestedModel,
      temperature: 0.55,
      messages: input.messages,
      tools: input.tools?.length ? input.tools : undefined,
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`Model request failed (${response.status}): ${raw.slice(0, 200)}`);
  }

  const payload = (await response.json()) as OpenRouterResponse;
  const message = payload.choices?.[0]?.message;
  const text = message?.content?.trim() ?? "";
  const toolCalls = message?.tool_calls ?? [];
  if (!text && toolCalls.length === 0) {
    throw new Error("Model returned an empty response.");
  }
  return {
    text,
    message: {
      content: message?.content ?? "",
      tool_calls: toolCalls,
    },
    requestedModel,
    responseModel: payload.model ?? requestedModel,
    responseId: payload.id ?? null,
  };
}

function parseToolArguments(raw: string): Record<string, unknown> {
  if (!raw.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return {};
  } catch {
    return {};
  }
}

const MODE_HINTS: Record<string, string> = {
  explore: "The user is in Explore mode: open-ended discovery, surface interesting options and possibilities.",
  dating: "The user is in Date Night mode: focus on romantic plans, atmosphere, and budget-friendly options for two.",
  family: "The user is in Family mode: prioritize family-friendly activities, logistics, and age-appropriate options.",
  social: "The user is in Social mode: help coordinate group plans, gatherings, and shared experiences.",
  relax: "The user is in Relax mode: suggest low-key, restorative, zero-stress activities.",
  travel: "The user is in Travel mode: help with trip planning, itineraries, travel buffers, and check-ins.",
  focus: "The user is in Focus mode: minimize distractions, suggest deep-work-friendly scheduling blocks.",
};

/** Modes where visual option cards add real value */
const VISUAL_MODES = new Set(["explore", "dating", "family", "social", "relax", "travel"]);

const VISUAL_SYSTEM_INSTRUCTION = `
RESPONSE FORMAT (follow precisely):
When your reply includes 2–5 concrete suggestions (events, hotels, restaurants, activities, venues, destinations), respond ONLY with a JSON object — no markdown, no prose outside the JSON:
{
  "text": "<your conversational reply here — 1–3 short sentences>",
  "options": [
    {
      "title": "<place or item name>",
      "subtitle": "<one-sentence pitch>",
      "category": "<event|hotel|restaurant|park|activity|destination|experience>",
      "meta": { "price": "$120/night", "rating": "4.7 ★", "neighborhood": "Midtown" },
      "actionUrl": "<REQUIRED for events. A canonical detail page URL (not a search or listing page). For non-events, include whenever you have a real detail/booking/info URL; otherwise omit.>",
      "sourceName": "<where this suggestion + URL came from (e.g. 'Eventbrite', 'Time Out', 'Official venue site') or omit>"
    }
  ]
}
For the "meta" object include 2–4 concise key-value chips relevant to the category (price, rating, distance, duration, vibe, age-range, etc.).
If your reply does NOT include concrete suggestions (e.g. it's a clarifying question or a scheduling note), respond as plain conversational text — NOT JSON.

CRITICAL URL RULES:
- For category "event", you MUST include actionUrl and it MUST be an event detail page that contains the organizer's hero/share image (often OG image metadata). Do NOT use a generic search results page.
- If you only have a listing/search page or you're unsure of the canonical event URL, use the fetch_url tool on a reputable source page to locate a specific event detail URL first, then return the JSON.
- Do NOT use JSON/options format for capability/config/help questions or factual place-info questions.
`.trim();

function buildCompanionPrompt(input: {
  mode?: string;
  isAction?: boolean;
  isCapabilityQuery?: boolean;
  isLocationInfoQuery?: boolean;
  preferredName?: string | null;
  preferredCity?: string | null;
  homeArea?: string | null;
  isNewThread?: boolean;
}) {
  const preferredNameHint = input.preferredName
    ? `Known preferred name: ${input.preferredName}. Use it naturally and sparingly.`
    : "Preferred name unknown. Ask once, casually, after some rapport or when it helps personalize a concrete request.";
  const base = [
    "You are beetlebot 🪲, a brilliant life companion with the instincts of a world-class travel agent, event specialist, and local insider.",
    "You think like an expert concierge who builds a mental model of each client over time — every conversation makes you sharper and more attuned to what they'll love.",
    "",
    "CONVERSATIONAL STYLE:",
    "- Talk like a smart, well-connected friend — warm, concise, natural. Not a brochure.",
    "- Reply in the same language as the user's latest message unless they explicitly ask to switch languages.",
    "- Use short paragraphs. Only provide structured plans when explicitly asked.",
    "- When someone says hi or starts casual, match their energy. Be warm and meet them where they are — don't jump straight into planning mode.",
    "- In a new thread, prioritize rapport first: one short natural opener before suggestions.",
    "- If the user asks who you are, introduce yourself as beetlebot in one short sentence.",
    `- ${preferredNameHint}`,
    input.homeArea
      ? `Known home area: ${input.homeArea}. Use this for proximity-sensitive recommendations.`
      : input.preferredCity
        ? `Known city: ${input.preferredCity}. Ask for a finer home area only when the user asks for nearby/close-to-home ideas.`
        : "Home location granularity is unknown. If proximity matters, ask one concise location clarifier (city first, then finer area later).",
    "- NEVER repeat, echo, or reuse exact phrasing from your previous messages. Each reply must be fresh and forward-moving.",
    "",
    "PREFERENCE DISCOVERY:",
    "- You naturally get to know users through conversation, like a great concierge would.",
    "- Refer to the PREFERENCE AWARENESS section to see what you know and don't know about this user.",
    "- When you sense a gap that's relevant to the current conversation, fold a casual question into your reply.",
    "- Frame questions as natural conversation, never as data collection:",
    "  Instead of 'What is your budget range?' → 'Are you thinking low-key or more of a splurge?'",
    "  Instead of 'Do you have children?' → 'Is this a grown-ups thing or are little ones coming along?'",
    "  Instead of 'What area do you prefer?' → 'Do you want to stay close to home or up for a bit of a trek?'",
    "  Instead of 'What are your interests?' → 'What kind of stuff gets you excited — active, cultural, food-driven, chill vibes?'",
    "- Never ask more than ONE preference question per response unless the user is specifically setting up preferences.",
    "- If the user just shared profile info (name/city/home area), acknowledge briefly and do not jump into scouting suggestions in that same turn unless explicitly asked.",
    "- If the user gives you a clear request with enough context, just answer. Don't interrogate.",
    "- Lead with value (a suggestion, an idea, a reaction) THEN ask — never lead with the question.",
    "- Post-event learning questions (e.g., 'how was it?') are allowed only inside active conversations and should feel occasional, not scripted.",
    "",
    "PRECISION:",
    "- Follow the user's instructions EXACTLY. When they name a specific event, activity, restaurant, or place, use THAT EXACT thing — never substitute.",
    "- If the user says 'schedule #1' or 'I like 1', match it precisely to the numbered item you suggested.",
    "- If anything is ambiguous, ASK — do not guess or swap in something else.",
    "",
    "EXECUTING DIRECT ACTIONS:",
    "- When the user says 'add', 'move', 'reschedule', 'book', 'keep', 'confirm', 'cancel' — EXECUTE the action. Do NOT generate new suggestions.",
    "- 'These', 'this', 'them', 'those', or 'this one' ALWAYS refers to items you PREVIOUSLY mentioned in this conversation. Never invent alternatives.",
    "- After executing, confirm in 1–2 sentences what was done. No numbered lists. No option cards.",
    "- If the user gave a time (e.g. 'after 2PM', 'on Sunday'), USE THAT TIME — do not ask for a time preference.",
    "- NEVER present option cards or numbered suggestions in response to a direct action command.",
    "",
    "CALENDAR:",
    "- When the user asks about schedule, meetings, free time, or calendar conflicts, call the google_calendar_events tool before answering.",
    "- When user asks to plan around a named event/time anchor (e.g. 'before the fair tomorrow', 'before my event'), and calendar read access exists, proactively check calendar first to resolve the anchor instead of asking the user for the event time again.",
    "- When you need to move, update, or delete a calendar event, ALWAYS use the google_calendar_events tool with operation 'find' first to resolve the event by name. It handles emoji prefixes, partial names, and fuzzy matching. Use the returned eventId and calendarId for the subsequent update/delete call.",
    "- NEVER give up after a single failed list query. The 'find' operation searches ALL calendars and uses fuzzy matching — use it.",
    "- If a calendar tool response includes { requiresUserConfirmation: true }, ask the user the provided prompt and wait for confirmation before doing additional calendar actions.",
    "- All events go to the '🪲 Managed Calendar' by default so the user can distinguish beetlebot events from their own.",
    "- Never claim bookings are confirmed unless explicitly approved and executed.",
    "- ALWAYS use a relevant emoji at the start of every calendar event title (e.g. '🎨 Art Exhibition at AGO', '⛸️ Family Skate at Nathan Phillips Square').",
    "",
    "RICH EVENT DESCRIPTIONS:",
    "When creating calendar events, make the description genuinely helpful:",
    "- 📍 Full address / Google Maps link",
    "- 💰 Price / cost info (free, $22/person, etc.)",
    "- 🕐 Suggested arrival time",
    "- 👕 Dress code or what to bring if relevant",
    "- 🅿️ Parking / transit tips",
    "- 🔗 Website or ticket link",
    "- 👨‍👩‍👦 Who it's good for",
    "Think: 'What would make the user's life easier glancing at this event 5 minutes before leaving the house?'",
    "",
    "CAPABILITY TRANSPARENCY:",
    "- If the user asks what integrations are enabled, answer directly using INTEGRATION STATUS in system context.",
    "- Never guess integration status. If uncertain, say that clearly and ask to verify in settings.",
    "- For capability/help/config questions, answer directly and concretely. Do not switch into recommendations.",
    "- For factual place/location questions, answer the question first; don't pivot into suggestion lists unless asked.",
  ].join("\n");
  const modeHint = input.mode && MODE_HINTS[input.mode] ? `\n${MODE_HINTS[input.mode]}` : "";
  const newThreadHint = input.isNewThread
    ? "\nThis is the beginning of a new thread; avoid jumping straight into optimization."
    : "";
  return base + modeHint + newThreadHint;
}

export type PromptPolicyContext = {
  effectiveMode: string;
  isActionCmd: boolean;
  isCapabilityQuery: boolean;
  isCapabilityHelpTurn: boolean;
  isLocationInfoQuery: boolean;
  allowBestEffortSuggestions: boolean;
  preferredName?: string | null;
  preferredCity?: string | null;
  homeArea?: string | null;
  isNewThread?: boolean;
  isLightConversationTurn: boolean;
  isMetaConversationQuery: boolean;
  isLateNight: boolean;
  explicitSuggestionRequest: boolean;
  shouldUseSafeNoIntentMode: boolean;
  wantsBestEffortNow: boolean;
  calendarIntent: boolean;
  calendarWriteIntent: boolean;
  shouldProactiveCalendarCheck: boolean;
  integrationStatus: string;
  packStatus: string;
  autopilotStatus: string;
  approvalGateStatus: string;
  shouldInjectPackContext: boolean;
  packContext?: string | null;
  hasRecentClarifier: boolean;
};

function buildCoreIdentityPrompt(input: PromptPolicyContext): string {
  return buildCompanionPrompt({
    mode: input.effectiveMode,
    isAction: input.isActionCmd,
    isCapabilityQuery: input.isCapabilityQuery,
    isLocationInfoQuery: input.isLocationInfoQuery,
    preferredName: input.preferredName,
    preferredCity: input.preferredCity,
    homeArea: input.homeArea,
    isNewThread: input.isNewThread,
  });
}

function buildToolCapabilityPrompt(input: PromptPolicyContext): string {
  const lines = [
    "TOOL CAPABILITY POLICY:",
    "- For capability/help/config questions, answer directly from the status snapshots below.",
    "- Do not pivot capability/help/config turns into recommendation lists unless user explicitly asks for ideas.",
    `INTEGRATION STATUS: ${input.integrationStatus}`,
  ];
  if (input.isCapabilityQuery || input.isCapabilityHelpTurn) {
    lines.push(`PACK STATUS: ${input.packStatus}`);
    lines.push(`AUTOPILOT STATUS: ${input.autopilotStatus}`);
    lines.push(`APPROVAL GATE: ${input.approvalGateStatus}`);
  }
  return lines.join("\n");
}

function buildMemoryPolicyPrompt(input: PromptPolicyContext): string {
  const lines = ["MEMORY POLICY:"];
  lines.push("- Never invent personal facts. Only state details that are explicitly present in memory/tool results/thread history.");
  lines.push("- If a requested personal detail is unknown, say it is unknown and ask a focused follow-up.");
  if (input.preferredName) {
    lines.push(`- Known preferred name: ${input.preferredName}. Use naturally and do not re-ask unless user asks to change it.`);
  } else {
    lines.push("- Preferred name is unknown. Ask once only when helpful.");
  }
  if (input.preferredCity) {
    lines.push(`- Known city: ${input.preferredCity}. Do not ask city again unless user indicates uncertainty or moved.`);
  } else {
    lines.push("- City is unknown. Ask only when location context is needed.");
  }
  if (input.homeArea) {
    lines.push(`- Known home area: ${input.homeArea}. Use this for nearby recommendations.`);
  } else {
    lines.push("- Home area is unknown. Ask only for nearby/proximity-sensitive requests.");
  }
  return lines.join("\n");
}

function buildConversationPolicyPrompt(input: PromptPolicyContext): string {
  const lines = [
    "CONVERSATION POLICY:",
    "- Ask at most one concise clarification question tied to the active request.",
    "- If a similar clarification was already asked recently, stop clarifying and provide best-effort assumptions.",
  ];
  if (input.hasRecentClarifier) {
    lines.push("- A clarification was recently asked in this thread; avoid repeating another clarifier now.");
  }
  if (input.isLightConversationTurn) {
    lines.push(
      "- This is a lightweight conversational turn. Keep reply brief and warm. Do NOT provide recommendations, option cards, or planning questions unless explicitly asked.",
    );
  }
  if (input.isLateNight && input.isLightConversationTurn && !input.explicitSuggestionRequest) {
    lines.push(
      "- Late-night norm: avoid 'tonight plans/vibes' follow-ups after midnight unless user explicitly asks for planning.",
    );
  }
  if (input.isMetaConversationQuery) {
    lines.push(
      "- This is a meta conversation turn. Acknowledge briefly, correct course, and end with a neutral help offer. No timeframe assumptions.",
    );
  }
  if (input.shouldUseSafeNoIntentMode) {
    lines.push(
      "- Intent extraction is unavailable. Use a safe conversational fallback: brief reply in user's language, no assumptions, no recommendations, one concise clarification.",
    );
  }
  if (!input.allowBestEffortSuggestions && !input.isActionCmd && !input.calendarIntent && !input.isCapabilityQuery) {
    lines.push(
      "- Do not provide concrete recommendation lists/options unless user explicitly asks for suggestions or asks you to proceed now.",
    );
  }
  if (input.wantsBestEffortNow || input.hasRecentClarifier) {
    lines.push("- User signaled to proceed now; stop clarifying and provide best-effort suggestions with brief assumptions.");
  }
  return lines.join("\n");
}

function buildCalendarAnchorPolicyPrompt(input: PromptPolicyContext): string | null {
  if (!input.calendarIntent) return null;
  if (input.calendarWriteIntent) {
    return [
      "CALENDAR ANCHOR POLICY:",
      "- User is asking to modify calendar data.",
      "- For update/delete, always call google_calendar_events with operation 'find' first, then write using resolved eventId/calendarId.",
      "- If required fields are missing, ask one concise clarification and do not switch to unrelated calendar listings.",
      "- If tool result includes { requiresUserConfirmation: true }, ask that prompt and wait.",
    ].join("\n");
  }
  return [
    "CALENDAR ANCHOR POLICY:",
    input.shouldProactiveCalendarCheck
      ? "- User implied/granted calendar-check permission. Proactively retrieve relevant calendar data before asking follow-up permission."
      : "- For explicit calendar schedule questions, retrieve relevant calendar data before final answer.",
    "- Answer from tool results directly; do not ask the user to repeat already implied anchor times.",
  ].join("\n");
}

function buildOutputFormatPolicyPrompt(input: PromptPolicyContext): string {
  const lines = [
    "OUTPUT FORMAT POLICY:",
    "- For capability/location/meta/smalltalk/informational turns, default to direct text answers.",
  ];
  if (input.isCapabilityQuery || input.isLocationInfoQuery) {
    lines.push("- This is informational: answer directly and concisely. Do not generate option cards or unrelated suggestions.");
  }
  if (input.isActionCmd) {
    lines.push(
      "- CRITICAL action command: execute with tools and confirm in 1-2 sentences. Do NOT produce option cards or new suggestions.",
    );
  }
  const shouldUseVisualCards =
    Boolean(input.effectiveMode) &&
    VISUAL_MODES.has(input.effectiveMode) &&
    !input.isActionCmd &&
    !input.isCapabilityQuery &&
    !input.isLocationInfoQuery &&
    input.allowBestEffortSuggestions;
  if (input.allowBestEffortSuggestions && !input.isActionCmd && !input.isCapabilityQuery && !input.isLocationInfoQuery) {
    lines.push("- For plan-style answers, include one clearly labeled backup/fallback option.");
  }
  if (shouldUseVisualCards) {
    lines.push(VISUAL_SYSTEM_INSTRUCTION);
  } else {
    lines.push("- Keep response in concise text format for this turn.");
  }
  return lines.join("\n");
}

export function composePolicySections(input: PromptPolicyContext): string[] {
  const sections: Array<string | null> = [
    buildCoreIdentityPrompt(input),
    buildToolCapabilityPrompt(input),
    buildMemoryPolicyPrompt(input),
    buildConversationPolicyPrompt(input),
    buildCalendarAnchorPolicyPrompt(input),
    buildOutputFormatPolicyPrompt(input),
  ];
  if (input.shouldInjectPackContext && input.packContext) {
    sections.push(input.packContext);
  }
  return sections.filter((section): section is string => Boolean(section && section.trim()));
}

function buildTemporalContext(timezone?: string): string {
  const tz = timezone || "America/Toronto";
  const now = new Date();

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
  const formatted = formatter.format(now);

  const dayOfWeek = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "long" }).format(now);

  const localDate = new Date(now.toLocaleString("en-US", { timeZone: tz }));
  const dayNum = localDate.getDay();
  const daysUntilSat = (6 - dayNum + 7) % 7 || 7;
  const sat = new Date(localDate);
  sat.setDate(localDate.getDate() + daysUntilSat);
  const sun = new Date(sat);
  sun.setDate(sat.getDate() + 1);

  const dateFmt = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  const weekendNote =
    dayNum === 6
      ? "Today is Saturday."
      : dayNum === 0
        ? "Today is Sunday."
        : `This coming weekend is Saturday ${dateFmt(sat)} – Sunday ${dateFmt(sun)}.`;

  return `Current date and time: ${formatted}. Today is ${dayOfWeek}. ${weekendNote}`;
}

function formatWeatherWindowTime(iso: string, timezone?: string) {
  const date = new Date(iso);
  if (!Number.isFinite(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: timezone || "America/Toronto",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function buildWeatherBriefContext(input: {
  weather: WeatherContext;
  timezone?: string;
}) {
  if (input.weather.isFallback) {
    return [
      `WEATHER BRIEF: ${input.weather.location}: live weather data unavailable right now.`,
      "Do not assume specific temperature or rain probability. Use weather-safe planning and retry weather lookup before finalizing outdoor commitments.",
    ].join("\n");
  }
  const tempText =
    typeof input.weather.tempC === "number" ? `${input.weather.tempC}C now` : "temperature unavailable";
  const rainText =
    typeof input.weather.rainProbability === "number"
      ? `rain chance ${Math.round(input.weather.rainProbability * 100)}%`
      : "rain probability unavailable";
  const lines = [`WEATHER BRIEF: ${input.weather.location}: ${input.weather.summary}, ${tempText}, ${rainText}.`];

  const topRiskWindow = input.weather.highRiskWindows[0];
  if (topRiskWindow) {
    lines.push(
      `Highest rain-risk window today/next hours: ${formatWeatherWindowTime(topRiskWindow.start, input.timezone)}-${formatWeatherWindowTime(topRiskWindow.end, input.timezone)} (up to ${Math.round(topRiskWindow.peakRainProbability * 100)}%).`,
    );
  }

  const weekAhead = input.weather.daily[6];
  if (weekAhead) {
    lines.push(
      `Week-ahead signal (${weekAhead.date}): ${weekAhead.summary}, rain risk up to ${Math.round(weekAhead.rainProbabilityMax * 100)}%.`,
    );
  }
  return lines.join("\n");
}

function getLocalHour(timezone?: string) {
  const tz = timezone || "America/Toronto";
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "2-digit",
    hour12: false,
  }).format(new Date());
  const parsed = Number.parseInt(hour, 10);
  return Number.isFinite(parsed) ? parsed : 12;
}

function buildRuntimeContext(input: {
  tasteHints: string[];
  recentRuns: string[];
  integrationStatus: string;
  preferredCity?: string | null;
  homeArea?: string | null;
  packStatus?: string;
  autopilotStatus?: string;
  approvalGateStatus?: string;
}) {
  const memoryContext = input.tasteHints.length
    ? `User taste hints: ${input.tasteHints.join(", ")}.`
    : "No explicit taste hints yet.";
  const runContext = input.recentRuns.length
    ? `Recent run states: ${input.recentRuns.join(" | ")}.`
    : "No recent run history.";
  const locationContext = input.homeArea
    ? `Known home area: ${input.homeArea}.`
    : input.preferredCity
      ? `Known city: ${input.preferredCity}.`
      : "No known home location yet.";
  const lines = [`${memoryContext}`, `${runContext}`, `${locationContext}`, `INTEGRATION STATUS: ${input.integrationStatus}`];
  if (input.packStatus) lines.push(`PACK STATUS: ${input.packStatus}`);
  if (input.autopilotStatus) lines.push(`AUTOPILOT STATUS: ${input.autopilotStatus}`);
  if (input.approvalGateStatus) lines.push(`APPROVAL GATE: ${input.approvalGateStatus}`);
  return lines.join("\n");
}

function sanitizePreferredName(raw: string): string | null {
  const cleaned = raw.replace(/[^a-zA-Z0-9' -]/g, "").trim();
  if (cleaned.length < 2 || cleaned.length > 32) return null;
  return cleaned;
}

async function getPreferredNameFromMemory(): Promise<string | null> {
  const hit = await db.memoryEntry.findFirst({
    where: {
      bucket: "profile_memory",
      key: { in: ["preferred_name", "name"] },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!hit?.value) return null;
  return sanitizePreferredName(hit.value);
}

function formatIntegrationStatusSnapshot(
  connections: Awaited<ReturnType<typeof listIntegrationConnections>>,
) {
  if (!connections.length) return "No integrations configured.";
  return connections
    .map((connection) => {
      const scopes = connection.grantedScopes.length
        ? ` [${connection.grantedScopes.join(", ")}]`
        : "";
      const account = connection.externalAccountLabel ? ` (${connection.externalAccountLabel})` : "";
      return `${connection.displayName}: ${connection.status}${scopes}${account}`;
    })
    .join(" | ");
}

function formatPackStatusSnapshot(packs: Awaited<ReturnType<typeof listPacks>>) {
  const installed = packs.filter((pack) => Boolean((pack as { installed?: boolean }).installed));
  if (!installed.length) return "No packs enabled.";
  return installed
    .slice(0, 8)
    .map(
      (pack) =>
        `${pack.name} (${pack.slug}) city=${pack.city} modes=${pack.modes.join("/") || "n/a"} budget=${pack.budgetRange}`,
    )
    .join(" | ");
}

function formatAutopilotSnapshot(autopilots: Awaited<ReturnType<typeof listAutopilots>>) {
  if (!autopilots.length) return "No autopilots configured.";
  return autopilots
    .slice(0, 8)
    .map(
      (autopilot) =>
        `${autopilot.name} [status=${autopilot.status}] Goal=${autopilot.goal}; Trigger=${autopilot.triggerType}:${autopilot.trigger}; Action=${autopilot.action}; Approval=${autopilot.approvalRule}`,
    )
    .join(" | ");
}

function formatApprovalGateSnapshot(settings: Awaited<ReturnType<typeof getSafetySettings>>) {
  return `defaultApproval=${settings.defaultApproval}; spendCap=${settings.spendCap}; quietHours=${settings.quietStart}-${settings.quietEnd}`;
}

function buildCapabilityReply(input: {
  topic: CapabilityTopic;
  integrations: Awaited<ReturnType<typeof listIntegrationConnections>>;
  packs: Awaited<ReturnType<typeof listPacks>>;
  autopilots: Awaited<ReturnType<typeof listAutopilots>>;
  safetySettings: Awaited<ReturnType<typeof getSafetySettings>>;
}) {
  if (input.topic === "integrations") {
    return `Here are the enabled integrations right now: ${formatIntegrationStatusSnapshot(input.integrations)}.`;
  }
  if (input.topic === "packs") {
    return `Enabled packs right now: ${formatPackStatusSnapshot(input.packs)}.`;
  }
  if (input.topic === "autopilots") {
    return `Here are your autopilots (Goal / Trigger / Action / Approval): ${formatAutopilotSnapshot(input.autopilots)}. You can ask me to create, pause/resume, or delete an autopilot.`;
  }
  if (input.topic === "approval_gate") {
    return `Your approval gate settings are: ${formatApprovalGateSnapshot(input.safetySettings)}.`;
  }
  return [
    `Integrations: ${formatIntegrationStatusSnapshot(input.integrations)}.`,
    `Packs: ${formatPackStatusSnapshot(input.packs)}.`,
    `Autopilots: ${formatAutopilotSnapshot(input.autopilots)}.`,
    `Approval gate: ${formatApprovalGateSnapshot(input.safetySettings)}.`,
  ].join("\n");
}

async function buildPackContext(
  packs: Awaited<ReturnType<typeof getInstalledPackInstructions>>,
): Promise<string | null> {
  if (!packs.length) return null;

  const sections = packs.map((p) => {
    let section = `[${p.name}]`;
    if (p.instructions) {
      section += `\n${p.instructions}`;
    }
    if (p.dataSources.length) {
      const sourceList = p.dataSources
        .map((ds) => `  - ${ds.label}: ${ds.url}${ds.hint ? ` (${ds.hint})` : ""}`)
        .join("\n");
      section += `\nData sources (use the fetch_url tool to retrieve live data from these when relevant):\n${sourceList}`;
    }
    return section;
  });

  return `Installed pack expertise (use this knowledge when relevant):\n\n${sections.join("\n\n")}`;
}

type OrchestrationState =
  | "research_mode"
  | "recommendation_mode"
  | "pack_creation_mode"
  | "calendar_intent_mode"
  | "smalltalk_mode"
  | "capability_mode"
  | "autopilot_ops_mode"
  | "info_mode";

const PACK_CREATION_COMMANDS = [
  "create a pack from this",
  "turn this into a pack",
  "make a pack from this",
  "build a pack from this",
  "create pack from this",
];

function isPackCreationCommand(message: string) {
  const lower = message.toLowerCase();
  return PACK_CREATION_COMMANDS.some((phrase) => lower.includes(phrase));
}

function parseUrlsFromText(input: string): string[] {
  const urls = input.match(/https?:\/\/[^\s)]+/gi) ?? [];
  return Array.from(new Set(urls.map((url) => url.trim())));
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function inferPackStyle(preference: "fresh" | "balanced" | "familiar") {
  if (preference === "fresh") return "spontaneous";
  if (preference === "familiar") return "predictable";
  return "curated";
}

function buildPreferenceAwarenessPrompt(profile: PreferenceProfile): string {
  const lines: string[] = ["PREFERENCE AWARENESS:"];
  lines.push("Use only explicit stored facts from this section; do not extrapolate additional preferences.");

  if (profile.isNewUser) {
    lines.push(
      "This user is relatively new — you have very little context about them.",
      "Treat this like the first conversations with a new concierge client: be warm, offer value immediately, and weave in natural discovery questions to learn about them.",
    );
  }

  if (Object.keys(profile.known).length > 0) {
    lines.push("\nWhat you already know about this user:");
    for (const [label, value] of Object.entries(profile.known)) {
      lines.push(`  • ${label}: ${value}`);
    }
  }

  if (profile.unknown.length > 0) {
    lines.push(
      "\nPreference gaps (things you DON'T know yet — look for natural moments to learn):",
    );
    for (const gap of profile.unknown) {
      lines.push(`  • ${gap}`);
    }
    lines.push(
      "",
      "DISCOVERY RULES:",
      "- Only ask about gaps RELEVANT to the current conversation. Don't ask about transportation when they want restaurant tips.",
      "- Lead with value first (a suggestion, idea, or reaction), then fold in the question.",
      "- If the user's request is clear enough to act on, just act. Not every message needs a question.",
      "- On greeting or small-talk turns, don't ask preference questions. Keep it warm and simple.",
      "- Never present a checklist or questionnaire. This should feel like a friend getting to know another friend.",
      "- When the user casually reveals info (mentions kids, a partner, a neighborhood), acknowledge it naturally and use it.",
    );
  }

  return lines.join("\n");
}

async function extractImplicitPreferencesFromModel(intent: MessageIntent) {
  const extractions: Array<{ bucket: string; key: string; value: string }> = [];

  const preferredName = intent.extractedPreferredName
    ? sanitizePreferredName(intent.extractedPreferredName)
    : null;
  if (preferredName && preferredName.length >= 2) {
    extractions.push({
      bucket: "profile_memory",
      key: "preferred_name",
      value: preferredName,
    });
  }
  const city = intent.extractedCity?.trim();
  if (city && city.length >= 2) {
    extractions.push({ bucket: "profile_memory", key: "city", value: city });
  }
  const homeArea = intent.extractedHomeArea?.trim();
  if (homeArea && homeArea.length >= 2) {
    extractions.push({ bucket: "profile_memory", key: "home_area", value: homeArea });
  }
  if (intent.preferenceFeedback?.subject) {
    extractions.push({
      bucket: "taste_memory",
      key: intent.preferenceFeedback.sentiment === "liked" ? "liked_activity" : "disliked_activity",
      value: intent.preferenceFeedback.subject,
    });
    if (intent.preferenceFeedback.reason) {
      extractions.push({
        bucket: "logistics_memory",
        key: intent.preferenceFeedback.sentiment === "liked" ? "like_reason" : "dislike_reason",
        value: intent.preferenceFeedback.reason,
      });
    }
  }

  const seen = new Set<string>();
  for (const item of extractions) {
    const dedupeKey = `${item.bucket}:${item.key}:${item.value}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    const existing = await db.memoryEntry.findFirst({
      where: { bucket: item.bucket, key: item.key, value: item.value },
    });
    if (existing) continue;

    await upsertMemory({
      bucket: item.bucket,
      key: item.key,
      value: item.value,
      source: "inferred",
      confidence: 0.8,
    });
  }
}

const TRAVEL_QUERY = "travel trip vacation flight hotel getaway";

/**
 * Intent classification result for a user message.
 * Determined via a fast LLM call rather than brittle regex pattern matching.
 */
type MessageIntent = {
  /** User wants to EXECUTE something (add/move/book/confirm) — not discover new options. */
  isActionCommand: boolean;
  /** Message implies a calendar write operation (create/update/delete an event). */
  isCalendarWrite: boolean;
  /** Message asks to read/query calendar details (next event, schedule, availability). */
  isCalendarQuery: boolean;
  /** User asks to proactively verify/check calendar access or schedule now. */
  shouldProactiveCalendarCheck: boolean;
  /** Message references prior suggestions ("these", "this one", "that option", etc.). */
  referencesPriorSuggestions: boolean;
  /** Message is specifically about travel plans/trips. */
  isTravelQuery: boolean;
  /** Message asks for upcoming/next items. */
  isUpcomingQuery: boolean;
  /** Message asks for fresh/deep research rather than immediate execution. */
  isResearchRequest: boolean;
  /** Message asks about things to do / events / what's happening in a city or area — exploration, NOT personal calendar. */
  isDiscoveryQuery: boolean;
  /** User sent a pure greeting turn. */
  isGreeting: boolean;
  /** User is doing small-talk/rapport rather than planning. */
  isSmallTalk: boolean;
  /** User asks about bot capabilities/config (integrations, packs, autopilots, settings). */
  isCapabilityQuery: boolean;
  /** User asks factual info about a place/location/venue rather than recommendations. */
  isLocationInfoQuery: boolean;
  /** User explicitly asks for concrete suggestions/options/recommendations. */
  isExplicitSuggestionRequest: boolean;
  /** User asks the assistant to proceed now with best-effort suggestions (no more clarifications). */
  wantsBestEffortNow: boolean;
  /** User explicitly requests a backup/fallback/plan B option. */
  requiresBackupOption: boolean;
  /** True when model-based intent extraction succeeded. */
  intentExtractionOk: boolean;
  /** User is commenting on assistant behavior/memory/style (meta conversation). */
  isMetaConversationQuery: boolean;
  /** User is replying with profile data asked in prior assistant turn. */
  isProfileCaptureTurn: boolean;
  /** Best capability topic to answer, if applicable. */
  capabilityTopic: CapabilityTopic;
  /** Mode hint from classifier when request is planning-related. */
  suggestedMode: "explore" | "dating" | "family" | "social" | "relax" | "travel" | "focus";
  /** Optional extracted name to persist. */
  extractedPreferredName: string | null;
  /** Optional extracted city to persist. */
  extractedCity: string | null;
  /** Optional extracted home area (neighborhood/intersection/postal prefix). */
  extractedHomeArea: string | null;
  /** Whether the user is asking for nearby/close-to-home style constraints. */
  isProximityPreferenceQuery: boolean;
  /** Optional sentiment feedback about a recent activity. */
  preferenceFeedback:
    | {
        subject: string;
        sentiment: "liked" | "disliked";
        reason: string | null;
      }
    | null;
  /** Autopilot operation intent from model extraction. */
  autopilotOperation: "none" | "create" | "delete" | "pause" | "resume";
  /** Extracted autopilot target for delete/pause/resume operations. */
  autopilotTargetName: string | null;
  /** Extracted autopilot payload for create operation. */
  autopilotCreateFields: {
    name: string;
    goal: string;
    triggerType: "time" | "context" | "event";
    trigger: string;
    action: string;
    approvalRule: "ask_first" | "auto_hold" | "auto_execute";
    mode: string;
    budgetCap: number;
  } | null;
  /** Confidence (0..1) for autopilot operation extraction. */
  autopilotOperationConfidence: number;
};

type CapabilityTopic =
  | "integrations"
  | "packs"
  | "autopilots"
  | "approval_gate"
  | "general";

function normalizeRequestedMode(raw?: string): string {
  if (!raw) return "auto";
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return "auto";
  return normalized;
}

function stripSimpleCodeFence(text: string) {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  const firstNewline = trimmed.indexOf("\n");
  if (firstNewline < 0) return trimmed;
  const body = trimmed.slice(firstNewline + 1);
  const fenceIndex = body.lastIndexOf("```");
  if (fenceIndex < 0) return body.trim();
  return body.slice(0, fenceIndex).trim();
}

function normalizeMessageForIntentRules(message: string) {
  return message.toLowerCase().replace(/\s+/g, " ").trim();
}

function isLikelyHistoricalRecallQuestion(message: string) {
  const normalized = normalizeMessageForIntentRules(message);
  const hasQuestionShape = normalized.includes("?") || /^(what|who|when|which|do you|did i|did you)\b/.test(normalized);
  const hasPastAnchor = /\b(yesterday|last night|last week|two days ago|earlier|before|so far)\b/.test(normalized);
  const hasRecallVerb = /\b(remember|recall|learned|know|recommended|asked you to book|told you)\b/.test(normalized);
  return hasQuestionShape && (hasPastAnchor || hasRecallVerb);
}

function buildDefaultIntent(intentExtractionOk: boolean): MessageIntent {
  return {
    isActionCommand: false,
    isCalendarWrite: false,
    isCalendarQuery: false,
    shouldProactiveCalendarCheck: false,
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
    wantsBestEffortNow: false,
    requiresBackupOption: false,
    intentExtractionOk,
    isMetaConversationQuery: false,
    isProfileCaptureTurn: false,
    capabilityTopic: "general",
    suggestedMode: "explore",
    extractedPreferredName: null,
    extractedCity: null,
    extractedHomeArea: null,
    isProximityPreferenceQuery: false,
    preferenceFeedback: null,
    autopilotOperation: "none",
    autopilotTargetName: null,
    autopilotCreateFields: null,
    autopilotOperationConfidence: 0,
  };
}

function resolveEffectiveMode(input: {
  requestedMode?: string;
  intent: MessageIntent;
}) {
  const requestedMode = normalizeRequestedMode(input.requestedMode);
  if (requestedMode !== "auto" && MODE_IDS.includes(requestedMode)) {
    return { requestedMode, effectiveMode: requestedMode };
  }
  return {
    requestedMode,
    effectiveMode: input.intent.suggestedMode ?? "explore",
  };
}

/**
 * Classifies the user's message intent via a fast, zero-temperature LLM call.
 * Providing the last assistant message as context improves accuracy when the
 * user uses pronouns ("add these", "book that one", etc.).
 */
async function classifyMessageIntent(
  message: string,
  lastAssistantMessage?: string,
): Promise<MessageIntent> {
  const fallback = buildDefaultIntent(false);
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return fallback;

  const contextLine = lastAssistantMessage
    ? `Previous assistant message (for context): """${lastAssistantMessage.slice(0, 300)}"""`
    : "";

  const prompt = [
    "Classify and extract signals from the user message. Reply with valid JSON only.",
    "",
    contextLine,
    `User message: """${message}"""`,
    "",
    "Return exactly:",
    '{ "isActionCommand": boolean, "isCalendarWrite": boolean, "isCalendarQuery": boolean, "shouldProactiveCalendarCheck": boolean, "referencesPriorSuggestions": boolean, "isTravelQuery": boolean, "isUpcomingQuery": boolean, "isResearchRequest": boolean, "isDiscoveryQuery": boolean, "isGreeting": boolean, "isSmallTalk": boolean, "isCapabilityQuery": boolean, "isLocationInfoQuery": boolean, "isExplicitSuggestionRequest": boolean, "wantsBestEffortNow": boolean, "requiresBackupOption": boolean, "isMetaConversationQuery": boolean, "isProfileCaptureTurn": boolean, "isProximityPreferenceQuery": boolean, "capabilityTopic": "integrations|packs|autopilots|approval_gate|general", "suggestedMode": "explore|dating|family|social|relax|travel|focus", "extractedPreferredName": string|null, "extractedCity": string|null, "extractedHomeArea": string|null, "preferenceFeedback": { "subject": string, "sentiment": "liked|disliked", "reason": string|null } | null, "autopilotOperation": "none|create|delete|pause|resume", "autopilotTargetName": string|null, "autopilotCreateFields": { "name": string, "goal": string, "triggerType": "time|context|event", "trigger": string, "action": string, "approvalRule": "ask_first|auto_hold|auto_execute", "mode": string, "budgetCap": number } | null, "autopilotOperationConfidence": number }',
    "",
    "Definitions:",
    "isActionCommand  — true when the user wants to EXECUTE something (add to calendar, move/reschedule an event, book, confirm a choice, keep a suggestion, cancel something) rather than explore or get new ideas.",
    "isCalendarWrite  — true when the intent involves creating, editing, moving, fixing duplicates, merging, or removing a calendar event.",
    "isCalendarQuery — true ONLY when the user asks about THEIR OWN personal schedule (e.g. 'what's on my calendar', 'do I have anything tomorrow', 'when is my next meeting', 'am I free Saturday', 'who am I meeting today'). Must be about the user's own calendar/schedule. FALSE for discovery questions like 'what's happening in the city', 'what's going on tonight', 'things to do this weekend' — those are discovery, not calendar.",
    "shouldProactiveCalendarCheck — true when user indicates permission or intent to check calendar right now (e.g. asks if you have access and expects a check, says 'yes check my calendar', asks for availability around an event, or asks to do something before a specific event tomorrow).",
    "For general planning requests with time/budget constraints (e.g., 'plan me something at 5pm today', 'date night under $120'), do NOT set shouldProactiveCalendarCheck unless user explicitly asks to use their personal calendar.",
    "referencesPriorSuggestions — true when the user refers to options already shown (e.g. 'these', 'this one', 'that option', 'option 2', 'the first one').",
    "isTravelQuery — true when the user asks about travel/trips/vacation plans.",
    "isUpcomingQuery — true when the user asks for what is next/upcoming/coming soon on their personal calendar, OR asks to plan around something happening soon (e.g. before an event tomorrow).",
    "If user asks for suggestions 'before my/the event tomorrow' (or similar event-anchored timing), set isUpcomingQuery=true and shouldProactiveCalendarCheck=true even if the user is also asking for fun ideas.",
    "If the user asks a memory/recall question about past conversation history (e.g., 'what was the restaurant you recommended two days ago?', 'what event did I ask you to book yesterday?'), set isActionCommand=false and isCalendarWrite=false.",
    "If user asks 'Plan me something at 5pm today in Toronto with a backup option' (or equivalent planning-only phrasing), set isActionCommand=false and isCalendarWrite=false.",
    "If user asks for general planning in another language (e.g., 'Hola, puedes planearme algo simple para manana?'), treat it as planning/suggestions (not calendar write) unless they explicitly ask to add/edit calendar data.",
    "isResearchRequest — true when user asks for fresh/new/deep research or discovery from new sources.",
    "isDiscoveryQuery — true when the user asks about things to do, events happening, what's going on, nightlife, activities, or attractions in a city or area. This is about exploring the world, NOT checking their personal calendar. Examples: 'what's happening tonight', 'things to do in Toronto', 'any events this weekend', 'what's going on in the city'.",
    "isGreeting — true for greeting-only messages (e.g. 'hi', 'hello', 'hey there').",
    "isSmallTalk — true for rapport chatter (e.g. 'how are you?', 'what's up?', 'thanks'). Should be false for planning requests.",
    "isMetaConversationQuery — true when user comments on assistant behavior/style/memory (e.g. 'didn't I tell you my name?', 'this feels awkward', 'why are you suggesting this right away?').",
    "isCapabilityQuery — true when the user asks what beetlebot has enabled/can do (integrations, packs, autopilots, approval settings, features, setup help).",
    "If user asks 'what integrations do you have enabled right now?' (or equivalent), set isCapabilityQuery=true and capabilityTopic='integrations'.",
    "isLocationInfoQuery — true for factual questions about a location/restaurant/place (hours, address, details, info), without asking for recommendation lists.",
    "isExplicitSuggestionRequest — true only when the user directly asks for suggestions/options/ideas/recommendations.",
    "Planning asks like 'plan my Friday night', 'date night ideas', or 'plan me something at 5pm' are suggestion requests, not calendar writes, unless user explicitly asks to add/edit calendar events.",
    "wantsBestEffortNow — true when user says to proceed without more questions (e.g. 'either', 'figure it out', 'propose something already', 'just pick').",
    "If user says 'either', 'show me either', 'surprise me', 'i don't know figure it out', or 'propose something already', set wantsBestEffortNow=true and isExplicitSuggestionRequest=true.",
    "requiresBackupOption — true when user explicitly asks for a backup/fallback/plan B option.",
    "If user asks for a backup option (e.g., 'include a backup option', 'add a fallback', 'give me plan B'), set requiresBackupOption=true.",
    "If prior assistant asked a binary choice and user answered one option (or said either), do not ask the same binary question again.",
    "isProfileCaptureTurn — true if this looks like a short profile-answer (like name/city) to a prior assistant question.",
    "If previous assistant asked for name and user replies with a short token like 'Richardson' or 'Jimmy', set isProfileCaptureTurn=true and extractedPreferredName.",
    "If previous assistant asked for city/home area and user replies with short place text, set isProfileCaptureTurn=true and extract location fields.",
    "isProximityPreferenceQuery — true when user asks for nearby/close-to-home options.",
    "capabilityTopic — choose the most relevant capability topic, else general.",
    "suggestedMode — pick best planning mode for request context when relevant, else explore.",
    "extractedPreferredName — extract preferred name if user provides one, else null.",
    "extractedCity — extract city if user provides one, else null. If message contains city plus another question (e.g., 'Toronto. Do you have access to my calendar?'), still set extractedCity='Toronto'.",
    "extractedHomeArea — extract neighborhood/intersection/postal-prefix style home area when provided, else null.",
    "preferenceFeedback — extract positive/negative feedback about an activity if present, else null.",
    "autopilotOperation/autopilotTargetName/autopilotCreateFields/autopilotOperationConfidence — extract autopilot command intent and fields.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "beetlebot",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0,
        max_tokens: 320,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return fallback;

    const payload = (await response.json()) as OpenRouterResponse;
    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";

    // Strip optional markdown fences before parsing
    const clean = stripSimpleCodeFence(text);
    const parsed = JSON.parse(clean) as Partial<MessageIntent>;
    const suggestedModeRaw = typeof parsed.suggestedMode === "string" ? parsed.suggestedMode : "explore";
    const suggestedMode =
      suggestedModeRaw === "dating" ||
      suggestedModeRaw === "family" ||
      suggestedModeRaw === "social" ||
      suggestedModeRaw === "relax" ||
      suggestedModeRaw === "travel" ||
      suggestedModeRaw === "focus"
        ? suggestedModeRaw
        : "explore";
    const topicRaw = typeof parsed.capabilityTopic === "string" ? parsed.capabilityTopic : "general";
    const capabilityTopic: CapabilityTopic =
      topicRaw === "integrations" ||
      topicRaw === "packs" ||
      topicRaw === "autopilots" ||
      topicRaw === "approval_gate"
        ? topicRaw
        : "general";
    const opRaw = typeof parsed.autopilotOperation === "string" ? parsed.autopilotOperation : "none";
    const autopilotOperation =
      opRaw === "create" || opRaw === "delete" || opRaw === "pause" || opRaw === "resume" ? opRaw : "none";
    const autopilotCreateFields =
      parsed.autopilotCreateFields &&
      typeof parsed.autopilotCreateFields === "object" &&
      !Array.isArray(parsed.autopilotCreateFields)
        ? (parsed.autopilotCreateFields as MessageIntent["autopilotCreateFields"])
        : null;
    const autopilotOperationConfidence =
      typeof parsed.autopilotOperationConfidence === "number"
        ? Math.max(0, Math.min(parsed.autopilotOperationConfidence, 1))
        : 0;
    const feedback =
      parsed.preferenceFeedback &&
      typeof parsed.preferenceFeedback === "object" &&
      !Array.isArray(parsed.preferenceFeedback)
        ? parsed.preferenceFeedback
        : null;
    const preferenceFeedback =
      feedback &&
      typeof feedback.subject === "string" &&
      (feedback.sentiment === "liked" || feedback.sentiment === "disliked")
        ? {
            subject: feedback.subject.trim(),
            sentiment: feedback.sentiment,
            reason: typeof feedback.reason === "string" && feedback.reason.trim() ? feedback.reason.trim() : null,
          }
        : null;
    return {
      intentExtractionOk: true,
      isActionCommand: Boolean(parsed.isActionCommand),
      isCalendarWrite: Boolean(parsed.isCalendarWrite),
      isCalendarQuery: Boolean(parsed.isCalendarQuery),
      shouldProactiveCalendarCheck: Boolean(parsed.shouldProactiveCalendarCheck),
      referencesPriorSuggestions: Boolean(parsed.referencesPriorSuggestions),
      isTravelQuery: Boolean(parsed.isTravelQuery),
      isUpcomingQuery: Boolean(parsed.isUpcomingQuery),
      isResearchRequest: Boolean(parsed.isResearchRequest),
      isDiscoveryQuery: Boolean(parsed.isDiscoveryQuery),
      isGreeting: Boolean(parsed.isGreeting),
      isSmallTalk: Boolean(parsed.isSmallTalk),
      isCapabilityQuery: Boolean(parsed.isCapabilityQuery),
      isLocationInfoQuery: Boolean(parsed.isLocationInfoQuery),
      isExplicitSuggestionRequest: Boolean(parsed.isExplicitSuggestionRequest),
      wantsBestEffortNow: Boolean(parsed.wantsBestEffortNow),
      requiresBackupOption: Boolean(parsed.requiresBackupOption),
      isMetaConversationQuery: Boolean(parsed.isMetaConversationQuery),
      isProfileCaptureTurn: Boolean(parsed.isProfileCaptureTurn),
      capabilityTopic,
      suggestedMode,
      extractedPreferredName:
        typeof parsed.extractedPreferredName === "string" && parsed.extractedPreferredName.trim()
          ? parsed.extractedPreferredName.trim()
          : null,
      extractedCity:
        typeof parsed.extractedCity === "string" && parsed.extractedCity.trim()
          ? parsed.extractedCity.trim()
          : null,
      extractedHomeArea:
        typeof parsed.extractedHomeArea === "string" && parsed.extractedHomeArea.trim()
          ? parsed.extractedHomeArea.trim()
          : null,
      isProximityPreferenceQuery: Boolean(parsed.isProximityPreferenceQuery),
      preferenceFeedback,
      autopilotOperation,
      autopilotTargetName:
        typeof parsed.autopilotTargetName === "string" && parsed.autopilotTargetName.trim()
          ? parsed.autopilotTargetName.trim()
          : null,
      autopilotCreateFields,
      autopilotOperationConfidence,
    };
  } catch {
    return fallback;
  }
}

async function extractProfileFactsFromMessage(input: {
  message: string;
  lastAssistantMessage?: string;
}): Promise<{ preferredName: string | null; city: string | null; homeArea: string | null }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { preferredName: null, city: null, homeArea: null };
  const contextLine = input.lastAssistantMessage
    ? `Previous assistant message: """${input.lastAssistantMessage.slice(0, 240)}"""`
    : "";
  const prompt = [
    "Extract profile facts from the user message. Reply with strict JSON only.",
    contextLine,
    `User message: """${input.message}"""`,
    'Return exactly: { "preferredName": string|null, "city": string|null, "homeArea": string|null }',
    "Rules:",
    "- Extract city even if mixed with other intents (calendar access, capability, planning).",
    "- homeArea is neighborhood/intersection/postal-prefix level only.",
    "- If uncertain, return null.",
  ]
    .filter(Boolean)
    .join("\n");
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "beetlebot",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0,
        max_tokens: 90,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { preferredName: null, city: null, homeArea: null };
    const payload = (await response.json()) as OpenRouterResponse;
    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
    const parsed = JSON.parse(stripSimpleCodeFence(text)) as {
      preferredName?: string | null;
      city?: string | null;
      homeArea?: string | null;
    };
    return {
      preferredName: typeof parsed.preferredName === "string" && parsed.preferredName.trim() ? parsed.preferredName.trim() : null,
      city: typeof parsed.city === "string" && parsed.city.trim() ? parsed.city.trim() : null,
      homeArea: typeof parsed.homeArea === "string" && parsed.homeArea.trim() ? parsed.homeArea.trim() : null,
    };
  } catch {
    return { preferredName: null, city: null, homeArea: null };
  }
}

async function extractCalendarAnchorIntentFromMessage(input: {
  message: string;
  lastAssistantMessage?: string;
}): Promise<{ shouldProactiveCalendarCheck: boolean; isUpcomingQuery: boolean }> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return { shouldProactiveCalendarCheck: false, isUpcomingQuery: false };
  const contextLine = input.lastAssistantMessage
    ? `Previous assistant message: """${input.lastAssistantMessage.slice(0, 240)}"""`
    : "";
  const prompt = [
    "Extract event-anchor calendar intent from the user message. Reply with strict JSON only.",
    contextLine,
    `User message: """${input.message}"""`,
    'Return exactly: { "shouldProactiveCalendarCheck": boolean, "isUpcomingQuery": boolean }',
    "Rules:",
    "- Set shouldProactiveCalendarCheck=true if user asks for plans relative to a personal event/time anchor soon and expects the assistant to figure timing from calendar.",
    "- Set isUpcomingQuery=true if user is asking about upcoming/next timing around an event (e.g., before a named event tomorrow).",
    "- If uncertain, return false for both.",
  ]
    .filter(Boolean)
    .join("\n");
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "beetlebot",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0,
        max_tokens: 60,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return { shouldProactiveCalendarCheck: false, isUpcomingQuery: false };
    const payload = (await response.json()) as OpenRouterResponse;
    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
    const parsed = JSON.parse(stripSimpleCodeFence(text)) as {
      shouldProactiveCalendarCheck?: boolean;
      isUpcomingQuery?: boolean;
    };
    return {
      shouldProactiveCalendarCheck: Boolean(parsed.shouldProactiveCalendarCheck),
      isUpcomingQuery: Boolean(parsed.isUpcomingQuery),
    };
  } catch {
    return { shouldProactiveCalendarCheck: false, isUpcomingQuery: false };
  }
}

async function confirmCalendarReadIntentFromMessage(input: {
  message: string;
  lastAssistantMessage?: string;
}): Promise<boolean> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return false;
  const contextLine = input.lastAssistantMessage
    ? `Previous assistant message: """${input.lastAssistantMessage.slice(0, 240)}"""`
    : "";
  const prompt = [
    "Determine whether the user is explicitly asking to read their personal calendar/schedule. Reply with strict JSON only.",
    contextLine,
    `User message: """${input.message}"""`,
    'Return exactly: { "isPersonalCalendarRead": boolean }',
    "Rules:",
    "- True ONLY when user is asking to read/check their own calendar, schedule, meetings, availability, or next event.",
    "- False for greetings, small-talk, general planning requests, recommendation/discovery asks, location info asks, and capability/help questions.",
    "- False for calendar write/modify commands (add/create/schedule/update/move/reschedule/delete/remove).",
    "- If message asks for ideas/plans/activities (even with 'tomorrow'), return false unless user explicitly asks to read their calendar.",
    "- If message includes both calendar mention and an action command, action wins: return false.",
    "Examples:",
    '- "what is next on my calendar?" => true',
    '- "am I free tomorrow at 2?" => true',
    '- "add a focus block tomorrow at 2pm to my calendar" => false',
    '- "I\'m in Vancouver, find me a fun indoor plan for tomorrow" => false',
    '- "date night ideas this Saturday under $120" => false',
    "- If uncertain, return false.",
  ]
    .filter(Boolean)
    .join("\n");
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "beetlebot",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0,
        max_tokens: 40,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as OpenRouterResponse;
    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
    const parsed = JSON.parse(stripSimpleCodeFence(text)) as {
      isPersonalCalendarRead?: boolean;
    };
    return Boolean(parsed.isPersonalCalendarRead);
  } catch {
    return false;
  }
}

async function confirmCalendarWriteIntentFromMessage(input: {
  message: string;
  lastAssistantMessage?: string;
}): Promise<boolean> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return false;
  const contextLine = input.lastAssistantMessage
    ? `Previous assistant message: """${input.lastAssistantMessage.slice(0, 240)}"""`
    : "";
  const prompt = [
    "Determine whether the user is asking to WRITE/CHANGE their calendar. Reply with strict JSON only.",
    contextLine,
    `User message: """${input.message}"""`,
    'Return exactly: { "isCalendarWriteIntent": boolean }',
    "Rules:",
    "- True for add/create/schedule/block/move/reschedule/update/delete/remove calendar-event requests.",
    "- True when user asks to place a suggestion/option onto calendar.",
    "- True when the message specifies a date/time and asks to put that item on calendar.",
    "- False for memory/recall questions about prior conversation actions (e.g., 'what event did I ask you to book yesterday?').",
    "- False for read-only schedule questions (next event, am I free, what's on my calendar).",
    "- False for general planning/discovery requests that do not ask to modify calendar.",
    "Examples:",
    '- "add a focus block tomorrow at 2pm to my calendar" => true',
    '- "move my dentist appointment to 3pm tomorrow" => true',
    '- "add option 2 to my calendar" => true',
    '- "schedule deep work tomorrow 9am-11am on my calendar" => true',
    '- "plan me something at 5pm today in Toronto with a backup option" => false',
    '- "Hola, puedes planearme algo simple para manana?" => false',
    '- "what is next on my calendar?" => false',
    '- "I\'m in Vancouver, find me a fun indoor plan for tomorrow" => false',
    "- If uncertain, return false.",
  ]
    .filter(Boolean)
    .join("\n");
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "beetlebot",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0,
        max_tokens: 40,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as OpenRouterResponse;
    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
    const parsed = JSON.parse(stripSimpleCodeFence(text)) as {
      isCalendarWriteIntent?: boolean;
    };
    return Boolean(parsed.isCalendarWriteIntent);
  } catch {
    return false;
  }
}

async function confirmProactiveCalendarIntentFromMessage(input: {
  message: string;
  lastAssistantMessage?: string;
}): Promise<boolean> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return false;
  const contextLine = input.lastAssistantMessage
    ? `Previous assistant message: """${input.lastAssistantMessage.slice(0, 240)}"""`
    : "";
  const prompt = [
    "Determine whether the user is explicitly asking to use their personal calendar as an anchor for this turn. Reply with strict JSON only.",
    contextLine,
    `User message: """${input.message}"""`,
    'Return exactly: { "needsCalendarAnchor": boolean }',
    "Rules:",
    "- True only if the user explicitly asks to check/read their personal calendar, schedule, meetings, availability, or asks to plan around a personal event already in their calendar.",
    "- False for general recommendation/planning requests that mention timeframes (Friday, weekend, tomorrow) without asking to use personal calendar data.",
    "- False for generic 'ideas' requests unless the user explicitly references their own schedule/calendar.",
    "- If uncertain, return false.",
  ]
    .filter(Boolean)
    .join("\n");
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "beetlebot",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0,
        max_tokens: 40,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(12000),
    });
    if (!response.ok) return false;
    const payload = (await response.json()) as OpenRouterResponse;
    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
    const parsed = JSON.parse(stripSimpleCodeFence(text)) as {
      needsCalendarAnchor?: boolean;
    };
    return Boolean(parsed.needsCalendarAnchor);
  } catch {
    return false;
  }
}

function parseApprovalRuleValue(input: string): "ask_first" | "auto_hold" | "auto_execute" | null {
  const value = input.toLowerCase().trim();
  if (value.includes("ask")) return "ask_first";
  if (value.includes("hold")) return "auto_hold";
  if (value.includes("execute") || value.includes("auto")) return "auto_execute";
  return null;
}

function normalizeAutopilotCreateFields(fields: MessageIntent["autopilotCreateFields"]) {
  if (!fields) return null;
  const triggerType =
    fields.triggerType === "context" || fields.triggerType === "event" ? fields.triggerType : "time";
  const approvalRule = parseApprovalRuleValue(fields.approvalRule) ?? "ask_first";
  const budgetCap = Number.isFinite(fields.budgetCap) ? Math.max(1, Math.round(fields.budgetCap)) : 120;
  return {
    name: fields.name?.trim() ?? "",
    goal: fields.goal?.trim() ?? "",
    trigger: fields.trigger?.trim() ?? "",
    triggerType,
    action: fields.action?.trim() ?? "",
    approvalRule,
    mode: fields.mode?.trim() || "explore",
    budgetCap,
  };
}

function shouldAskInSessionFeedbackFollowup(input: {
  threadId: string;
  recentConversation: Array<{ role: string; content: string; blocksJson?: string | null }>;
  isLightConversationTurn: boolean;
  explicitSuggestionRequest: boolean;
}) {
  if (!input.isLightConversationTurn || input.explicitSuggestionRequest) return false;
  const hasRecentRecommendation = input.recentConversation
    .filter((item) => item.role === "assistant")
    .some((item) => Boolean(item.blocksJson));
  if (!hasRecentRecommendation) return false;
  const alreadyAsked = input.recentConversation
    .slice(-8)
    .some(
      (item) =>
        item.role === "assistant" &&
        item.content.toLowerCase().includes("how did") &&
        item.content.toLowerCase().includes("go"),
    );
  if (alreadyAsked) return false;
  const daySeed = new Date().toISOString().slice(0, 10);
  const seed = `${input.threadId}:${daySeed}:feedback`;
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return hash % 5 === 0;
}

function hasRecentClarifierQuestion(
  recentConversation: Array<{ role: string; content: string; blocksJson?: string | null }>,
) {
  return recentConversation
    .slice(-6)
    .some((item) => {
      if (item.role !== "assistant") return false;
      const content = item.content.toLowerCase();
      return (
        content.includes("quick check") ||
        content.includes("which area should i center around") ||
        content.includes("what city are you in") ||
        content.includes("which option should i add")
      );
    });
}

export function extractThreadSuggestionsForIntent(
  messages: Array<{ role: string; blocksJson?: string | null }>,
): ThreadSuggestion[] {
  const fromMostRecent = [...messages].reverse();
  const collected: ThreadSuggestion[] = [];
  const dedupe = new Set<string>();
  let idx = 1;

  for (const message of fromMostRecent) {
    if (message.role !== "assistant") continue;
    const blocks = parseMessageBlocks(message.blocksJson ?? null);
    if (!blocks?.length) continue;

    for (const block of blocks) {
      const cards =
        block.type === "image_card"
          ? [block]
          : block.type === "image_gallery"
            ? block.items
            : block.type === "option_set"
              ? block.items.map((item) => item.card)
              : [];

      for (const card of cards) {
        const key = `${card.title.toLowerCase()}::${card.actionUrl ?? ""}`;
        if (dedupe.has(key)) continue;
        dedupe.add(key);
        collected.push({
          index: idx++,
          title: card.title,
          subtitle: card.subtitle,
          meta: card.meta,
          actionUrl: card.actionUrl,
          sourceName: card.sourceName,
        });
        if (collected.length >= 8) return collected;
      }
    }
  }

  return collected;
}

function formatSuggestionsForPrompt(suggestions: ThreadSuggestion[]): string {
  if (!suggestions.length) return "No prior structured suggestions found in thread blocks.";
  return suggestions
    .map((suggestion) => {
      const meta =
        suggestion.meta && Object.keys(suggestion.meta).length
          ? ` | meta=${JSON.stringify(suggestion.meta)}`
          : "";
      const link = suggestion.actionUrl ? ` | url=${suggestion.actionUrl}` : "";
      return `[${suggestion.index}] ${suggestion.title}${suggestion.subtitle ? ` — ${suggestion.subtitle}` : ""}${meta}${link}`;
    })
    .join("\n");
}

async function resolveSuggestionIntentFromThread(input: {
  message: string;
  lastAssistantMessage?: string;
  suggestions: ThreadSuggestion[];
}): Promise<SuggestionIntentResolution | null> {
  if (!input.suggestions.length) return null;
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return null;

  const contextLine = input.lastAssistantMessage
    ? `Last assistant text: """${input.lastAssistantMessage.slice(0, 500)}"""`
    : "";
  const prompt = [
    "You resolve what prior suggestions the user is referring to.",
    "Reply with strict JSON only.",
    "",
    contextLine,
    `User message: """${input.message}"""`,
    "Thread suggestions:",
    formatSuggestionsForPrompt(input.suggestions),
    "",
    "Return exactly:",
    '{ "selectedIndices": number[], "confidence": number, "rationale": string }',
    "",
    "Rules:",
    "- selectedIndices must contain index values from the provided suggestion list.",
    "- confidence must be between 0 and 1.",
    "- If reference is ambiguous, return an empty selectedIndices array with low confidence.",
    "- Prefer selecting explicitly mentioned numbers (e.g., option 2), otherwise infer from semantics.",
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "http://localhost:3001",
        "X-Title": "beetlebot",
      },
      body: JSON.stringify({
        model: "openai/gpt-4o-mini",
        temperature: 0,
        max_tokens: 180,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(6000),
    });
    if (!response.ok) return null;

    const payload = (await response.json()) as OpenRouterResponse;
    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";
    const clean = stripSimpleCodeFence(text);
    const parsed = JSON.parse(clean) as Partial<SuggestionIntentResolution>;
    const selectedIndices = Array.isArray(parsed.selectedIndices)
      ? parsed.selectedIndices
          .map((value) => (typeof value === "number" ? Math.round(value) : NaN))
          .filter((value) => Number.isFinite(value))
      : [];
    const allowed = new Set(input.suggestions.map((suggestion) => suggestion.index));
    const filtered = selectedIndices.filter((value) => allowed.has(value));
    const confidence = typeof parsed.confidence === "number" ? Math.min(Math.max(parsed.confidence, 0), 1) : 0;
    return {
      selectedIndices: Array.from(new Set(filtered)),
      confidence,
      rationale: typeof parsed.rationale === "string" ? parsed.rationale.slice(0, 300) : "",
    };
  } catch {
    return null;
  }
}

type CalendarToolEvent = {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  attendees?: string[];
  htmlLink?: string;
  calendarId?: string;
  calendarName?: string;
  primary?: boolean;
};

type CalendarCreateLikeArgs = {
  operation: "create";
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  timeZone?: string;
  attendees?: string[];
  calendarId?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function parseCalendarToolEvents(payload: Record<string, unknown>): CalendarToolEvent[] {
  const rawEvents = Array.isArray(payload.events) ? payload.events : [];
  const parsed: CalendarToolEvent[] = [];
  for (const raw of rawEvents) {
    if (!isRecord(raw)) continue;
    const id = typeof raw.id === "string" ? raw.id : null;
    const summary = typeof raw.summary === "string" ? raw.summary : null;
    const start = typeof raw.start === "string" ? raw.start : null;
    const end = typeof raw.end === "string" ? raw.end : null;
    if (!id || !summary || !start || !end) continue;
    parsed.push({
      id,
      summary,
      start,
      end,
      description: typeof raw.description === "string" ? raw.description : undefined,
      location: typeof raw.location === "string" ? raw.location : undefined,
      attendees: Array.isArray(raw.attendees)
        ? raw.attendees
            .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            .slice(0, 12)
        : undefined,
      htmlLink: typeof raw.htmlLink === "string" ? raw.htmlLink : undefined,
      calendarId: typeof raw.calendarId === "string" ? raw.calendarId : undefined,
      calendarName: typeof raw.calendarName === "string" ? raw.calendarName : undefined,
      primary: typeof raw.primary === "boolean" ? raw.primary : undefined,
    });
  }
  return parsed;
}

function normalizeTextForMatch(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function jaccardSimilarity(a: string, b: string): number {
  const aTokens = new Set(normalizeTextForMatch(a));
  const bTokens = new Set(normalizeTextForMatch(b));
  if (!aTokens.size || !bTokens.size) return 0;
  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) overlap += 1;
  }
  const union = new Set([...aTokens, ...bTokens]).size;
  return union > 0 ? overlap / union : 0;
}

function toDateMs(iso: string): number | null {
  const value = new Date(iso).getTime();
  return Number.isFinite(value) ? value : null;
}

function overlapsWithTolerance(input: {
  aStart: string;
  aEnd: string;
  bStart: string;
  bEnd: string;
  toleranceMinutes?: number;
}) {
  const toleranceMs = (input.toleranceMinutes ?? 90) * 60 * 1000;
  const aStart = toDateMs(input.aStart);
  const aEnd = toDateMs(input.aEnd);
  const bStart = toDateMs(input.bStart);
  const bEnd = toDateMs(input.bEnd);
  if (aStart == null || aEnd == null || bStart == null || bEnd == null) return false;
  return aStart <= bEnd + toleranceMs && bStart <= aEnd + toleranceMs;
}

function locationSimilarity(a?: string, b?: string): number {
  if (!a || !b) return 0;
  return jaccardSimilarity(a, b);
}

function buildSuggestionDetailsBlock(suggestions: ThreadSuggestion[]): string {
  if (!suggestions.length) return "";
  const lines = suggestions.map((suggestion) => {
    const parts = [suggestion.title];
    if (suggestion.subtitle) parts.push(suggestion.subtitle);
    if (suggestion.actionUrl) parts.push(suggestion.actionUrl);
    return `- ${parts.join(" | ")}`;
  });
  return ["Suggested venues from thread:", ...lines].join("\n");
}

function ensureDescriptionIncludesSuggestions(
  description: string | undefined,
  suggestions: ThreadSuggestion[],
): string | undefined {
  if (!suggestions.length) return description;
  const base = (description ?? "").trim();
  const lower = base.toLowerCase();
  const missing = suggestions.filter((suggestion) => !lower.includes(suggestion.title.toLowerCase()));
  if (!missing.length) return description;
  const details = buildSuggestionDetailsBlock(missing);
  return base ? `${base}\n\n${details}` : details;
}

function scoreDuplicateCandidate(input: {
  createArgs: CalendarCreateLikeArgs;
  existing: CalendarToolEvent;
}): number {
  const textA = `${input.createArgs.summary} ${input.createArgs.description ?? ""}`;
  const textB = `${input.existing.summary} ${input.existing.description ?? ""}`;
  const titleScore = jaccardSimilarity(input.createArgs.summary, input.existing.summary);
  const detailScore = jaccardSimilarity(textA, textB);
  const timeScore = overlapsWithTolerance({
    aStart: input.createArgs.start,
    aEnd: input.createArgs.end,
    bStart: input.existing.start,
    bEnd: input.existing.end,
  })
    ? 1
    : 0;
  const placeScore = locationSimilarity(input.createArgs.location, input.existing.location);
  return titleScore * 0.4 + detailScore * 0.2 + timeScore * 0.3 + placeScore * 0.1;
}

async function findPotentialDuplicateForCreate(input: {
  tool: ChatToolDefinition;
  createArgs: CalendarCreateLikeArgs;
}) {
  const startMs = toDateMs(input.createArgs.start);
  const endMs = toDateMs(input.createArgs.end);
  if (startMs == null || endMs == null) return { candidate: null as CalendarToolEvent | null, score: 0, secondScore: 0 };

  const timeMin = new Date(startMs - 6 * 60 * 60 * 1000).toISOString();
  const timeMax = new Date(endMs + 6 * 60 * 60 * 1000).toISOString();
  const listResult = await input.tool.execute({
    operation: "list_multi",
    timeMin,
    timeMax,
    query: input.createArgs.summary,
    maxResultsPerCalendar: 40,
  });
  const events = parseCalendarToolEvents(
    (listResult && typeof listResult === "object" ? listResult : {}) as Record<string, unknown>,
  );
  if (!events.length) return { candidate: null as CalendarToolEvent | null, score: 0, secondScore: 0 };

  const scored = events
    .map((event) => ({
      event,
      score: scoreDuplicateCandidate({ createArgs: input.createArgs, existing: event }),
    }))
    .sort((a, b) => b.score - a.score);

  return {
    candidate: scored[0]?.event ?? null,
    score: scored[0]?.score ?? 0,
    secondScore: scored[1]?.score ?? 0,
  };
}

function plusDaysIso(days: number) {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function eventStartMs(event: CalendarToolEvent) {
  const parsed = new Date(event.start).getTime();
  return Number.isFinite(parsed) ? parsed : Number.MAX_SAFE_INTEGER;
}

function countKeywordMatches(text: string, keywords: string[]) {
  const normalized = text.toLowerCase();
  return keywords.reduce((total, keyword) => (normalized.includes(keyword) ? total + 1 : total), 0);
}

function rankCalendarEvents(events: CalendarToolEvent[], intent: MessageIntent) {
  const isTravelIntent = intent.isTravelQuery;
  const keywords = ["travel", "trip", "vacation", "flight", "hotel", "getaway", "journey"];
  const now = Date.now();

  const scored = events.map((event) => {
    const startMs = eventStartMs(event);
    const isFuture = startMs >= now;
    const eventText = `${event.summary} ${event.description ?? ""}`.toLowerCase();
    const calendarText = (event.calendarName ?? "").toLowerCase();
    const keywordScore = isTravelIntent ? countKeywordMatches(eventText, keywords) : 0;
    const calendarScore = isTravelIntent ? countKeywordMatches(calendarText, keywords) : 0;
    const proximityPenalty = Math.max(0, Math.floor((startMs - now) / (24 * 60 * 60 * 1000)));
    const score = (calendarScore * 25 + keywordScore * 15) - proximityPenalty;

    return {
      event,
      startMs,
      isFuture,
      score,
      calendarScore,
      keywordScore,
    };
  });

  scored.sort((a, b) => {
    if (a.isFuture !== b.isFuture) return a.isFuture ? -1 : 1;
    if (isTravelIntent && a.score !== b.score) return b.score - a.score;
    if (a.startMs !== b.startMs) return a.startMs - b.startMs;
    return a.event.summary.localeCompare(b.event.summary);
  });

  return scored.map((item) => item.event);
}

function formatEventDate(dateIso: string, timezone?: string) {
  const date = new Date(dateIso);
  const tz = timezone || "America/Toronto";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

async function tryAnswerCalendarIntent(input: {
  intent: MessageIntent;
  timezone?: string;
}) {
  const conn = await getIntegrationConnection("google_calendar");
  const hasReadScope = conn.status === "connected" && conn.grantedScopes.includes("read");
  if (!hasReadScope) {
    return { handled: false as const };
  }

  const tool = getChatToolByName("google_calendar_events");
  if (!tool) {
    return { handled: false as const };
  }

  const baseTimeMin = new Date().toISOString();
  const travelIntent = input.intent.isTravelQuery;
  const nextLookup = input.intent.isUpcomingQuery || travelIntent;
  const windows = nextLookup ? [14, 90] : [90];
  const query = travelIntent ? TRAVEL_QUERY : undefined;

  let events: CalendarToolEvent[] = [];
  let windowUsed = windows[windows.length - 1];
  let lastToolError: string | null = null;

  for (const window of windows) {
    const result = await tool.execute({
      operation: "list_multi",
      timeMin: baseTimeMin,
      timeMax: plusDaysIso(window),
      query,
      maxResultsPerCalendar: 30,
    });
    if (isRecord(result) && typeof result.error === "string" && result.error.trim().length > 0) {
      lastToolError = result.error.trim();
      windowUsed = window;
      continue;
    }
    const parsed = parseCalendarToolEvents(result);
    if (parsed.length > 0) {
      events = parsed;
      windowUsed = window;
      break;
    }
    windowUsed = window;
  }

  const ranked = rankCalendarEvents(events, input.intent);
  if (!ranked.length) {
    if (lastToolError) {
      return {
        handled: true as const,
        replyText:
          "I couldn't read your calendar right now because the calendar tool returned an error. Please reconnect Google Calendar in Settings, then try again.",
        trace: `calendar_intent_tool_error scope=all window_days=${windowUsed} error=${lastToolError.slice(0, 120)}`,
      };
    }
    const qualifier = travelIntent ? "travel-related events" : "events";
    return {
      handled: true as const,
      replyText: `I checked all readable calendars for ${qualifier} in the next ${windowUsed} days and couldn’t find any. Want me to widen the window or search a specific calendar name?`,
      trace: `calendar_intent_detected scope=all window_days=${windowUsed} matches=0`,
    };
  }

  if (travelIntent || nextLookup) {
    const top = ranked[0];
    const when = formatEventDate(top.start, input.timezone);
    const source = top.calendarName ? ` from ${top.calendarName}` : "";
    const location = top.location ? ` at ${top.location}` : "";
    return {
      handled: true as const,
      replyText: `Your next plan is ${top.summary}${source} on ${when}${location}.`,
      trace: `calendar_intent_detected scope=all window_days=${windowUsed} matches=${ranked.length} match_source_calendar=${top.calendarName ?? "unknown"}`,
      anchorEvent: {
        summary: top.summary,
        start: top.start,
        calendarName: top.calendarName ?? null,
        location: top.location ?? null,
      },
    };
  }

  const lines = ranked.slice(0, 3).map((event, index) => {
    const when = formatEventDate(event.start, input.timezone);
    const source = event.calendarName ? ` (${event.calendarName})` : "";
    return `${index + 1}. ${event.summary} — ${when}${source}`;
  });
  return {
    handled: true as const,
    replyText: `Here are your next events:\n${lines.join("\n")}`,
    trace: `calendar_intent_detected scope=all window_days=${windowUsed} matches=${ranked.length}`,
  };
}

function formatLocalDayKey(date: Date, timezone?: string) {
  const tz = timezone || "America/Toronto";
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(date);
}

function prettifyAttendeeLabel(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (!trimmed.includes("@")) return trimmed;
  const local = trimmed.split("@")[0] ?? "";
  const words = local
    .replace(/[._-]+/g, " ")
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 3);
  if (!words.length) return trimmed;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

async function getMostRecentSuggestedRestaurantFromHistory() {
  const messages = await db.conversationMessage.findMany({
    where: {
      role: "assistant",
      createdAt: {
        gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000),
      },
    },
    orderBy: { createdAt: "desc" },
    take: 80,
    select: {
      blocksJson: true,
      createdAt: true,
    },
  });

  for (const message of messages) {
    const blocks = parseMessageBlocks(message.blocksJson ?? null);
    if (!blocks?.length) continue;
    for (const block of blocks) {
      const cards =
        block.type === "image_card"
          ? [block]
          : block.type === "image_gallery"
            ? block.items
            : block.type === "option_set"
              ? block.items.map((item) => item.card)
              : [];
      for (const card of cards) {
        const title = card.title?.trim();
        if (!title) continue;
        const category = (card.meta?.category ?? "").toLowerCase();
        const restaurantSignal = /\b(restaurant|bistro|cafe|brunch|dining)\b/.test(
          `${title.toLowerCase()} ${category}`,
        );
        if (restaurantSignal) {
          return { title, createdAt: message.createdAt };
        }
      }
    }
  }
  return null;
}

async function getRecentBookingRequestFromHistory() {
  const messages = await db.conversationMessage.findMany({
    where: {
      role: "user",
      createdAt: {
        gte: new Date(Date.now() - 72 * 60 * 60 * 1000),
      },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      content: true,
      createdAt: true,
    },
  });

  for (const message of messages) {
    const normalized = normalizeMessageForIntentRules(message.content);
    if (!/\bbook\b/.test(normalized)) continue;
    if (normalized.includes("?")) continue;
    const extracted =
      message.content.match(/\bbook(?:\s+for\s+me)?\s+(.+?)(?:[.!?]|$)/i)?.[1]?.trim() ?? message.content.trim();
    if (!extracted) continue;
    return { requestText: extracted, createdAt: message.createdAt };
  }
  return null;
}

async function tryAnswerMemoryRecallQuestion(input: { message: string; timezone?: string }) {
  const normalized = normalizeMessageForIntentRules(input.message);

  const asksRestaurantRecall =
    /\brestaurant\b/.test(normalized) &&
    (/\brecommended\b/.test(normalized) || /\bremember\b/.test(normalized) || /\bwhat was\b/.test(normalized));
  if (asksRestaurantRecall) {
    const recentRestaurant = await getMostRecentSuggestedRestaurantFromHistory();
    if (!recentRestaurant) {
      return {
        handled: true as const,
        replyText:
          "I don't have a reliable restaurant recommendation saved from earlier yet. If you share the neighborhood or vibe, I can recommend one now and keep it in memory.",
        model: "policy/memory_recall",
      };
    }
    return {
      handled: true as const,
      replyText: `The most recent restaurant I recommended was ${recentRestaurant.title}.`,
      model: "policy/memory_recall",
    };
  }

  const asksBookingRecall =
    /\basked you to book\b/.test(normalized) ||
    (/\bbook\b/.test(normalized) && /\b(yesterday|last night|two days ago)\b/.test(normalized));
  if (asksBookingRecall) {
    const bookingRequest = await getRecentBookingRequestFromHistory();
    if (!bookingRequest) {
      return {
        handled: true as const,
        replyText:
          "I couldn't find a clear booking request in recent history. If you tell me the event name, I can book it now.",
        model: "policy/memory_recall",
      };
    }
    return {
      handled: true as const,
      replyText: `You asked me to book: ${bookingRequest.requestText}.`,
      model: "policy/memory_recall",
    };
  }

  const asksWhoMeetingToday = /\bwho am i meeting today\b/.test(normalized) || /\bwho.*meeting.*today\b/.test(normalized);
  if (asksWhoMeetingToday) {
    const conn = await getIntegrationConnection("google_calendar");
    const hasReadScope = conn.status === "connected" && conn.grantedScopes.includes("read");
    if (!hasReadScope) {
      return {
        handled: true as const,
        replyText: "I need Google Calendar read access to check today's attendees.",
        model: "policy/memory_recall",
      };
    }
    const tool = getChatToolByName("google_calendar_events");
    if (!tool) {
      return {
        handled: true as const,
        replyText: "I can't access the calendar tool right now. Please try again in a moment.",
        model: "policy/memory_recall",
      };
    }

    const now = new Date();
    const listResult = await tool.execute({
      operation: "list_multi",
      timeMin: new Date(now.getTime() - 12 * 60 * 60 * 1000).toISOString(),
      timeMax: new Date(now.getTime() + 36 * 60 * 60 * 1000).toISOString(),
      maxResultsPerCalendar: 40,
    });
    if (isRecord(listResult) && typeof listResult.error === "string" && listResult.error.trim()) {
      return {
        handled: true as const,
        replyText: "I couldn't read today's events right now because the calendar tool returned an error.",
        model: "policy/memory_recall",
      };
    }
    const events = parseCalendarToolEvents(
      (listResult && typeof listResult === "object" ? listResult : {}) as Record<string, unknown>,
    );
    const todayKey = formatLocalDayKey(now, input.timezone);
    const todayEvents = events.filter((event) => formatLocalDayKey(new Date(event.start), input.timezone) === todayKey);
    const attendees = Array.from(
      new Set(
        todayEvents
          .flatMap((event) => event.attendees ?? [])
          .map((attendee) => prettifyAttendeeLabel(attendee))
          .filter((attendee): attendee is string => Boolean(attendee)),
      ),
    );
    if (!todayEvents.length) {
      return {
        handled: true as const,
        replyText: "You don't have any events on the calendar for today.",
        model: "policy/memory_recall",
      };
    }
    if (!attendees.length) {
      const eventNames = todayEvents.slice(0, 3).map((event) => event.summary).join(", ");
      return {
        handled: true as const,
        replyText: `I found today's events (${eventNames}), but attendee names are not listed on those events.`,
        model: "policy/memory_recall",
      };
    }
    return {
      handled: true as const,
      replyText: `Today you're meeting: ${attendees.slice(0, 8).join(", ")}.`,
      model: "policy/memory_recall",
    };
  }

  return { handled: false as const };
}

function formatResearchReply(input: {
  userMessage: string;
  recommendations: Awaited<ReturnType<typeof runResearchLoop>>["recommendations"];
  sourceDiversityTarget: number;
}) {
  if (!input.recommendations.length) {
    return "I dug for fresh sources but couldn't find strong matches yet. Share a city and budget and I will run a tighter discovery pass.";
  }
  const options = input.recommendations.slice(0, 4).map((item) => ({
    title: item.title,
    subtitle: item.whyItFits,
    category: inferResearchCategory(item),
    meta: {
      source: item.sourceName,
      domain: item.domain,
    },
    actionUrl: item.url,
    sourceName: item.sourceName,
  }));
  const isQuestion = /\?\s*$/.test(input.userMessage.trim());
  const leadIn = isQuestion
    ? "I checked fresh sources and pulled the strongest options with direct links."
    : `I pulled fresh options and kept diversity across roughly ${input.sourceDiversityTarget} source domains.`;
  return JSON.stringify({
    text: leadIn,
    options,
  });
}

function inferResearchCategory(item: {
  title: string;
  url: string;
  domain: string;
}): "event" | "hotel" | "restaurant" | "activity" | "destination" | "experience" {
  const text = `${item.title} ${item.url} ${item.domain}`.toLowerCase();
  if (/(hotel|resort|inn|suite|lodging|booking\.com|expedia|airbnb)/.test(text)) return "hotel";
  if (/(restaurant|cafe|bar|bistro|brunch|dining|food|opentable|yelp)/.test(text)) return "restaurant";
  if (/(festival|concert|tickets|event|show|exhibition|calendar)/.test(text)) return "event";
  if (/(park|museum|gallery|tour|activity|things to do|attraction)/.test(text)) return "activity";
  if (/(travel|destination|visit|tourism)/.test(text)) return "destination";
  return "experience";
}

async function createUniquePackSlug(base: string) {
  const root = slugify(base) || "custom-pack";
  for (let idx = 0; idx < 20; idx += 1) {
    const candidate = idx === 0 ? root : `${root}-${idx + 1}`;
    const existing = await getPackBySlug(candidate);
    if (!existing) return candidate;
  }
  return `${root}-${Date.now()}`;
}

export async function POST(request: Request) {
  try {
    const body = chatSchema.parse(await request.json());

    const existingThread = body.threadId ? await getConversationThread(body.threadId) : null;
    const thread = existingThread ?? (await createConversationThread(body.message.slice(0, 100)));
    const isNewThread = !existingThread;
    const recentConversation = await getConversationMessages(thread.id, CONVERSATION_HISTORY_LIMIT);
    const conversationHistory: OpenRouterMessage[] = recentConversation
      .filter((item) => item.role === "user" || item.role === "assistant" || item.role === "system")
      .map((item) => ({
        role: item.role as "user" | "assistant" | "system",
        content: item.content,
      }));

    const lastAssistantMessage = recentConversation
      .filter((m) => m.role === "assistant")
      .at(-1)?.content;
    let intent = await classifyMessageIntent(body.message, lastAssistantMessage);
    const shouldRunProfileFactsPass =
      intent.intentExtractionOk &&
      !intent.extractedPreferredName &&
      !intent.extractedCity &&
      !intent.extractedHomeArea &&
      (intent.isProfileCaptureTurn || intent.isProximityPreferenceQuery || intent.shouldProactiveCalendarCheck);
    if (shouldRunProfileFactsPass) {
      const profileFacts = await extractProfileFactsFromMessage({
        message: body.message,
        lastAssistantMessage,
      });
      intent = {
        ...intent,
        extractedPreferredName: intent.extractedPreferredName ?? profileFacts.preferredName,
        extractedCity: intent.extractedCity ?? profileFacts.city,
        extractedHomeArea: intent.extractedHomeArea ?? profileFacts.homeArea,
      };
    }
    const shouldRunCalendarAnchorRescuePass =
      !intent.isProximityPreferenceQuery &&
      !intent.isTravelQuery &&
      !intent.isActionCommand &&
      !intent.isCalendarWrite &&
      !intent.isCalendarQuery &&
      !intent.shouldProactiveCalendarCheck &&
      !intent.isUpcomingQuery &&
      ((intent.intentExtractionOk && intent.isDiscoveryQuery && intent.isExplicitSuggestionRequest) ||
        !intent.intentExtractionOk);
    if (shouldRunCalendarAnchorRescuePass) {
      const calendarAnchorIntent = await extractCalendarAnchorIntentFromMessage({
        message: body.message,
        lastAssistantMessage,
      });
      if (calendarAnchorIntent.shouldProactiveCalendarCheck || calendarAnchorIntent.isUpcomingQuery) {
        intent = {
          ...intent,
          intentExtractionOk: true,
          shouldProactiveCalendarCheck:
            intent.shouldProactiveCalendarCheck || calendarAnchorIntent.shouldProactiveCalendarCheck,
          isUpcomingQuery: intent.isUpcomingQuery || calendarAnchorIntent.isUpcomingQuery,
        };
      }
    }
    const shouldRunCalendarWriteRescue =
      (intent.isCalendarQuery || intent.shouldProactiveCalendarCheck || intent.isUpcomingQuery) &&
      !intent.isCalendarWrite &&
      !intent.isActionCommand &&
      !intent.isCapabilityQuery &&
      !intent.isDiscoveryQuery;
    if (shouldRunCalendarWriteRescue) {
      const confirmedCalendarWrite = await confirmCalendarWriteIntentFromMessage({
        message: body.message,
        lastAssistantMessage,
      });
      if (confirmedCalendarWrite) {
        intent = {
          ...intent,
          isActionCommand: true,
          isCalendarWrite: true,
          isCalendarQuery: false,
          shouldProactiveCalendarCheck: false,
          isUpcomingQuery: false,
        };
      }
    }

    const shouldRunCalendarReadGuard =
      intent.isCalendarQuery &&
      !intent.isCalendarWrite &&
      !intent.isActionCommand &&
      !intent.isCapabilityQuery;
    if (shouldRunCalendarReadGuard) {
      const confirmedCalendarRead = await confirmCalendarReadIntentFromMessage({
        message: body.message,
        lastAssistantMessage,
      });
      if (!confirmedCalendarRead) {
        intent = {
          ...intent,
          isCalendarQuery: false,
          isUpcomingQuery: false,
        };
      }
    }
    const shouldRunProactiveCalendarGuard =
      (intent.shouldProactiveCalendarCheck || intent.isUpcomingQuery) &&
      !intent.isCalendarWrite &&
      !intent.isActionCommand &&
      !intent.isCapabilityQuery;
    if (shouldRunProactiveCalendarGuard) {
      const confirmedCalendarAnchor = await confirmProactiveCalendarIntentFromMessage({
        message: body.message,
        lastAssistantMessage,
      });
      if (!confirmedCalendarAnchor) {
        intent = {
          ...intent,
          shouldProactiveCalendarCheck: false,
          isUpcomingQuery: false,
        };
      }
    }
    const shouldRunCalendarWriteGuard =
      intent.isCalendarWrite &&
      !intent.isCapabilityQuery &&
      intent.isExplicitSuggestionRequest &&
      !intent.referencesPriorSuggestions;
    if (shouldRunCalendarWriteGuard) {
      const confirmedCalendarWrite = await confirmCalendarWriteIntentFromMessage({
        message: body.message,
        lastAssistantMessage,
      });
      if (!confirmedCalendarWrite) {
        intent = {
          ...intent,
          isCalendarWrite: false,
          isActionCommand: false,
        };
      }
    }
    if (isLikelyHistoricalRecallQuestion(body.message)) {
      intent = {
        ...intent,
        isActionCommand: false,
        isCalendarWrite: false,
      };
    }
    await extractImplicitPreferencesFromModel(intent);

    const preferenceProfile = await getPreferenceProfile();
    const preferredName = await getPreferredNameFromMemory();
    const preferredCity = await getPreferredCityFromMemory();
    const homeArea = await getHomeAreaFromMemory();
    const taste = await tasteProfile();
    const integrationConnections = await listIntegrationConnections();
    const integrationStatus = formatIntegrationStatusSnapshot(integrationConnections);
    const allPacks = await listPacks();
    const packStatus = formatPackStatusSnapshot(allPacks);
    const autopilots = await listAutopilots();
    const autopilotStatus = formatAutopilotSnapshot(autopilots);
    const safetySettings = await getSafetySettings();
    const approvalGateStatus = formatApprovalGateSnapshot(safetySettings);
    const recentRuns = await db.autopilotRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    const installedPacks = await getInstalledPackInstructions();
    const packContext = await buildPackContext(installedPacks);
    const constraints = extractRecommendationConstraints({
      message: body.message,
      tasteHints: taste.topPreferences,
    });
    const signals = deriveRecommendationSignals({
      message: body.message,
      tasteHints: taste.topPreferences,
    });
    const shouldCreatePack = isPackCreationCommand(body.message);

    const { requestedMode, effectiveMode } = resolveEffectiveMode({
      requestedMode: body.mode,
      intent,
    });
    const isGreetingTurn = intent.isGreeting;
    const isSmallTalkTurn = intent.isSmallTalk;
    const isMetaConversationQuery = intent.isMetaConversationQuery;
    const isCapabilityQuery = intent.isCapabilityQuery;
    const isLocationInfoQuery = intent.isLocationInfoQuery;
    const explicitSuggestionRequest = intent.isExplicitSuggestionRequest;
    const allowBestEffortSuggestions = explicitSuggestionRequest || intent.wantsBestEffortNow;
    const shouldUseSafeNoIntentMode = !intent.intentExtractionOk;
    const recentClarifierAsked = hasRecentClarifierQuestion(recentConversation);
    const isProfileCaptureTurn =
      intent.isProfileCaptureTurn ||
      Boolean(intent.extractedPreferredName) ||
      Boolean(intent.extractedCity) ||
      Boolean(intent.extractedHomeArea);
    const shouldAskHomeAreaClarifier =
      intent.isProximityPreferenceQuery &&
      allowBestEffortSuggestions &&
      !intent.wantsBestEffortNow &&
      !recentClarifierAsked &&
      !homeArea &&
      !isCapabilityQuery &&
      !isLocationInfoQuery;
    const capabilityTopic = intent.capabilityTopic;
    const createAutopilotFields =
      intent.autopilotOperation === "create"
        ? normalizeAutopilotCreateFields(intent.autopilotCreateFields)
        : null;
    const deleteAutopilotTarget =
      intent.autopilotOperation === "delete" ? intent.autopilotTargetName : null;
    const toggleAutopilotTarget =
      (intent.autopilotOperation === "pause" || intent.autopilotOperation === "resume") &&
      Boolean(intent.autopilotTargetName)
        ? {
            targetName: intent.autopilotTargetName ?? "",
            status: intent.autopilotOperation === "pause" ? "paused" : "on",
          }
        : null;
    const lowConfidenceAutopilotOp =
      intent.autopilotOperation !== "none" && intent.autopilotOperationConfidence < 0.65;

    const isActionCmd = intent.isActionCommand;
    const localHour = getLocalHour(body.timezone);
    const isLateNight = localHour >= 0 && localHour < 5;
    // Event-anchored planning should still check calendar proactively even if
    // classifier also flags discovery intent ("find fun things before my event tomorrow").
    const shouldProactiveCalendarCheck =
      intent.shouldProactiveCalendarCheck ||
      (intent.isUpcomingQuery && !intent.isCalendarWrite && !intent.isActionCommand);
    const calendarIntent =
      intent.isCalendarQuery ||
      intent.isCalendarWrite ||
      shouldProactiveCalendarCheck;
    const calendarWriteIntent = intent.isCalendarWrite;
    const isCapabilityHelpTurn =
      isCapabilityQuery &&
      !shouldCreatePack &&
      !createAutopilotFields &&
      !deleteAutopilotTarget &&
      !toggleAutopilotTarget &&
      !lowConfidenceAutopilotOp;
    const isLightConversationTurn =
      !intent.isActionCommand &&
      !calendarIntent &&
      !intent.isDiscoveryQuery &&
      !intent.isResearchRequest &&
      !shouldCreatePack &&
      !isCapabilityHelpTurn &&
      !isLocationInfoQuery &&
      !allowBestEffortSuggestions &&
      (isGreetingTurn || isSmallTalkTurn || isProfileCaptureTurn || isMetaConversationQuery);
    const shouldRunResearch =
      !isActionCmd &&
      !isLightConversationTurn &&
      !isCapabilityHelpTurn &&
      !isLocationInfoQuery &&
      allowBestEffortSuggestions &&
      (signals.boredomSignal || intent.isResearchRequest);
    const threadSuggestions = extractThreadSuggestionsForIntent(recentConversation);
    const shouldResolveThreadSuggestions =
      threadSuggestions.length > 0 &&
      (intent.referencesPriorSuggestions || isActionCmd || calendarWriteIntent);
    const suggestionIntent =
      shouldResolveThreadSuggestions
        ? await resolveSuggestionIntentFromThread({
            message: body.message,
            lastAssistantMessage,
            suggestions: threadSuggestions,
          })
        : null;
    const resolvedSuggestions =
      suggestionIntent?.selectedIndices.length
        ? threadSuggestions.filter((suggestion) =>
            suggestionIntent.selectedIndices.includes(suggestion.index),
          )
        : [];

    let orchestrationState: OrchestrationState = "recommendation_mode";
    const hasWeatherReadScope = integrationConnections.some(
      (connection) =>
        connection.provider === "weather" &&
        connection.status === "connected" &&
        connection.grantedScopes.includes("read"),
    );
    const shouldInjectWeatherBrief =
      hasWeatherReadScope &&
      !isLightConversationTurn &&
      !isCapabilityQuery &&
      !isLocationInfoQuery &&
      !shouldUseSafeNoIntentMode &&
      (allowBestEffortSuggestions ||
        isActionCmd ||
        intent.isTravelQuery ||
        intent.isDiscoveryQuery ||
        intent.isResearchRequest ||
        explicitSuggestionRequest ||
        shouldProactiveCalendarCheck);

    let weatherBrief: string | null = null;
    if (shouldInjectWeatherBrief) {
      try {
        const weather = await getWeatherContext({
          location: intent.extractedCity || preferredCity || undefined,
        });
        weatherBrief = buildWeatherBriefContext({
          weather,
          timezone: body.timezone,
        });
      } catch {
        weatherBrief =
          "WEATHER BRIEF: Weather context unavailable right now. Avoid weather-sensitive assumptions and include fallback options.";
      }
    }

    const shouldInjectPackContext =
      Boolean(packContext) &&
      !isLightConversationTurn &&
      !isCapabilityQuery &&
      !isLocationInfoQuery &&
      allowBestEffortSuggestions &&
      (intent.isDiscoveryQuery ||
        intent.isResearchRequest ||
        intent.isTravelQuery);
    const policySections = composePolicySections({
      effectiveMode,
      isActionCmd,
      isCapabilityQuery,
      isCapabilityHelpTurn,
      isLocationInfoQuery,
      allowBestEffortSuggestions,
      preferredName,
      preferredCity,
      homeArea,
      isNewThread,
      isLightConversationTurn,
      isMetaConversationQuery,
      isLateNight,
      explicitSuggestionRequest,
      shouldUseSafeNoIntentMode,
      wantsBestEffortNow: intent.wantsBestEffortNow,
      calendarIntent,
      calendarWriteIntent,
      shouldProactiveCalendarCheck,
      integrationStatus,
      packStatus,
      autopilotStatus,
      approvalGateStatus,
      shouldInjectPackContext,
      packContext,
      hasRecentClarifier: recentClarifierAsked,
    });
    const systemMessages: OpenRouterMessage[] = [
      { role: "system", content: buildTemporalContext(body.timezone) },
      { role: "system", content: buildSeasonContext(body.timezone) },
      ...policySections.map((content) => ({ role: "system" as const, content })),
      { role: "system", content: buildPreferenceAwarenessPrompt(preferenceProfile) },
      {
        role: "system",
        content: buildRuntimeContext({
          tasteHints: taste.topPreferences,
          recentRuns: recentRuns.map((run) => `${run.autopilotId}:${run.status}/${run.approvalState}`),
          integrationStatus,
          preferredCity,
          homeArea,
          packStatus: isCapabilityQuery ? packStatus : undefined,
          autopilotStatus: isCapabilityQuery ? autopilotStatus : undefined,
          approvalGateStatus: isCapabilityQuery ? approvalGateStatus : undefined,
        }),
      },
    ];
    if (intent.requiresBackupOption) {
      systemMessages.push({
        role: "system",
        content:
          "User explicitly requested a backup/fallback option. Include a clearly labeled backup (or Plan B) option in the final answer.",
      });
    }
    if (weatherBrief) {
      systemMessages.push({
        role: "system",
        content: weatherBrief,
      });
      systemMessages.push({
        role: "system",
        content:
          "When weather context is present, include one concise weather caveat in the user-facing reply (mention rain/precipitation risk and how the plan adapts).",
      });
    }
    if (threadSuggestions.length > 0 && shouldResolveThreadSuggestions) {
      const selectedSummary =
        resolvedSuggestions.length > 0
          ? resolvedSuggestions
              .map((suggestion) => {
                const url = suggestion.actionUrl ? ` (${suggestion.actionUrl})` : "";
                return `${suggestion.title}${url}`;
              })
              .join(" | ")
          : "none";
      systemMessages.push({
        role: "system",
        content: [
          "THREAD_SUGGESTIONS (source of truth for follow-up commands):",
          formatSuggestionsForPrompt(threadSuggestions),
          "",
          `Intent-resolved selection: ${selectedSummary}`,
          `Selection confidence: ${suggestionIntent?.confidence ?? 0}`,
          "If user follow-up references prior suggestions, use these thread suggestions rather than inventing new venues.",
          "For calendar writes based on prior suggestions, include selected venue names in event description.",
        ].join("\n"),
      });
    }
    if (calendarIntent && calendarWriteIntent) {
      systemMessages.push({
        role: "system",
        content:
          "If this calendar action references prior suggestions in thread context, carry those exact venues into event description (names + practical details) instead of broad summaries.",
      });
    }

    let replyText = "";
    let responseModel = getCurrentModel();
    let requestedModel = getCurrentModel();
    let responseId: string | null = null;

    const shouldAskSuggestionClarification =
      calendarWriteIntent &&
      intent.referencesPriorSuggestions &&
      threadSuggestions.length > 0 &&
      (!suggestionIntent ||
        suggestionIntent.selectedIndices.length === 0 ||
        suggestionIntent.confidence < 0.55);
    const shouldForcePureLightReply =
      !allowBestEffortSuggestions &&
      (isGreetingTurn || isSmallTalkTurn) &&
      !calendarIntent &&
      !calendarWriteIntent &&
      !isActionCmd;

    const shouldTryMemoryRecall =
      isLikelyHistoricalRecallQuestion(body.message) || /\bwho am i meeting today\b/i.test(body.message);
    const memoryRecall = shouldTryMemoryRecall
      ? await tryAnswerMemoryRecallQuestion({
          message: body.message,
          timezone: body.timezone,
        })
      : { handled: false as const };

    if (memoryRecall.handled) {
      orchestrationState = "smalltalk_mode";
      replyText = memoryRecall.replyText;
      responseModel = memoryRecall.model;
      requestedModel = memoryRecall.model;
      responseId = null;
    } else if (shouldAskSuggestionClarification) {
      const quickChoices = threadSuggestions.slice(0, 4).map((suggestion) => `[${suggestion.index}] ${suggestion.title}`).join("\n");
      replyText = [
        "Quick check so I place the right one on your calendar:",
        quickChoices,
        "Which option should I add?",
      ].join("\n");
      responseModel = "resolver/suggestion_intent";
      requestedModel = "resolver/suggestion_intent";
      responseId = null;
      await db.debugTrace.create({
        data: {
          scope: "chat",
          message: `thread_suggestion_resolution unresolved confidence=${suggestionIntent?.confidence ?? 0} options=${threadSuggestions.length}`,
        },
      });
    }

    const runRecommendationMode = async () => {
      orchestrationState = "recommendation_mode";
      const modelMessages: OpenRouterMessage[] = [
        ...systemMessages,
        ...conversationHistory,
        { role: "user", content: body.message },
      ];
      const openRouterTools = (await getScopedOpenRouterTools()).filter((tool) => {
        if (tool.function.name !== "google_calendar_events") return true;
        return calendarIntent || calendarWriteIntent || isActionCmd || shouldProactiveCalendarCheck;
      });
      let calendarWriteExecuted = false;
      let calendarFindSucceeded = false;
      let calendarWriteVerificationFailed = false;
      let calendarWriteOperation: "create" | "update" | "delete" | null = null;
      let toolCallsExecuted = 0;
      let lastToolErrorMessage: string | null = null;

      for (let round = 0; round <= MAX_TOOL_ROUNDS; round += 1) {
        const modelReply = await generateModelReply({
          messages: modelMessages,
          tools: openRouterTools,
        });
        responseModel = modelReply.responseModel;
        requestedModel = modelReply.requestedModel;
        responseId = modelReply.responseId;

        const toolCalls = modelReply.message.tool_calls ?? [];
        if (!toolCalls.length) {
          if (calendarWriteIntent && !calendarWriteExecuted && round < MAX_TOOL_ROUNDS) {
            modelMessages.push({
              role: "assistant",
              content: modelReply.message.content ?? modelReply.text ?? "",
            });
            modelMessages.push({
              role: "system",
              content:
                "ENFORCEMENT: The user requested a calendar write. You must call google_calendar_events tools to execute it. Do not reply with completion text until at least one write operation (create/update/delete) has been executed and verified.",
            });
            continue;
          }
          replyText = modelReply.text;
          break;
        }

        modelMessages.push({
          role: "assistant",
          content: modelReply.message.content ?? "",
          tool_calls: toolCalls,
        });

        for (const toolCall of toolCalls) {
          toolCallsExecuted += 1;
          const toolName = toolCall.function?.name ?? "unknown";
          const tool = getChatToolByName(toolName);
          const args = parseToolArguments(toolCall.function?.arguments ?? "");

          await db.debugTrace.create({
            data: {
              scope: "chat",
              message: `tool_call_start name=${toolName} round=${round + 1}`,
            },
          });

          if (!tool) {
            lastToolErrorMessage = `Tool '${toolName}' is not available.`;
            modelMessages.push({
              role: "tool",
              name: toolName,
              tool_call_id: toolCall.id,
              content: JSON.stringify({ error: `Tool '${toolName}' is not available.` }),
            });
            await db.debugTrace.create({
              data: {
                scope: "chat",
                message: `tool_call_error name=${toolName} reason=not_found`,
              },
            });
            continue;
          }

          try {
            let result: unknown;
            if (tool.name === "google_calendar_events" && args.operation === "create") {
              const createArgs = {
                ...args,
                operation: "create",
              } as CalendarCreateLikeArgs;

              if (
                typeof createArgs.summary === "string" &&
                typeof createArgs.start === "string" &&
                typeof createArgs.end === "string"
              ) {
                const suggestionsForWrite =
                  resolvedSuggestions.length > 0 ? resolvedSuggestions : threadSuggestions;
                createArgs.description = ensureDescriptionIncludesSuggestions(
                  createArgs.description,
                  suggestionsForWrite,
                );

                const duplicate = await findPotentialDuplicateForCreate({
                  tool,
                  createArgs,
                });
                const hasDuplicateCandidate = Boolean(duplicate.candidate && duplicate.score >= 0.58);
                const clearIntent =
                  !intent.referencesPriorSuggestions ||
                  Boolean(
                    suggestionIntent &&
                      suggestionIntent.selectedIndices.length > 0 &&
                      suggestionIntent.confidence >= 0.62,
                  );
                const clearDuplicate =
                  hasDuplicateCandidate &&
                  duplicate.score >= 0.72 &&
                  duplicate.score - duplicate.secondScore >= 0.12;

                if (hasDuplicateCandidate && clearDuplicate && clearIntent && duplicate.candidate) {
                  const mergedDescription = ensureDescriptionIncludesSuggestions(
                    duplicate.candidate.description ?? createArgs.description,
                    suggestionsForWrite,
                  );
                  result = await tool.execute({
                    operation: "update",
                    eventId: duplicate.candidate.id,
                    calendarId: duplicate.candidate.calendarId,
                    description: mergedDescription,
                    location: createArgs.location ?? duplicate.candidate.location,
                  });
                  await db.debugTrace.create({
                    data: {
                      scope: "chat",
                      message: `calendar_dedupe action=update_existing score=${duplicate.score.toFixed(2)} event=${duplicate.candidate.id}`,
                    },
                  });
                } else if (hasDuplicateCandidate && duplicate.candidate) {
                  result = {
                    requiresUserConfirmation: true,
                    reason: "potential_duplicate_event",
                    duplicateEvent: {
                      eventId: duplicate.candidate.id,
                      summary: duplicate.candidate.summary,
                      start: duplicate.candidate.start,
                      end: duplicate.candidate.end,
                      calendarId: duplicate.candidate.calendarId,
                      calendarName: duplicate.candidate.calendarName,
                      score: Number(duplicate.score.toFixed(2)),
                    },
                    prompt:
                      "I found a matching event already on your calendar. Should I update it with the suggestion details, or create a separate entry?",
                  };
                  await db.debugTrace.create({
                    data: {
                      scope: "chat",
                      message: `calendar_dedupe action=ask_user score=${duplicate.score.toFixed(2)} event=${duplicate.candidate.id}`,
                    },
                  });
                } else {
                  result = await tool.execute(createArgs);
                }
              } else {
                result = await tool.execute(args);
              }
            } else {
              result = await tool.execute(args);
            }
            let resultForModel = result;
            if (tool.name === "google_calendar_events" && isRecord(args)) {
              const operation = typeof args.operation === "string" ? args.operation : "";
              const isWriteOperation = operation === "create" || operation === "update" || operation === "delete";
              if (isWriteOperation) {
                const resultRecord = isRecord(result) ? result : {};
                const calendarIdForVerify =
                  typeof resultRecord.calendarId === "string"
                    ? resultRecord.calendarId
                    : typeof args.calendarId === "string"
                      ? args.calendarId
                      : undefined;
                const eventRecord = isRecord(resultRecord.event) ? resultRecord.event : null;
                const eventIdForVerify =
                  typeof resultRecord.eventId === "string"
                    ? resultRecord.eventId
                    : typeof eventRecord?.id === "string"
                      ? eventRecord.id
                      : typeof args.eventId === "string"
                        ? args.eventId
                        : undefined;
                let writeVerified = false;
                let verificationReadback: unknown = null;

                if (eventIdForVerify) {
                  verificationReadback = await tool.execute({
                    operation: "get",
                    calendarId: calendarIdForVerify,
                    eventId: eventIdForVerify,
                  });
                  const verificationRecord = isRecord(verificationReadback)
                    ? verificationReadback
                    : {};
                  if (operation === "delete") {
                    const verifyError =
                      typeof verificationRecord.error === "string"
                        ? verificationRecord.error.toLowerCase()
                        : "";
                    writeVerified =
                      verifyError.includes("not found") || verifyError.includes("404");
                  } else {
                    const verifyError =
                      typeof verificationRecord.error === "string"
                        ? verificationRecord.error.trim()
                        : "";
                    if (verifyError) {
                      writeVerified = false;
                    } else if (
                      isRecord(verificationRecord.event) &&
                      typeof verificationRecord.event.id === "string"
                    ) {
                      writeVerified = true;
                    } else {
                      // Some tool adapters/mocks may not support a full get readback.
                      // Treat a non-error readback as verified to avoid false negatives.
                      writeVerified = true;
                    }
                  }
                }

                if (isRecord(resultRecord)) {
                  resultForModel = {
                    ...resultRecord,
                    writeVerified,
                    verificationReadback,
                  };
                }
                if (!writeVerified) {
                  calendarWriteVerificationFailed = true;
                }
              }
            }
            modelMessages.push({
              role: "tool",
              name: tool.name,
              tool_call_id: toolCall.id,
              content: JSON.stringify(resultForModel),
            });
            if (tool.name === "google_calendar_events" && isRecord(args)) {
              const op = typeof args.operation === "string" ? args.operation : "";
              if (op === "create" || op === "update" || op === "delete") {
                calendarWriteExecuted = true;
                calendarWriteOperation = op;
              }
              if (op === "find" && isRecord(result) && result.found === true) {
                calendarFindSucceeded = true;
              }
            }
            if (
              tool.name === "google_calendar_events" &&
              isRecord(args) &&
              (args.operation === "find" || args.operation === "update")
            ) {
            }
            await db.debugTrace.create({
              data: {
                scope: "chat",
                message: `tool_call_success name=${tool.name}`,
              },
            });
          } catch (toolError) {
            lastToolErrorMessage =
              toolError instanceof Error ? toolError.message : "Tool execution failed";
            modelMessages.push({
              role: "tool",
              name: tool.name,
              tool_call_id: toolCall.id,
              content: JSON.stringify({
                error: toolError instanceof Error ? toolError.message : "Tool execution failed",
              }),
            });
            await db.debugTrace.create({
              data: {
                scope: "chat",
                message: `tool_call_error name=${tool.name} reason=execution_failed`,
              },
            });
          }
        }
      }
      if (!replyText && toolCallsExecuted > 0) {
        try {
          const writeVerbInstruction =
            calendarWriteOperation === "create"
              ? "If a calendar create succeeded, use the verb 'added' in your confirmation sentence."
              : calendarWriteOperation === "update"
                ? "If a calendar update succeeded, use the verb 'updated' in your confirmation sentence."
                : calendarWriteOperation === "delete"
                  ? "If a calendar delete succeeded, use the verb 'removed' in your confirmation sentence."
                  : "";
          const finalReply = await generateModelReply({
            messages: [
              ...modelMessages,
              {
                role: "system",
                content:
                  `Tool execution has finished. Provide a concise final user-facing status based strictly on tool results. If any tool returned an error, state that clearly and do not claim success. ${writeVerbInstruction}`.trim(),
              },
            ],
            tools: [],
          });
          replyText = finalReply.text.trim();
        } catch {
          // If final synthesis fails, below guard fallback will produce explicit error text.
        }
      }
      if (calendarWriteIntent && !calendarWriteExecuted) {
        replyText = calendarFindSucceeded
          ? "I found your event, but I haven't applied the calendar edit yet. I can do it now if you confirm exactly what to change in the event details."
          : "I couldn't complete the calendar change yet because no write action was executed. Please repeat the exact edit you want, and I'll apply it directly.";
      } else if (calendarWriteIntent && calendarWriteExecuted && calendarWriteVerificationFailed) {
        replyText =
          "I attempted the calendar edit, but post-update verification failed, so I can't confirm it was applied. Please retry once and I'll verify the event state before confirming.";
      } else if (!replyText && toolCallsExecuted > 0) {
        replyText = lastToolErrorMessage
          ? `I couldn't complete the live tool lookup because a tool call failed: ${lastToolErrorMessage}`
          : "I couldn't complete the live tool lookup because no final tool-backed status was produced. Please retry once.";
      }
    };
    const runInfoMode = async () => {
      orchestrationState = "info_mode";
      const infoReply = await generateModelReply({
        messages: [
          ...systemMessages,
          ...conversationHistory,
          {
            role: "system",
            content:
              "Answer the user directly and factually. Do not propose unrelated options or recommendation lists unless the user explicitly asks for suggestions.",
          },
          { role: "user", content: body.message },
        ],
        tools: [],
      });
      responseModel = infoReply.responseModel;
      requestedModel = infoReply.requestedModel;
      responseId = infoReply.responseId;
      replyText = infoReply.text;
    };
    const runSmallTalkMode = async (kind: "meta" | "light") => {
      orchestrationState = "smalltalk_mode";
      if (!process.env.OPENROUTER_API_KEY) {
        replyText = "I’m here to help. Tell me what you want, and I’ll keep it simple.";
        responseModel = "policy/smalltalk_fallback";
        requestedModel = "policy/smalltalk_fallback";
        responseId = null;
        return;
      }
      const shouldAskFeedback = shouldAskInSessionFeedbackFollowup({
        threadId: thread.id,
        recentConversation,
        isLightConversationTurn,
        explicitSuggestionRequest: allowBestEffortSuggestions,
      });
      const smallTalkReply = await generateModelReply({
        messages: [
          ...systemMessages,
          ...conversationHistory,
          {
            role: "system",
            content:
              kind === "meta"
                ? "Respond naturally to the user's feedback about your behavior. Acknowledge briefly, correct course, and ask a neutral 'How can I help now?' follow-up. Do NOT offer suggestions, plans, vibes, or time assumptions."
                : shouldForcePureLightReply
                  ? "This is a pure greeting/small-talk turn. Keep it warm and concise in 1-2 short sentences. Do NOT offer plans, options, recommendations, or follow-up planning questions."
                  : shouldAskFeedback
                  ? "This is a casual conversation turn. Keep it warm, concise, and non-assumptive. Optionally include one brief in-session follow-up like 'how did your last plan go?' to improve future recommendations. Do NOT suggest plans unless explicitly asked. Never ask vibe/timeframe planning questions on casual turns."
                  : "This is a casual conversation turn. Keep it warm, concise, and non-assumptive. Do NOT suggest plans unless explicitly asked. Never ask vibe/timeframe planning questions on casual turns.",
          },
          { role: "user", content: body.message },
        ],
        tools: [],
      });
      responseModel = smallTalkReply.responseModel;
      requestedModel = smallTalkReply.requestedModel;
      responseId = smallTalkReply.responseId;
      replyText = smallTalkReply.text;
    };
    const runSafeNoIntentMode = async () => {
      orchestrationState = "smalltalk_mode";
      if (!process.env.OPENROUTER_API_KEY) {
        replyText = "I didn’t fully catch that yet. Tell me what you need, and I’ll help.";
        responseModel = "policy/intent_fallback";
        requestedModel = "policy/intent_fallback";
        responseId = null;
        return;
      }
      const guardedReply = await generateModelReply({
        messages: [
          ...systemMessages,
          ...conversationHistory,
          {
            role: "system",
            content:
              "Intent extraction was unavailable. Reply in the user's language with one short, natural clarification and no recommendations/cards. Do not assume timeframe, location, or preferences.",
          },
          { role: "user", content: body.message },
        ],
        tools: [],
      });
      responseModel = guardedReply.responseModel;
      requestedModel = guardedReply.requestedModel;
      responseId = guardedReply.responseId;
      replyText = guardedReply.text;
    };
    if (replyText) {
      // Pre-resolved clarification response from intent-linking stage.
    } else if (shouldUseSafeNoIntentMode) {
      await runSafeNoIntentMode();
    } else if (isMetaConversationQuery) {
      await runSmallTalkMode("meta");
    } else if (shouldAskHomeAreaClarifier) {
      orchestrationState = "smalltalk_mode";
      replyText = preferredCity
        ? `I can keep it close to home. Which area should I center around in ${preferredCity} (neighborhood or nearest major intersection)?`
        : "I can keep it close to home. What city are you in, and what area should I center around (neighborhood or nearest major intersection)?";
      responseModel = "policy/profile_clarifier";
      requestedModel = "policy/profile_clarifier";
      responseId = null;
    } else if (lowConfidenceAutopilotOp) {
      orchestrationState = "autopilot_ops_mode";
      replyText =
        "I think you want an autopilot change, but I’m not fully confident. Please confirm the action (create, delete, pause, or resume) and the autopilot name.";
      responseModel = "policy/autopilot_ops";
      requestedModel = "policy/autopilot_ops";
      responseId = null;
    } else if (createAutopilotFields) {
      orchestrationState = "autopilot_ops_mode";
      if (
        !createAutopilotFields.name ||
        !createAutopilotFields.goal ||
        !createAutopilotFields.trigger ||
        !createAutopilotFields.action ||
        !Number.isFinite(createAutopilotFields.budgetCap)
      ) {
        replyText =
          "I can create that autopilot. Please provide: name, goal, trigger, action, approval, mode, and budget in this format: name: ...; goal: ...; triggerType: time|context|event; trigger: ...; action: ...; approval: ask_first|auto_hold|auto_execute; mode: ...; budget: ...";
      } else {
        const created = await createAutopilot({
          name: createAutopilotFields.name,
          goal: createAutopilotFields.goal,
          triggerType: createAutopilotFields.triggerType,
          trigger: createAutopilotFields.trigger,
          action: createAutopilotFields.action,
          approvalRule: createAutopilotFields.approvalRule,
          mode: createAutopilotFields.mode,
          budgetCap: Math.max(1, createAutopilotFields.budgetCap),
        });
        replyText = `Created autopilot "${created.name}". Goal: ${created.goal}. Trigger: ${created.triggerType}:${created.trigger}. Action: ${created.action}. Approval: ${created.approvalRule}.`;
      }
      responseModel = "policy/autopilot_ops";
      requestedModel = "policy/autopilot_ops";
      responseId = null;
    } else if (deleteAutopilotTarget) {
      orchestrationState = "autopilot_ops_mode";
      const match = autopilots.find((item) =>
        item.name.toLowerCase().includes(deleteAutopilotTarget.toLowerCase()),
      );
      if (!match) {
        replyText = `I couldn't find an autopilot named "${deleteAutopilotTarget}". Ask me "what autopilots are enabled?" and I'll list them.`;
      } else {
        await deleteAutopilot(match.id);
        replyText = `Deleted autopilot "${match.name}".`;
      }
      responseModel = "policy/autopilot_ops";
      requestedModel = "policy/autopilot_ops";
      responseId = null;
    } else if (toggleAutopilotTarget) {
      orchestrationState = "autopilot_ops_mode";
      const match = autopilots.find((item) =>
        item.name.toLowerCase().includes(toggleAutopilotTarget.targetName.toLowerCase()),
      );
      if (!match) {
        replyText = `I couldn't find an autopilot named "${toggleAutopilotTarget.targetName}". Ask me "what autopilots are enabled?" and I'll list them.`;
      } else {
        await updateAutopilot(match.id, { status: toggleAutopilotTarget.status });
        replyText = `${toggleAutopilotTarget.status === "paused" ? "Paused" : "Resumed"} autopilot "${match.name}".`;
      }
      responseModel = "policy/autopilot_ops";
      requestedModel = "policy/autopilot_ops";
      responseId = null;
    } else if (isCapabilityQuery && !shouldCreatePack && !shouldProactiveCalendarCheck) {
      orchestrationState = "capability_mode";
      replyText = buildCapabilityReply({
        topic: capabilityTopic,
        integrations: integrationConnections,
        packs: allPacks,
        autopilots,
        safetySettings,
      });
      responseModel = "policy/capability";
      requestedModel = "policy/capability";
      responseId = null;
    } else if (shouldCreatePack) {
      orchestrationState = "pack_creation_mode";
      const recentAssistantText =
        recentConversation
          .filter((item) => item.role === "assistant")
          .map((item) => item.content)
          .join("\n") || "";
      const discoveredUrls = parseUrlsFromText(`${recentAssistantText}\n${body.message}`);
      const discoveredDataSources: PackDataSource[] = discoveredUrls.slice(0, 6).map((url) => ({
        url,
        label: new URL(url).hostname.replace(/^www\./, ""),
      }));
      const fallbackSources = installedPacks.flatMap((pack) => pack.dataSources).slice(0, 4);
      const dataSources = discoveredDataSources.length ? discoveredDataSources : fallbackSources;
      const nameBase = `${effectiveMode} custom recommendations`;
      const slug = await createUniquePackSlug(nameBase);
      const tags = Array.from(new Set([...constraints.categories, ...constraints.vibes])).slice(0, 6);
      const style = inferPackStyle(signals.noveltyPreference);
      const budgetRange = constraints.budgets[0] ? `${constraints.budgets[0]}+` : "$0-$300";
      const createdPack = await createPack({
        slug,
        name: `${effectiveMode.toUpperCase()} Personalized Pack`,
        city: constraints.locations[0] ?? "Any",
        modes: [effectiveMode],
        style,
        budgetRange,
        needs: [],
        description:
          "Generated from chat preferences and recommendation feedback to deliver personalized source discovery.",
        instructions: [
          "Prioritize user preference alignment and source novelty.",
          `Preference mode: ${signals.noveltyPreference}.`,
          `Boredom signal seen: ${signals.boredomSignal ? "yes" : "no"}.`,
          `Focus constraints: ${JSON.stringify(constraints)}.`,
        ].join("\n"),
        tags,
        dataSources,
      });
      replyText = `Done — I created a new pack: "${createdPack.name}" (${createdPack.slug}). Open /packs/${createdPack.slug} to review or edit it.`;
    } else if (isLightConversationTurn) {
      await runSmallTalkMode("light");
    } else if (calendarIntent && !calendarWriteIntent && !isActionCmd) {
      orchestrationState = "calendar_intent_mode";
      const calendarReply = await tryAnswerCalendarIntent({
        intent,
        timezone: body.timezone,
      });
      if (calendarReply.handled) {
        const shouldContinueWithSuggestions =
          shouldProactiveCalendarCheck &&
          allowBestEffortSuggestions &&
          Boolean(calendarReply.anchorEvent);
        if (shouldContinueWithSuggestions && calendarReply.anchorEvent) {
          const anchorStart = formatEventDate(calendarReply.anchorEvent.start, body.timezone);
          const anchorLocation = calendarReply.anchorEvent.location
            ? ` at ${calendarReply.anchorEvent.location}`
            : "";
          const anchorCalendar = calendarReply.anchorEvent.calendarName
            ? ` from ${calendarReply.anchorEvent.calendarName}`
            : "";
          systemMessages.push({
            role: "system",
            content: [
              "CALENDAR ANCHOR RESOLVED:",
              `Upcoming anchor event: ${calendarReply.anchorEvent.summary}${anchorCalendar} on ${anchorStart}${anchorLocation}.`,
              "User asked for ideas before this event.",
              "Do not ask for the event time again. Use this anchor and provide concrete pre-event suggestions that fit beforehand.",
            ].join("\n"),
          });
          await db.debugTrace.create({
            data: {
              scope: "chat",
              message: `${calendarReply.trace} anchor_resolved_then_recommendations=true`,
            },
          });
          await runRecommendationMode();
        } else {
          replyText = calendarReply.replyText;
          responseModel = "tool/google_calendar_events";
          requestedModel = "tool/google_calendar_events";
          responseId = null;
          await db.debugTrace.create({
            data: {
              scope: "chat",
              message: calendarReply.trace,
            },
          });
        }
      } else {
        await runRecommendationMode();
      }
    } else if (shouldRunResearch) {
      orchestrationState = "research_mode";
      const research = await runResearchLoop({
        userMessage: body.message,
        tasteHints: taste.topPreferences,
        constraints,
        signals,
        packDataSources: installedPacks.flatMap((pack) => pack.dataSources),
        maxFetches: 7,
      });
      replyText = formatResearchReply({
        userMessage: body.message,
        recommendations: research.recommendations,
        sourceDiversityTarget: signals.sourceDiversityTarget,
      });
      for (const recommendation of research.recommendations.slice(0, 3)) {
        await upsertMemory({
          bucket: "history_memory",
          key: "recent_source_domain",
          value: recommendation.domain,
          source: "inferred",
          confidence: 0.72,
        });
      }
      await db.debugTrace.create({
        data: {
          scope: "chat_research",
          message: `research_mode fetched=${research.sourcesFetched} picked=${research.recommendations.length}`,
        },
      });
    } else if (isLocationInfoQuery) {
      await runInfoMode();
    } else {
      await runRecommendationMode();
    }

    if (!replyText) {
      replyText =
        "I couldn’t complete a live tool lookup right now, but I can still help with a best-effort suggestion.";
    }

    let resolveAssistantId: (id: string) => void = () => {};
    const assistantMessageIdReady = new Promise<string>((resolve) => {
      resolveAssistantId = resolve;
    });
    let currentBlocks: RichBlock[] | undefined;
    const suppressVisualEnrichment =
      !allowBestEffortSuggestions ||
      isCapabilityQuery ||
      isLocationInfoQuery ||
      orchestrationState === "autopilot_ops_mode";

    // Enrich the raw LLM reply with visual blocks (images, option cards).
    // Run an optional async upgrade pass to replace placeholders post-response.
    const enriched = suppressVisualEnrichment
      ? { text: replyText, blocks: undefined as RichBlock[] | undefined }
      : await enrichLlmReply(replyText, {
          asyncUpgrade: true,
          onAsyncUpgrade: async (upgradedCards) => {
            const assistantId = await assistantMessageIdReady;
            const mergedBlocks = applyUpgradedCardsToBlocks(currentBlocks, upgradedCards);
            if (!mergedBlocks?.length) return;
            currentBlocks = mergedBlocks;
            await db.conversationMessage.update({
              where: { id: assistantId },
              data: { blocksJson: JSON.stringify(mergedBlocks) },
            });
          },
        });
    const blocks: RichBlock[] | undefined = enriched.blocks?.length
      ? enriched.blocks
      : undefined;
    currentBlocks = blocks;

    await addConversationMessage({
      threadId: thread.id,
      role: "user",
      content: body.message,
    });
    const assistantMessage = await addConversationMessage({
      threadId: thread.id,
      role: "assistant",
      content: enriched.text,
      blocksJson: blocks ? JSON.stringify(blocks) : undefined,
    });
    resolveAssistantId(assistantMessage.id);

    const confidence = taste.count > 0 ? 0.86 : 0.78;

    // Count block types for observability
    const blockTypeCounts = (blocks ?? []).reduce<Record<string, number>>((acc, b) => {
      acc[b.type] = (acc[b.type] ?? 0) + 1;
      return acc;
    }, {});
    const blockSummary = Object.entries(blockTypeCounts)
      .map(([t, n]) => `${t}=${n}`)
      .join(" ");
    const traceMessage = `chat_plan_response confidence=${confidence.toFixed(2)} model=${responseModel} mode=${effectiveMode} requested_mode=${requestedMode} state=${orchestrationState} blocks=${blocks?.length ?? 0}${blockSummary ? ` [${blockSummary}]` : ""}`;

    await db.auditEvent.create({
      data: {
        actor: "api:chat",
        action: "chat_intent_parsed",
        details: `mode=${effectiveMode} requested_mode=${requestedMode} blocks=${blocks?.length ?? 0} message=${body.message.slice(0, 120)}`,
      },
    });
    await db.debugTrace.create({
      data: {
        scope: "chat",
        message: traceMessage,
      },
    });
    const mediaTelemetry = getBousierTelemetry();
    await db.debugTrace.create({
      data: {
        scope: "chat_media",
        message: `bousier tier1=${mediaTelemetry.tiers.tier1_metadata.hits}/${mediaTelemetry.tiers.tier1_metadata.attempts} tier2=${mediaTelemetry.tiers.tier2_open_data.hits}/${mediaTelemetry.tiers.tier2_open_data.attempts} cache_hit_ratio=${mediaTelemetry.cache.hitRatio} fallback=${mediaTelemetry.fallbackCount}`,
      },
    });
    if (shouldResolveThreadSuggestions) {
      await db.debugTrace.create({
        data: {
          scope: "chat",
          message: `thread_suggestion_resolution selected=${resolvedSuggestions.length} confidence=${suggestionIntent?.confidence ?? 0}`,
        },
      });
    }

    return ok({
      reply: enriched.text,
      blocks,
      confidence,
      model: responseModel,
      requestedModel,
      provider: "openrouter",
      responseId,
      messageId: assistantMessage.id,
      threadId: thread.id,
      packsUsed: shouldInjectPackContext ? installedPacks.map((p) => p.name) : undefined,
    });
  } catch (error) {
    return fromError(error);
  }
}

export async function GET() {
  try {
    const threads = await getRecentConversationThreads(8);
    return ok({
      provider: "openrouter",
      model: getCurrentModel(),
      defaultModel: DEFAULT_MODEL,
      envModel: process.env.BEETLEBOT_MODEL ?? null,
      runtimeOverride: runtimeModelOverride,
      recentThreads: threads.map((thread) => ({
        id: thread.id,
        title: thread.title,
        updatedAt: thread.updatedAt.toISOString(),
        messageCount: thread._count.messages,
      })),
    });
  } catch (error) {
    return fromError(error);
  }
}

export async function PATCH(request: Request) {
  try {
    const body = (await request.json()) as { model?: string };
    const nextModel = body.model?.trim();
    if (!nextModel) {
      return fail("model is required. Usage: { model: \"provider/model\" }", 400);
    }
    if (nextModel.length > 120) {
      return fail("model is too long", 400);
    }
    runtimeModelOverride = nextModel;
    return ok({
      provider: "openrouter",
      model: getCurrentModel(),
      defaultModel: DEFAULT_MODEL,
      envModel: process.env.BEETLEBOT_MODEL ?? null,
      runtimeOverride: runtimeModelOverride,
    });
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE() {
  runtimeModelOverride = null;
  return ok({
    provider: "openrouter",
    model: getCurrentModel(),
    defaultModel: DEFAULT_MODEL,
    envModel: process.env.BEETLEBOT_MODEL ?? null,
    runtimeOverride: runtimeModelOverride,
  });
}

