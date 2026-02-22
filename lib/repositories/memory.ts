import { db } from "@/lib/db";
import { ensureSeedData } from "@/lib/repositories/seed";

export type RecommendationConstraints = {
  categories: string[];
  vibes: string[];
  locations: string[];
  budgets: string[];
  timeWindows: string[];
  dislikedSourcePatterns: string[];
};

export type RecommendationSignals = {
  noveltyPreference: "fresh" | "balanced" | "familiar";
  sourceDiversityTarget: number;
  boredomSignal: boolean;
};

const BUDGET_PATTERN = /(?:under|below|less than)\s*\$?\s*\d+[kK]?|(?:\$|usd)\s*\d+[kK]?/gi;
const TIME_WINDOW_PATTERN =
  /\b(today|tonight|tomorrow|this weekend|next weekend|this week|next week|friday|saturday|sunday|morning|afternoon|evening)\b/gi;

function unique(values: string[]) {
  return Array.from(new Set(values.map((v) => v.trim().toLowerCase()).filter(Boolean)));
}

function collectMatches(input: string, pattern: RegExp) {
  return unique(Array.from(input.matchAll(pattern), (m) => m[0] ?? ""));
}

export function extractRecommendationConstraints(input: { message: string; tasteHints?: string[] }) {
  const combined = `${input.message} ${(input.tasteHints ?? []).join(" ")}`.toLowerCase();
  const tokenSet = new Set(combined.split(/[^a-z0-9]+/g).filter(Boolean));

  const knownCategories = [
    "restaurant",
    "restaurants",
    "hotel",
    "hotels",
    "park",
    "parks",
    "museum",
    "museums",
    "cafe",
    "cafes",
    "coffee",
    "event",
    "events",
    "hike",
    "hiking",
    "spa",
    "concert",
    "concerts",
    "bar",
    "bars",
    "activity",
    "activities",
  ];
  const knownVibes = [
    "romantic",
    "cozy",
    "quiet",
    "energetic",
    "family",
    "outdoor",
    "indoor",
    "luxury",
    "budget",
    "chill",
    "spontaneous",
    "curated",
    "adventurous",
  ];
  const knownLocations = [
    "toronto",
    "vancouver",
    "montreal",
    "ottawa",
    "new york",
    "nyc",
    "london",
    "paris",
    "muskoka",
  ];
  const dislikedSourcePatterns = unique(
    Array.from(
      combined.matchAll(
        /\b(?:not|avoid|skip|exclude)\s+(?:from\s+)?([a-z0-9.\-]+\.[a-z]{2,}|tripadvisor|yelp|reddit|instagram|tiktok)\b/gi,
      ),
      (m) => m[1] ?? "",
    ),
  );

  return {
    categories: unique(knownCategories.filter((term) => tokenSet.has(term))),
    vibes: unique(knownVibes.filter((term) => tokenSet.has(term))),
    locations: unique(
      knownLocations.filter((term) =>
        term.includes(" ") ? combined.includes(term) : tokenSet.has(term),
      ),
    ),
    budgets: collectMatches(combined, BUDGET_PATTERN),
    timeWindows: collectMatches(combined, TIME_WINDOW_PATTERN),
    dislikedSourcePatterns,
  } satisfies RecommendationConstraints;
}

export function deriveRecommendationSignals(input: { message: string; tasteHints?: string[] }) {
  const message = input.message.toLowerCase();
  const hints = (input.tasteHints ?? []).join(" ").toLowerCase();
  const merged = `${message} ${hints}`;

  const boredomSignal = /\b(boring|same|standard|generic|usual|again|something new|fresh)\b/.test(
    merged,
  );
  const wantsFresh = /\b(new|fresh|original|surprise|discover|unusual|hidden gem)\b/.test(merged);
  const wantsFamiliar = /\b(usual|familiar|safe|predictable|same as before)\b/.test(merged);

  const noveltyPreference = wantsFresh
    ? "fresh"
    : wantsFamiliar
      ? "familiar"
      : "balanced";

  const sourceDiversityTarget =
    noveltyPreference === "fresh" ? 4 : noveltyPreference === "balanced" ? 3 : 2;

  return {
    noveltyPreference,
    sourceDiversityTarget,
    boredomSignal,
  } satisfies RecommendationSignals;
}

