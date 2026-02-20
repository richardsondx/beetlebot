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
import { getIntegrationConnection } from "@/lib/repositories/integrations";
import {
  deriveRecommendationSignals,
  extractRecommendationConstraints,
  getPreferenceProfile,
  tasteProfile,
  upsertMemory,
} from "@/lib/repositories/memory";
import type { PreferenceProfile } from "@/lib/repositories/memory";
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

function buildCompanionPrompt(mode?: string, isAction = false) {
  const base = [
    "You are beetlebot 🪲, a brilliant life companion with the instincts of a world-class travel agent, event specialist, and local insider.",
    "You think like an expert concierge who builds a mental model of each client over time — every conversation makes you sharper and more attuned to what they'll love.",
    "",
    "CONVERSATIONAL STYLE:",
    "- Talk like a smart, well-connected friend — warm, concise, natural. Not a brochure.",
    "- Use short paragraphs. Only provide structured plans when explicitly asked.",
    "- When someone says hi or starts casual, match their energy. Be warm and meet them where they are — don't jump straight into planning mode.",
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
    "- If the user gives you a clear request with enough context, just answer. Don't interrogate.",
    "- Lead with value (a suggestion, an idea, a reaction) THEN ask — never lead with the question.",
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
    "- When you need to move, update, or delete a calendar event, ALWAYS use the google_calendar_events tool with operation 'find' first to resolve the event by name. It handles emoji prefixes, partial names, and fuzzy matching. Use the returned eventId and calendarId for the subsequent update/delete call.",
    "- NEVER give up after a single failed list query. The 'find' operation searches ALL calendars and uses fuzzy matching — use it.",
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
  ].join("\n");
  const modeHint = mode && MODE_HINTS[mode] ? `\n${MODE_HINTS[mode]}` : "";
  // Suppress the visual option-card format when the user is giving a direct action command.
  const visualHint =
    mode && VISUAL_MODES.has(mode) && !isAction ? `\n${VISUAL_SYSTEM_INSTRUCTION}` : "";
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

function buildPreferenceAwarenessPrompt(profile: PreferenceProfile): string {
  const lines: string[] = ["PREFERENCE AWARENESS:"];

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
      "- Never present a checklist or questionnaire. This should feel like a friend getting to know another friend.",
      "- When the user casually reveals info (mentions kids, a partner, a neighborhood), acknowledge it naturally and use it.",
    );
  }

  return lines.join("\n");
}

