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
} from "@/lib/repositories/conversations";
import { getIntegrationConnection } from "@/lib/repositories/integrations";
import {
  deriveRecommendationSignals,
  extractRecommendationConstraints,
  tasteProfile,
  upsertMemory,
} from "@/lib/repositories/memory";
import { createPack, getInstalledPackInstructions, getPackBySlug } from "@/lib/repositories/packs";
import { enrichLlmReply } from "@/lib/chat/visual-enricher";
import type { RichBlock } from "@/lib/chat/rich-message";
import { getChatToolByName, getScopedOpenRouterTools } from "@/lib/tools/registry";
import { runResearchLoop } from "@/lib/chat/research-loop";
import { buildSeasonContext } from "@/lib/season/context";
import type { PackDataSource } from "@/lib/types";

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
When your reply includes 2–5 concrete suggestions (hotels, restaurants, activities, venues, destinations), respond ONLY with a JSON object — no markdown, no prose outside the JSON:
{
  "text": "<your conversational reply here — 1–3 short sentences>",
  "options": [
    {
      "title": "<place or item name>",
      "subtitle": "<one-sentence pitch>",
      "category": "<hotel|restaurant|park|activity|destination|experience>",
      "meta": { "price": "$120/night", "rating": "4.7 ★", "neighborhood": "Midtown" },
      "actionUrl": "<real booking or info URL if you know it, otherwise omit>",
      "sourceName": "<data source label, e.g. 'Google Hotels' or omit>"
    }
  ]
}
For the "meta" object include 2–4 concise key-value chips relevant to the category (price, rating, distance, duration, vibe, age-range, etc.).
If your reply does NOT include concrete suggestions (e.g. it's a clarifying question or a scheduling note), respond as plain conversational text — NOT JSON.
`.trim();

function buildCompanionPrompt(mode?: string) {
  const base = [
    "You are beetlebot 🪲, a supportive life companion.",
    "Keep responses concise, natural, and conversational.",
    "Use short paragraphs and avoid turning every answer into a formal action plan.",
    "Ask at most one helpful follow-up question when needed.",
    "If the user asks for a plan/checklist, then provide structure.",
    "NEVER repeat, echo, or reuse exact phrasing from your previous messages in the conversation history. Each reply must be fresh and forward-moving.",

    // Precision & following instructions
    "CRITICAL: Follow the user's instructions EXACTLY. When the user names a specific event, activity, restaurant, or place, schedule THAT EXACT thing — never substitute a different one.",
    "If the user says 'schedule #1' or 'I like 1', match it precisely to the numbered item you suggested.",
    "If anything is ambiguous, ASK — do not guess or swap in something else.",

    // Calendar behavior
    "When the user asks about schedule, meetings, free time, or calendar conflicts, call the google_calendar_events tool before answering.",
    "All events you create go to the '🪲 Managed Calendar' by default so the user can distinguish beetlebot-scheduled events from their own.",
    "Never claim bookings are confirmed unless explicitly approved and executed.",

    // Emoji in event titles
    "ALWAYS use a relevant emoji at the start of every calendar event title (e.g. '🎨 Art Exhibition at AGO', '⛸️ Family Skate at Nathan Phillips Square', '🍽️ Dinner at Alo Restaurant').",

    // Rich event descriptions
    "When creating calendar events, make the description RICH and HELPFUL. Include:",
    "- 📍 Full address / Google Maps link if possible",
    "- 💰 Price / cost info (free, $22/person, etc.)",
    "- 🕐 Suggested arrival time (e.g. 'Arrive 15 min early for parking')",
    "- 👕 Dress code or what to bring if relevant (e.g. 'Dress warm — it's outdoors', 'Bring skates or rent for $10')",
    "- 🅿️ Parking / transit tips if you know them",
    "- 🔗 Website or ticket link",
    "- 👨‍👩‍👦 Who it's good for (family, couples, solo, etc.)",
    "- Any other details that save the user from having to look things up on the day of the event.",
    "Think: 'What would make the user's life easier when they glance at this event 5 minutes before leaving the house?'",
  ].join("\n");
  const modeHint = mode && MODE_HINTS[mode] ? `\n${MODE_HINTS[mode]}` : "";
  const visualHint = mode && VISUAL_MODES.has(mode) ? `\n${VISUAL_SYSTEM_INSTRUCTION}` : "";
  return base + modeHint + visualHint;
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

function buildRuntimeContext(input: { tasteHints: string[]; recentRuns: string[] }) {
  const memoryContext = input.tasteHints.length
    ? `User taste hints: ${input.tasteHints.join(", ")}.`
    : "No explicit taste hints yet.";
  const runContext = input.recentRuns.length
    ? `Recent run states: ${input.recentRuns.join(" | ")}.`
    : "No recent run history.";
  return `${memoryContext}\n${runContext}`;
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
  | "needs_clarification"
  | "research_mode"
  | "recommendation_mode"
  | "pack_creation_mode"
  | "calendar_intent_mode";

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

function maybeNeedsClarification(input: {
  message: string;
  constraints: ReturnType<typeof extractRecommendationConstraints>;
}) {
  const trimmed = input.message.trim();
  if (trimmed.length >= 45) return false;
  const c = input.constraints;
  const hasSignals =
    c.categories.length > 0 ||
    c.locations.length > 0 ||
    c.budgets.length > 0 ||
    c.timeWindows.length > 0 ||
    c.vibes.length > 0;
  return !hasSignals;
}

function buildClarifyingQuestion() {
  return "I can find more original picks for you. Quick check: what city/area, budget range, and vibe should I optimize for?";
}

const CALENDAR_INTENT_REGEX =
  /\b(calendar|schedule|events?|free time|meeting|appointment|what'?s on my calendar)\b/i;
const TRAVEL_INTENT_REGEX =
  /\b(travel|trip|vacation|flight|hotel|getaway|travel plans?)\b/i;
const NEXT_LOOKUP_REGEX = /\b(next|upcoming|coming up|soon)\b/i;
const TRAVEL_QUERY = "travel trip vacation flight hotel getaway";

type CalendarToolEvent = {
  id: string;
  summary: string;
  description?: string;
  start: string;
  end: string;
  location?: string;
  htmlLink?: string;
  calendarId?: string;
  calendarName?: string;
  primary?: boolean;
};

function isCalendarIntentMessage(message: string) {
  return CALENDAR_INTENT_REGEX.test(message);
}

function isTravelIntentMessage(message: string) {
  return TRAVEL_INTENT_REGEX.test(message);
}

function isNextLookupMessage(message: string) {
  return NEXT_LOOKUP_REGEX.test(message);
}

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
      htmlLink: typeof raw.htmlLink === "string" ? raw.htmlLink : undefined,
      calendarId: typeof raw.calendarId === "string" ? raw.calendarId : undefined,
      calendarName: typeof raw.calendarName === "string" ? raw.calendarName : undefined,
      primary: typeof raw.primary === "boolean" ? raw.primary : undefined,
    });
  }
  return parsed;
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

function rankCalendarEvents(events: CalendarToolEvent[], message: string) {
  const isTravelIntent = isTravelIntentMessage(message);
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
  message: string;
  timezone?: string;
}) {
  if (!isCalendarIntentMessage(input.message)) {
    return { handled: false as const };
  }

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
  const travelIntent = isTravelIntentMessage(input.message);
  const nextLookup = isNextLookupMessage(input.message) || travelIntent;
  const windows = nextLookup ? [14, 90] : [90];
  const query = travelIntent ? TRAVEL_QUERY : undefined;

  let events: CalendarToolEvent[] = [];
  let windowUsed = windows[windows.length - 1];

  for (const window of windows) {
    const result = await tool.execute({
      operation: "list_multi",
      timeMin: baseTimeMin,
      timeMax: plusDaysIso(window),
      query,
      maxResultsPerCalendar: 30,
    });
    const parsed = parseCalendarToolEvents(result);
    if (parsed.length > 0) {
      events = parsed;
      windowUsed = window;
      break;
    }
    windowUsed = window;
  }

  const ranked = rankCalendarEvents(events, input.message);
  if (!ranked.length) {
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

async function buildClarifyingQuestionWithModel(input: {
  systemMessages: OpenRouterMessage[];
  conversationHistory: OpenRouterMessage[];
  userMessage: string;
}) {
  try {
    const modelReply = await generateModelReply({
      messages: [
        ...input.systemMessages,
        {
          role: "system",
          content:
            "The latest user request is underspecified. Ask exactly one concise clarifying question and do not provide recommendations yet.",
        },
        ...input.conversationHistory,
        { role: "user", content: input.userMessage },
      ],
    });
    const text = modelReply.text.trim();
    if (text) {
      return {
        text,
        responseModel: modelReply.responseModel,
        requestedModel: modelReply.requestedModel,
        responseId: modelReply.responseId,
      };
    }
  } catch {
    // Fall back to deterministic question when the model call fails.
  }

  const currentModel = getCurrentModel();
  return {
    text: buildClarifyingQuestion(),
    responseModel: currentModel,
    requestedModel: currentModel,
    responseId: null as string | null,
  };
}

function formatResearchReply(input: {
  recommendations: Awaited<ReturnType<typeof runResearchLoop>>["recommendations"];
  sourceDiversityTarget: number;
}) {
  if (!input.recommendations.length) {
    return "I dug for fresh sources but couldn't find strong matches yet. Share a city and budget and I will run a tighter discovery pass.";
  }
  const lines = input.recommendations.map((item, index) => {
    return `${index + 1}. ${item.title} — ${item.whyItFits} Source: ${item.sourceName} (${item.url})`;
  });
  return [
    `I ran a fresh-source research pass and prioritized diversity across at least ${input.sourceDiversityTarget} source domains.`,
    ...lines,
    "Tell me which one you prefer and I can go deeper on that lane.",
  ].join("\n");
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
    const taste = await tasteProfile();
    const recentRuns = await db.autopilotRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
    });

    if (body.message.toLowerCase().includes("i like ")) {
      const preference = body.message.slice(body.message.toLowerCase().indexOf("i like ") + 7).trim();
      if (preference.length > 1) {
        await upsertMemory({
          bucket: "taste_memory",
          key: "explicit_preference",
          value: preference,
          source: "user_input",
          confidence: 1,
        });
      }
    }

    const existingThread = body.threadId ? await getConversationThread(body.threadId) : null;
    const thread = existingThread ?? (await createConversationThread(body.message.slice(0, 100)));
    const recentConversation = await getConversationMessages(thread.id, CONVERSATION_HISTORY_LIMIT);
    const conversationHistory: OpenRouterMessage[] = recentConversation
      .filter((item) => item.role === "user" || item.role === "assistant" || item.role === "system")
      .map((item) => ({
        role: item.role as "user" | "assistant" | "system",
        content: item.content,
      }));

    const installedPacks = await getInstalledPackInstructions();
    const packContext = await buildPackContext(installedPacks);
    const constraints = extractRecommendationConstraints({
      message: body.message,
      tasteHints: taste.topPreferences,
    });
    const messageOnlyConstraints = extractRecommendationConstraints({
      message: body.message,
    });
    const signals = deriveRecommendationSignals({
      message: body.message,
      tasteHints: taste.topPreferences,
    });
    const shouldCreatePack = isPackCreationCommand(body.message);
    const calendarIntent = isCalendarIntentMessage(body.message);
    const shouldRunResearch =
      signals.boredomSignal ||
      /original|fresh|new sources?|deep research|discover/i.test(body.message);
    let orchestrationState: OrchestrationState = "recommendation_mode";

    const systemMessages: OpenRouterMessage[] = [
      { role: "system", content: buildTemporalContext(body.timezone) },
      { role: "system", content: buildSeasonContext(body.timezone) },
      { role: "system", content: buildCompanionPrompt(body.mode) },
      {
        role: "system",
        content: buildRuntimeContext({
          tasteHints: taste.topPreferences,
          recentRuns: recentRuns.map((run) => `${run.autopilotId}:${run.status}/${run.approvalState}`),
        }),
      },
    ];
    if (packContext) {
      systemMessages.push({ role: "system", content: packContext });
    }
    if (calendarIntent) {
      systemMessages.push({
        role: "system",
        content:
          "If the user explicitly asks for calendar data, retrieve it first with tools and answer directly. Do not ask for permission to check the calendar when they already asked you to check it.",
      });
    }

    let replyText = "";
    let responseModel = getCurrentModel();
    let requestedModel = getCurrentModel();
    let responseId: string | null = null;
    const runRecommendationMode = async () => {
      orchestrationState = "recommendation_mode";
      const modelMessages: OpenRouterMessage[] = [
        ...systemMessages,
        ...conversationHistory,
        { role: "user", content: body.message },
      ];
      const openRouterTools = await getScopedOpenRouterTools();

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
          replyText = modelReply.text;
          break;
        }

        modelMessages.push({
          role: "assistant",
          content: modelReply.message.content ?? "",
          tool_calls: toolCalls,
        });

        for (const toolCall of toolCalls) {
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
            const result = await tool.execute(args);
            modelMessages.push({
              role: "tool",
              name: tool.name,
              tool_call_id: toolCall.id,
              content: JSON.stringify(result),
            });
            await db.debugTrace.create({
              data: {
                scope: "chat",
                message: `tool_call_success name=${tool.name}`,
              },
            });
          } catch (toolError) {
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
    };
    if (shouldCreatePack) {
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
      const nameBase = `${body.mode ?? "explore"} custom recommendations`;
      const slug = await createUniquePackSlug(nameBase);
      const tags = Array.from(new Set([...constraints.categories, ...constraints.vibes])).slice(0, 6);
      const style = inferPackStyle(signals.noveltyPreference);
      const budgetRange = constraints.budgets[0] ? `${constraints.budgets[0]}+` : "$0-$300";
      const createdPack = await createPack({
        slug,
        name: `${(body.mode ?? "explore").toUpperCase()} Personalized Pack`,
        city: constraints.locations[0] ?? "Any",
        modes: [body.mode ?? "explore"],
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
    } else if (calendarIntent) {
      orchestrationState = "calendar_intent_mode";
      const calendarReply = await tryAnswerCalendarIntent({
        message: body.message,
        timezone: body.timezone,
      });
      if (calendarReply.handled) {
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
      } else {
        await runRecommendationMode();
      }
    } else if (maybeNeedsClarification({ message: body.message, constraints: messageOnlyConstraints })) {
      orchestrationState = "needs_clarification";
      const clarifying = await buildClarifyingQuestionWithModel({
        systemMessages,
        conversationHistory,
        userMessage: body.message,
      });
      replyText = clarifying.text;
      responseModel = clarifying.responseModel;
      requestedModel = clarifying.requestedModel;
      responseId = clarifying.responseId;
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
    } else {
      await runRecommendationMode();
    }

    if (!replyText) {
      replyText =
        "I couldn’t complete a live tool lookup right now, but I can still help with a best-effort suggestion.";
    }

    // Enrich the raw LLM reply with visual blocks (images, option cards)
    const enriched = await enrichLlmReply(replyText);
    const blocks: RichBlock[] | undefined = enriched.blocks?.length
      ? enriched.blocks
      : undefined;

    await addConversationMessage({
      threadId: thread.id,
      role: "user",
      content: body.message,
    });
    await addConversationMessage({
      threadId: thread.id,
      role: "assistant",
      content: enriched.text,
      blocksJson: blocks ? JSON.stringify(blocks) : undefined,
    });

    const confidence = taste.count > 0 ? 0.86 : 0.78;

    // Count block types for observability
    const blockTypeCounts = (blocks ?? []).reduce<Record<string, number>>((acc, b) => {
      acc[b.type] = (acc[b.type] ?? 0) + 1;
      return acc;
    }, {});
    const blockSummary = Object.entries(blockTypeCounts)
      .map(([t, n]) => `${t}=${n}`)
      .join(" ");
    const traceMessage = `chat_plan_response confidence=${confidence.toFixed(2)} model=${responseModel} mode=${body.mode ?? "none"} state=${orchestrationState} blocks=${blocks?.length ?? 0}${blockSummary ? ` [${blockSummary}]` : ""}`;

    await db.auditEvent.create({
      data: {
        actor: "api:chat",
        action: "chat_intent_parsed",
        details: `mode=${body.mode ?? "explore"} blocks=${blocks?.length ?? 0} message=${body.message.slice(0, 120)}`,
      },
    });
    await db.debugTrace.create({
      data: {
        scope: "chat",
        message: traceMessage,
      },
    });

    return ok({
      reply: enriched.text,
      blocks,
      confidence,
      model: responseModel,
      requestedModel,
      provider: "openrouter",
      responseId,
      threadId: thread.id,
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