export async function listMemory(bucket?: string | null, source?: string | null) {
  await ensureSeedData();
  return db.memoryEntry.findMany({
    where: {
      bucket: bucket ?? undefined,
      source: source ?? undefined,
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function upsertMemory(data: {
  id?: string;
  bucket: string;
  key: string;
  value: string;
  source: string;
  confidence: number;
  ttl?: string;
  pinned?: boolean;
}) {
  if (data.id) {
    return db.memoryEntry.update({
      where: { id: data.id },
      data: {
        bucket: data.bucket,
        key: data.key,
        value: data.value,
        source: data.source,
        confidence: data.confidence,
        ttl: data.ttl ? new Date(data.ttl) : null,
        pinned: data.pinned ?? false,
      },
    });
  }

  return db.memoryEntry.create({
    data: {
      bucket: data.bucket,
      key: data.key,
      value: data.value,
      source: data.source,
      confidence: data.confidence,
      ttl: data.ttl ? new Date(data.ttl) : null,
      pinned: data.pinned ?? false,
    },
  });
}

export async function forgetMemory(id?: string, key?: string) {
  if (id) {
    return db.memoryEntry.delete({ where: { id } });
  }
  if (!key) return null;
  const match = await db.memoryEntry.findFirst({ where: { key } });
  if (!match) return null;
  return db.memoryEntry.delete({ where: { id: match.id } });
}

// ── Preference awareness ────────────────────────────────────────────────────
// Maps all memory buckets into a "known vs unknown" profile so the LLM knows
// what it still needs to learn about the user.

export type PreferenceProfile = {
  known: Record<string, string>;
  unknown: string[];
  totalEntries: number;
  isNewUser: boolean;
};

const PREFERENCE_DIMENSIONS: Array<{
  key: string;
  label: string;
  aliases: string[];
}> = [
  { key: "city", label: "home city or area", aliases: ["city", "location", "neighborhood", "home_city"] },
  { key: "home_area", label: "home area for nearby recommendations", aliases: ["home_area", "home", "near_home", "intersection", "postal_prefix"] },
  { key: "household", label: "who they usually plan with (partner, kids, friends, solo)", aliases: ["household", "family", "partner", "kids", "children"] },
  { key: "budget_range", label: "typical budget comfort zone", aliases: ["budget_range", "budget", "spending", "price_range"] },
  { key: "max_travel_minutes", label: "how far they're willing to travel", aliases: ["max_travel_minutes", "travel_time", "commute"] },
  { key: "transportation", label: "how they get around (car, transit, walking)", aliases: ["transportation", "transit", "car", "driving"] },
  { key: "dietary", label: "dietary needs or food preferences", aliases: ["dietary", "food_restrictions", "allergies", "diet"] },
  { key: "activity_vibe", label: "preferred vibe (adventurous, chill, cultural, outdoorsy)", aliases: ["activity_vibe", "vibe", "style_preference"] },
  { key: "favorite_cuisines", label: "favorite cuisines or restaurant styles", aliases: ["favorite_cuisines", "cuisines", "food_preference"] },
  { key: "favorite_activity", label: "favorite types of activities", aliases: ["favorite_activity", "activities", "hobbies"] },
  { key: "schedule_pattern", label: "typical availability (weekends, evenings, flexible)", aliases: ["schedule_pattern", "availability", "schedule"] },
];

export async function getPreferenceProfile(): Promise<PreferenceProfile> {
  const entries = await db.memoryEntry.findMany({
    where: {
      bucket: { in: ["profile_memory", "taste_memory", "logistics_memory"] },
    },
    orderBy: { createdAt: "desc" },
  });

  const known: Record<string, string> = {};
  const unknown: string[] = [];

  for (const dim of PREFERENCE_DIMENSIONS) {
    const match = entries.find((e) => {
      const entryKey = e.key.toLowerCase();
      return dim.aliases.some(
        (alias) => entryKey === alias || entryKey.includes(alias),
      );
    });
    if (match) {
      known[dim.label] = match.value;
    } else {
      unknown.push(dim.label);
    }
  }

  for (const entry of entries) {
    const alreadyCovered = PREFERENCE_DIMENSIONS.some((d) =>
      d.aliases.some(
        (alias) =>
          entry.key.toLowerCase() === alias ||
          entry.key.toLowerCase().includes(alias),
      ),
    );
    if (!alreadyCovered) {
      const label = entry.key.replace(/_/g, " ");
      if (!known[label]) {
        known[label] = entry.value;
      }
    }
  }

  return {
    known,
    unknown,
    totalEntries: entries.length,
    isNewUser: entries.length <= 2,
  };
}

export async function tasteProfile() {
  const entries = await db.memoryEntry.findMany({
    where: { bucket: "taste_memory" },
    orderBy: { createdAt: "desc" },
  });
  return {
    topPreferences: entries.slice(0, 5).map((entry) => entry.value),
    count: entries.length,
  };
}

export async function getPreferredCityFromMemory(): Promise<string | null> {
  const hit = await db.memoryEntry.findFirst({
    where: {
      bucket: "profile_memory",
      key: { in: ["city", "location", "home_city"] },
    },
    orderBy: { createdAt: "desc" },
  });
  const value = hit?.value?.trim();
  if (!value) return null;
  return value;
}

export async function getHomeAreaFromMemory(): Promise<string | null> {
  const hit = await db.memoryEntry.findFirst({
    where: {
      bucket: "profile_memory",
      key: { in: ["home_area", "near_home", "neighborhood", "postal_prefix"] },
    },
    orderBy: { createdAt: "desc" },
  });
  const value = hit?.value?.trim();
  if (!value) return null;
  return value;
}