async function extractImplicitPreferences(message: string) {
  const extractions: Array<{ bucket: string; key: string; value: string }> = [];

  // Explicit preference statements: "I like/love/enjoy/prefer X"
  const prefMatches = message.matchAll(
    /\bi\s+(?:like|love|enjoy|prefer|adore)\s+(.{3,60}?)(?:\.|,|!|\band\b|$)/gi,
  );
  for (const match of prefMatches) {
    const value = match[1]?.trim();
    if (value && value.length > 2) {
      extractions.push({ bucket: "taste_memory", key: "explicit_preference", value });
    }
  }

  // Partner preference statements: "my wife/husband likes X"
  const partnerPrefMatches = message.matchAll(
    /\bmy\s+(?:wife|husband|partner|spouse|girlfriend|boyfriend)\s+(?:likes?|loves?|enjoys?|prefers?)\s+(.{3,60}?)(?:\.|,|!|$)/gi,
  );
  for (const match of partnerPrefMatches) {
    const value = match[1]?.trim();
    if (value && value.length > 2) {
      extractions.push({ bucket: "taste_memory", key: "partner_preference", value });
    }
  }

  // Household signal: partner
  if (/\bmy\s+(?:wife|husband|partner|spouse|girlfriend|boyfriend|fiancée?)\b/i.test(message)) {
    extractions.push({ bucket: "profile_memory", key: "household", value: "has partner" });
  }

  // Household signal: children
  if (/\bmy\s+(?:kids?|children|son|daughter|baby|toddler|little\s+ones?)\b/i.test(message)) {
    extractions.push({ bucket: "profile_memory", key: "household", value: "has children" });
  }

  // Location signals: "I'm in X", "I live in X", "we're in X"
  const locationMatch = message.match(
    /\b(?:i'?m\s+in|i\s+live\s+in|we'?re\s+in|based\s+in)\s+([A-Z][a-zA-Z\s]{2,30}?)(?:\.|,|!|$)/i,
  );
  if (locationMatch?.[1]) {
    extractions.push({ bucket: "profile_memory", key: "city", value: locationMatch[1].trim() });
  }

  // Budget signals
  const budgetMatch =
    message.match(/budget\s*(?:is|of|around)?\s*\$?\s*(\d+)/i) ??
    message.match(/under\s+\$?\s*(\d+)/i) ??
    message.match(/\$(\d+)\s*[-–]\s*\$?(\d+)/i);
  if (budgetMatch) {
    const value = budgetMatch[2]
      ? `$${budgetMatch[1]}-$${budgetMatch[2]}`
      : `under $${budgetMatch[1]}`;
    extractions.push({ bucket: "logistics_memory", key: "budget_range", value });
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
  /** Message references prior suggestions ("these", "this one", "that option", etc.). */
  referencesPriorSuggestions: boolean;
  /** Message is specifically about travel plans/trips. */
  isTravelQuery: boolean;
  /** Message asks for upcoming/next items. */
  isUpcomingQuery: boolean;
  /** Message asks for fresh/deep research rather than immediate execution. */
  isResearchRequest: boolean;
};

/**
 * Classifies the user's message intent via a fast, zero-temperature LLM call.
 * Providing the last assistant message as context improves accuracy when the
 * user uses pronouns ("add these", "book that one", etc.).
 */
async function classifyMessageIntent(
  message: string,
  lastAssistantMessage?: string,
): Promise<MessageIntent> {
  const fallback: MessageIntent = {
    isActionCommand: false,
    isCalendarWrite: false,
    isCalendarQuery: false,
    referencesPriorSuggestions: false,
    isTravelQuery: false,
    isUpcomingQuery: false,
    isResearchRequest: false,
  };
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return fallback;

  const contextLine = lastAssistantMessage
    ? `Previous assistant message (for context): """${lastAssistantMessage.slice(0, 300)}"""`
    : "";

  const prompt = [
    "Classify the user message below. Reply with valid JSON only — no prose, no markdown.",
    "",
    contextLine,
    `User message: """${message}"""`,
    "",
    "Return exactly:",
    '{ "isActionCommand": boolean, "isCalendarWrite": boolean, "isCalendarQuery": boolean, "referencesPriorSuggestions": boolean, "isTravelQuery": boolean, "isUpcomingQuery": boolean, "isResearchRequest": boolean }',
    "",
    "Definitions:",
    "isActionCommand  — true when the user wants to EXECUTE something (add to calendar, move/reschedule an event, book, confirm a choice, keep a suggestion, cancel something) rather than explore or get new ideas.",
    "isCalendarWrite  — true when the intent involves creating, editing, moving, fixing duplicates, merging, or removing a calendar event.",
    "isCalendarQuery — true when the user asks to read/check schedule info (calendar, meetings, upcoming events, next event, availability, free time).",
    "referencesPriorSuggestions — true when the user refers to options already shown (e.g. 'these', 'this one', 'that option', 'option 2', 'the first one').",
    "isTravelQuery — true when the user asks about travel/trips/vacation plans.",
    "isUpcomingQuery — true when the user asks for what is next/upcoming/coming soon.",
    "isResearchRequest — true when user asks for fresh/new/deep research or discovery from new sources.",
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
        max_tokens: 80,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) return fallback;

    const payload = (await response.json()) as OpenRouterResponse;
    const text = payload.choices?.[0]?.message?.content?.trim() ?? "";

    // Strip optional markdown fences before parsing
    const clean = text.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
    const parsed = JSON.parse(clean) as Partial<MessageIntent>;
    return {
      isActionCommand: Boolean(parsed.isActionCommand),
      isCalendarWrite: Boolean(parsed.isCalendarWrite),
      isCalendarQuery: Boolean(parsed.isCalendarQuery),
      referencesPriorSuggestions: Boolean(parsed.referencesPriorSuggestions),
      isTravelQuery: Boolean(parsed.isTravelQuery),
      isUpcomingQuery: Boolean(parsed.isUpcomingQuery),
      isResearchRequest: Boolean(parsed.isResearchRequest),
    };
  } catch {
    return fallback;
  }
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
    const clean = text.replace(/^```[a-z]*\n?/, "").replace(/\n?```$/, "").trim();
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
    await extractImplicitPreferences(body.message);
    const preferenceProfile = await getPreferenceProfile();
    const taste = await tasteProfile();
    const recentRuns = await db.autopilotRun.findMany({
      orderBy: { createdAt: "desc" },
      take: 3,
    });

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
    const signals = deriveRecommendationSignals({
      message: body.message,
      tasteHints: taste.topPreferences,
    });
    const shouldCreatePack = isPackCreationCommand(body.message);

    // Classify intent via LLM — run in parallel with the narrow regex checks.
    const lastAssistantMessage = recentConversation
      .filter((m) => m.role === "assistant")
      .at(-1)?.content;
    const [intent] = await Promise.all([
      classifyMessageIntent(body.message, lastAssistantMessage),
    ]);

    const isActionCmd = intent.isActionCommand;
    const calendarIntent = intent.isCalendarQuery || intent.isCalendarWrite;
    const calendarWriteIntent = intent.isCalendarWrite;
    const shouldRunResearch =
      !isActionCmd &&
      (signals.boredomSignal || intent.isResearchRequest);
    const threadSuggestions = extractThreadSuggestionsForIntent(recentConversation);
    const shouldResolveThreadSuggestions =
      threadSuggestions.length > 0 &&
      (intent.referencesPriorSuggestions || isActionCmd || calendarWriteIntent);
    // #region agent log
    fetch("http://127.0.0.1:7247/ingest/47f72c19-1052-41f0-8ef0-115f189fc319", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "calendar-routing",
        hypothesisId: "N1",
        location: "app/api/chat/route.ts:intent_resolution",
        message: "intent classification output",
        data: {
          isActionCommand: intent.isActionCommand,
          isCalendarWrite: intent.isCalendarWrite,
          isCalendarQuery: intent.isCalendarQuery,
          referencesPriorSuggestions: intent.referencesPriorSuggestions,
          isUpcomingQuery: intent.isUpcomingQuery,
          isResearchRequest: intent.isResearchRequest,
          derivedCalendarIntent: calendarIntent,
          derivedCalendarWriteIntent: calendarWriteIntent,
          messagePreview: body.message.slice(0, 120),
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
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

    const systemMessages: OpenRouterMessage[] = [
      { role: "system", content: buildTemporalContext(body.timezone) },
      { role: "system", content: buildSeasonContext(body.timezone) },
      { role: "system", content: buildCompanionPrompt(body.mode, isActionCmd) },
      { role: "system", content: buildPreferenceAwarenessPrompt(preferenceProfile) },
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
    if (isActionCmd) {
      systemMessages.push({
        role: "system",
        content:
          "CRITICAL: The user is issuing a direct action command. Execute it immediately using the appropriate tool. Do NOT generate new suggestions or option cards. Do NOT ask for time preferences if a time was given. Respond with 1–2 sentences confirming what was done.",
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
    if (calendarIntent) {
      if (calendarWriteIntent) {
        systemMessages.push({
          role: "system",
          content:
            "The user is asking to modify their calendar. To update or delete an existing event, FIRST call google_calendar_events with operation 'find' and the event name as query — this resolves emoji-prefixed titles and partial names. Then use the returned eventId and calendarId for the update/delete call. For new events use 'create'. If required fields are missing, ask one concise clarification question and do not switch to listing unrelated events. If this action references prior suggestions in thread context, carry those exact venues into description (names + practical details) instead of broad summaries. If a tool result returns { requiresUserConfirmation: true }, ask the user the provided prompt and do not perform additional calendar writes until they answer.",
        });
      } else {
        systemMessages.push({
          role: "system",
          content:
            "If the user explicitly asks for calendar data, retrieve it first with tools and answer directly. Do not ask for permission to check the calendar when they already asked you to check it.",
        });
      }
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

    if (shouldAskSuggestionClarification) {
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
      const openRouterTools = await getScopedOpenRouterTools();
      let calendarWriteExecuted = false;
      let calendarFindSucceeded = false;
      let calendarWriteVerificationFailed = false;
      let toolCallsExecuted = 0;
      let toolCallErrors = 0;
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
            // #region agent log
            fetch("http://127.0.0.1:7247/ingest/47f72c19-1052-41f0-8ef0-115f189fc319", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                runId: "calendar-enforcement",
                hypothesisId: "N4",
                location: "app/api/chat/route.ts:runRecommendationMode",
                message: "no tool call for calendar write intent; forcing tool usage retry",
                data: {
                  round: round + 1,
                  maxRounds: MAX_TOOL_ROUNDS + 1,
                  modelTextPreview: (modelReply.text ?? "").slice(0, 120),
                },
                timestamp: Date.now(),
              }),
            }).catch(() => {});
            // #endregion
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
          if (
            toolName === "google_calendar_events" &&
            isRecord(args) &&
            (args.operation === "find" || args.operation === "update")
          ) {
            // #region agent log
            fetch("http://127.0.0.1:7247/ingest/47f72c19-1052-41f0-8ef0-115f189fc319", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                runId: "calendar-find-miss",
                hypothesisId: "H1",
                location: "app/api/chat/route.ts:tool_call_pre_execute",
                message: "google_calendar_events call prepared",
                data: {
                  operation: args.operation,
                  query: typeof args.query === "string" ? args.query : null,
                  eventIdProvided: typeof args.eventId === "string" && args.eventId.trim().length > 0,
                  calendarIdProvided:
                    typeof args.calendarId === "string" && args.calendarId.trim().length > 0,
                  summaryProvided:
                    typeof args.summary === "string" && args.summary.trim().length > 0,
                  descriptionLength:
                    typeof args.description === "string" ? args.description.length : 0,
                  locationProvided:
                    typeof args.location === "string" && args.location.trim().length > 0,
                },
                timestamp: Date.now(),
              }),
            }).catch(() => {});
            // #endregion
          }

          await db.debugTrace.create({
            data: {
              scope: "chat",
              message: `tool_call_start name=${toolName} round=${round + 1}`,
            },
          });

          if (!tool) {
            toolCallErrors += 1;
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
                    writeVerified =
                      !verificationRecord.error &&
                      isRecord(verificationRecord.event) &&
                      typeof verificationRecord.event.id === "string";
                  }
                }

                // #region agent log
                fetch("http://127.0.0.1:7247/ingest/47f72c19-1052-41f0-8ef0-115f189fc319", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    runId: "calendar-posthook",
                    hypothesisId: "F2",
                    location: "app/api/chat/route.ts:post_write_verify",
                    message: "calendar write verification completed",
                    data: {
                      operation,
                      eventIdForVerify: eventIdForVerify ?? null,
                      calendarIdForVerify: calendarIdForVerify ?? null,
                      writeVerified,
                      verificationHasError:
                        isRecord(verificationReadback) &&
                        typeof verificationReadback.error === "string",
                    },
                    timestamp: Date.now(),
                  }),
                }).catch(() => {});
                // #endregion

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
              const resultRecord = isRecord(result) ? result : {};
              // #region agent log
              fetch("http://127.0.0.1:7247/ingest/47f72c19-1052-41f0-8ef0-115f189fc319", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  runId: "calendar-find-miss",
                  hypothesisId: "H4",
                  location: "app/api/chat/route.ts:tool_call_post_execute",
                  message: "google_calendar_events call completed",
                  data: {
                    operation: args.operation,
                    hasError: typeof resultRecord.error === "string",
                    found:
                      typeof resultRecord.found === "boolean"
                        ? resultRecord.found
                        : null,
                    strategy:
                      typeof resultRecord.strategy === "string"
                        ? resultRecord.strategy
                        : null,
                    confidence:
                      typeof resultRecord.confidence === "number"
                        ? resultRecord.confidence
                        : null,
                    closestCandidatesCount: Array.isArray(resultRecord.closestCandidates)
                      ? resultRecord.closestCandidates.length
                      : 0,
                  },
                  timestamp: Date.now(),
                }),
              }).catch(() => {});
              // #endregion
            }
            await db.debugTrace.create({
              data: {
                scope: "chat",
                message: `tool_call_success name=${tool.name}`,
              },
            });
          } catch (toolError) {
            toolCallErrors += 1;
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
          const finalReply = await generateModelReply({
            messages: [
              ...modelMessages,
              {
                role: "system",
                content:
                  "Tool execution has finished. Provide a concise final user-facing status based strictly on tool results. If any tool returned an error, state that clearly and do not claim success.",
              },
            ],
            tools: [],
          });
          replyText = finalReply.text.trim();
          // #region agent log
          fetch("http://127.0.0.1:7247/ingest/47f72c19-1052-41f0-8ef0-115f189fc319", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              runId: "lookup-fallback",
              hypothesisId: "N6",
              location: "app/api/chat/route.ts:runRecommendationMode",
              message: "generated final status after tool rounds",
              data: {
                toolCallsExecuted,
                toolCallErrors,
                replyLength: replyText.length,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
        } catch {
          // If final synthesis fails, below guard fallback will produce explicit error text.
        }
      }
      if (calendarWriteIntent && !calendarWriteExecuted) {
        // #region agent log
        fetch("http://127.0.0.1:7247/ingest/47f72c19-1052-41f0-8ef0-115f189fc319", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId: "calendar-write-guard",
            hypothesisId: "F1",
            location: "app/api/chat/route.ts:runRecommendationMode",
            message: "calendar write guard activated",
            data: {
              calendarFindSucceeded,
              calendarWriteExecuted,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
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
        // #region agent log
        fetch("http://127.0.0.1:7247/ingest/47f72c19-1052-41f0-8ef0-115f189fc319", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId: "lookup-fallback",
            hypothesisId: "N7",
            location: "app/api/chat/route.ts:runRecommendationMode",
            message: "explicit fallback reason emitted",
            data: {
              toolCallsExecuted,
              toolCallErrors,
              lastToolErrorMessage,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
      }
    };
    if (replyText) {
      // Pre-resolved clarification response from intent-linking stage.
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
    } else if (calendarIntent && !calendarWriteIntent) {
      // #region agent log
      fetch("http://127.0.0.1:7247/ingest/47f72c19-1052-41f0-8ef0-115f189fc319", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          runId: "calendar-routing",
          hypothesisId: "N1",
          location: "app/api/chat/route.ts:routing_branch",
          message: "entered calendar query branch",
          data: {
            calendarIntent,
            calendarWriteIntent,
            isActionCmd,
            messagePreview: body.message.slice(0, 120),
          },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
      // #endregion
      orchestrationState = "calendar_intent_mode";
      const calendarReply = await tryAnswerCalendarIntent({
        intent,
        timezone: body.timezone,
      });
      if (calendarReply.handled) {
        // #region agent log
        fetch("http://127.0.0.1:7247/ingest/47f72c19-1052-41f0-8ef0-115f189fc319", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            runId: "calendar-routing",
            hypothesisId: "N1",
            location: "app/api/chat/route.ts:routing_branch",
            message: "calendar query branch handled",
            data: {
              trace: calendarReply.trace,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
        // #endregion
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

