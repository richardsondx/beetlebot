import { db } from "@/lib/db";
import { decryptConnection, encryptConnectionFields } from "@/lib/repositories/integration-crypto";

const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_CALENDAR_API = "https://www.googleapis.com/calendar/v3";

type GoogleErrorPayload = {
  error?: string | { message?: string; code?: number; status?: string };
  error_description?: string;
  message?: string;
};

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
};

export type CalendarEventSummary = {
  id: string;
  status?: string;
  summary: string;
  description?: string;
  location?: string;
  htmlLink?: string;
  start: string;
  end: string;
};

export type CalendarAvailability = {
  calendarId: string;
  timeMin: string;
  timeMax: string;
  busy: Array<{ start: string; end: string }>;
  freeSlots: Array<{ start: string; end: string }>;
};

export type CalendarListEntry = {
  id: string;
  summary: string;
  description?: string;
  primary: boolean;
};

export type CreateCalendarEventInput = {
  summary: string;
  start: string;
  end: string;
  description?: string;
  location?: string;
  timeZone?: string;
  attendees?: string[];
  calendarId?: string;
};

export type UpdateCalendarEventInput = {
  eventId: string;
  summary?: string;
  start?: string;
  end?: string;
  description?: string;
  location?: string;
  timeZone?: string;
  attendees?: string[];
  calendarId?: string;
};

type GoogleAuthContext = {
  integrationId: string;
  calendarId: string;
  clientId: string;
  clientSecret: string;
  accessToken: string;
  refreshToken: string | null;
  tokenExpiresAt: Date | null;
};

function parseConfig(configJson?: string | null): Record<string, string> {
  if (!configJson) return {};
  try {
    return JSON.parse(configJson) as Record<string, string>;
  } catch {
    return {};
  }
}

function toIso(input: string, label: string): string {
  const parsed = new Date(input);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error(`Invalid ${label} datetime. Use ISO format.`);
  }
  return parsed.toISOString();
}

function parseGoogleError(payload: GoogleErrorPayload | null, fallback: string) {
  const nested = payload?.error;
  const nestedMessage = typeof nested === "string" ? nested : nested?.message;
  return String(
    payload?.error_description ??
      payload?.message ??
      nestedMessage ??
      fallback,
  );
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const payload = (await response.json().catch(() => null)) as GoogleErrorPayload | null;
  if (!response.ok) {
    throw new Error(parseGoogleError(payload, response.statusText));
  }
  return (payload ?? {}) as T;
}

async function getGoogleAuthContext(): Promise<GoogleAuthContext> {
  const raw = await db.integrationConnection.findUnique({
    where: { provider: "google_calendar" },
  });
  if (!raw || raw.status !== "connected") {
    throw new Error("Google Calendar is not connected.");
  }
  const integration = decryptConnection(raw);

  const config = parseConfig(integration.configJson);
  const clientId = config.clientId || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = config.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
  const calendarId = config.calendarId || "primary";

  if (!clientId || !clientSecret) {
    throw new Error("Missing Google OAuth client config.");
  }
  if (!integration.accessToken) {
    throw new Error("Google Calendar access token is missing.");
  }

  return {
    integrationId: integration.id,
    calendarId,
    clientId,
    clientSecret,
    accessToken: integration.accessToken,
    refreshToken: integration.refreshToken ?? null,
    tokenExpiresAt: integration.tokenExpiresAt ?? null,
  };
}

async function refreshGoogleAccessToken(ctx: GoogleAuthContext) {
  if (!ctx.refreshToken) {
    throw new Error("Google refresh token is missing. Please reconnect Google Calendar.");
  }
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ctx.clientId,
      client_secret: ctx.clientSecret,
      refresh_token: ctx.refreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });
  const payload = await parseJsonResponse<GoogleTokenResponse>(response);
  if (!payload.access_token) {
    throw new Error("Google token refresh did not return an access token.");
  }
  const tokenExpiresAt = payload.expires_in
    ? new Date(Date.now() + Number(payload.expires_in) * 1000)
    : null;

  await db.integrationConnection.update({
    where: { id: ctx.integrationId },
    data: encryptConnectionFields({
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token ?? ctx.refreshToken,
      tokenExpiresAt,
      lastCheckedAt: new Date(),
      lastError: null,
      status: "connected",
    }),
  });

  return {
    ...ctx,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token ?? ctx.refreshToken,
    tokenExpiresAt,
  };
}

async function withValidAccessToken() {
  let ctx = await getGoogleAuthContext();
  const shouldRefresh =
    ctx.tokenExpiresAt != null &&
    ctx.tokenExpiresAt.getTime() <= Date.now() + 60_000;

  if (shouldRefresh && ctx.refreshToken) {
    ctx = await refreshGoogleAccessToken(ctx);
  }
  return ctx;
}

async function calendarRequest<T>(
  path: string,
  init: RequestInit = {},
  options?: { retryOnUnauthorized?: boolean },
) {
  const retryOnUnauthorized = options?.retryOnUnauthorized ?? true;
  let ctx = await withValidAccessToken();
  let response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${ctx.accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (response.status === 401 && retryOnUnauthorized && ctx.refreshToken) {
    ctx = await refreshGoogleAccessToken(ctx);
    response = await fetch(`${GOOGLE_CALENDAR_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${ctx.accessToken}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
  }

  return parseJsonResponse<T>(response);
}

const MANAGED_CALENDAR_NAME = "🪲 Managed Calendar";

type GoogleCalendarListItem = {
  id?: string;
  summary?: string;
  description?: string;
  primary?: boolean;
};

type GoogleCalendarListResponse = {
  items?: GoogleCalendarListItem[];
};

let _managedCalendarIdCache: string | null = null;

async function findManagedCalendar(): Promise<string | null> {
  const payload = await calendarRequest<GoogleCalendarListResponse>(
    "/users/me/calendarList",
    { method: "GET" },
  );
  const match = (payload.items ?? []).find(
    (cal) => cal.summary === MANAGED_CALENDAR_NAME,
  );
  return match?.id ?? null;
}

async function createManagedCalendar(): Promise<string> {
  const payload = await calendarRequest<{ id?: string }>(
    "/calendars",
    {
      method: "POST",
      body: JSON.stringify({
        summary: MANAGED_CALENDAR_NAME,
        description: "Events scheduled by Beetlebot 🪲 — your life companion assistant.",
        timeZone: "America/Toronto",
      }),
    },
  );
  if (!payload.id) {
    throw new Error("Failed to create managed calendar — no ID returned.");
  }
  return payload.id;
}

export async function ensureManagedCalendar(): Promise<string> {
  if (_managedCalendarIdCache) return _managedCalendarIdCache;
  const existing = await findManagedCalendar();
  if (existing) {
    _managedCalendarIdCache = existing;
    return existing;
  }
  const created = await createManagedCalendar();
  _managedCalendarIdCache = created;
  return created;
}

export async function listGoogleCalendars() {
  const payload = await calendarRequest<GoogleCalendarListResponse>(
    "/users/me/calendarList",
    { method: "GET" },
  );
  const calendars: CalendarListEntry[] = [];
  for (const calendar of payload.items ?? []) {
    if (!calendar.id) continue;
    calendars.push({
      id: calendar.id,
      summary: calendar.summary ?? "(untitled calendar)",
      description: typeof calendar.description === "string" ? calendar.description : undefined,
      primary: Boolean(calendar.primary),
    });
  }

  return {
    count: calendars.length,
    calendars,
  };
}

function normalizeGoogleEvent(event: Record<string, unknown>): CalendarEventSummary | null {
  const id = typeof event.id === "string" ? event.id : null;
  const startObj =
    event.start && typeof event.start === "object"
      ? (event.start as Record<string, unknown>)
      : null;
  const endObj =
    event.end && typeof event.end === "object"
      ? (event.end as Record<string, unknown>)
      : null;
  const start =
    (typeof startObj?.dateTime === "string" ? startObj.dateTime : null) ||
    (typeof startObj?.date === "string" ? startObj.date : null);
  const end =
    (typeof endObj?.dateTime === "string" ? endObj.dateTime : null) ||
    (typeof endObj?.date === "string" ? endObj.date : null);

  if (!id || !start || !end) return null;

  return {
    id,
    status: typeof event.status === "string" ? event.status : undefined,
    summary: typeof event.summary === "string" ? event.summary : "(untitled)",
    description: typeof event.description === "string" ? event.description : undefined,
    location: typeof event.location === "string" ? event.location : undefined,
    htmlLink: typeof event.htmlLink === "string" ? event.htmlLink : undefined,
    start,
    end,
  };
}

export async function listGoogleCalendarEvents(input?: {
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  maxResults?: number;
  query?: string;
}) {
  const ctx = await getGoogleAuthContext();
  const calendarId = input?.calendarId || ctx.calendarId || "primary";
  const now = new Date();
  const timeMin = input?.timeMin ? toIso(input.timeMin, "timeMin") : now.toISOString();
  const timeMax = input?.timeMax
    ? toIso(input.timeMax, "timeMax")
    : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const maxResults = Math.min(Math.max(input?.maxResults ?? 20, 1), 100);

  const query = new URLSearchParams({
    singleEvents: "true",
    orderBy: "startTime",
    timeMin,
    timeMax,
    maxResults: String(maxResults),
  });
  if (input?.query) query.set("q", input.query);

  const payload = await calendarRequest<{ items?: Record<string, unknown>[] }>(
    `/calendars/${encodeURIComponent(calendarId)}/events?${query.toString()}`,
    { method: "GET" },
  );

  const events = (payload.items ?? [])
    .map(normalizeGoogleEvent)
    .filter((event): event is CalendarEventSummary => event != null);

  return {
    calendarId,
    timeMin,
    timeMax,
    count: events.length,
    events,
  };
}

export async function getGoogleCalendarEvent(input: { eventId: string; calendarId?: string }) {
  const ctx = await getGoogleAuthContext();
  const calendarId = input.calendarId || ctx.calendarId || "primary";
  const eventId = input.eventId?.trim();
  if (!eventId) throw new Error("eventId is required.");

  const payload = await calendarRequest<Record<string, unknown>>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "GET" },
  );
  const event = normalizeGoogleEvent(payload);
  if (!event) throw new Error("Google Calendar returned an invalid event payload.");

  return {
    calendarId,
    event,
  };
}

// ── Smart event resolution (fuzzy matching) ──────────────────────────────

export type ResolvedEvent = CalendarEventSummary & {
  calendarId: string;
  calendarName?: string;
  confidence: number;
};

export type ResolveCalendarEventInput = {
  query: string;
  timeMin?: string;
  timeMax?: string;
};

export type ResolveCalendarEventResult = {
  match: ResolvedEvent | null;
  candidates: ResolvedEvent[];
  strategy: "google_q" | "fuzzy_local";
};

function stripEmojis(text: string): string {
  return text
    .replace(
      /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2702}-\u{27B0}\u{200D}\u{20E3}\u{FE0F}]/gu,
      "",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);
}

function scoreEventMatch(query: string, eventSummary: string): number {
  const normQuery = stripEmojis(query).toLowerCase();
  const normSummary = stripEmojis(eventSummary).toLowerCase();

  if (!normQuery || !normSummary) return 0;

  // Exact substring match after emoji stripping — highest confidence
  if (normSummary.includes(normQuery) || normQuery.includes(normSummary)) {
    return 1.0;
  }

  const queryTokens = tokenize(normQuery);
  const summaryTokens = tokenize(normSummary);

  if (!queryTokens.length || !summaryTokens.length) return 0;

  // Every query token appears in the summary — very strong match
  const allQueryTokensPresent = queryTokens.every((qt) =>
    summaryTokens.some((st) => st.includes(qt) || qt.includes(st)),
  );
  if (allQueryTokensPresent) return 0.95;

  // Jaccard similarity on tokens
  const querySet = new Set(queryTokens);
  const summarySet = new Set(summaryTokens);
  let overlap = 0;
  for (const token of querySet) {
    for (const st of summarySet) {
      if (st.includes(token) || token.includes(st)) {
        overlap++;
        break;
      }
    }
  }
  const union = new Set([...querySet, ...summarySet]).size;
  const jaccard = union > 0 ? overlap / union : 0;

  // Partial token coverage: fraction of query tokens matched
  const coverage = queryTokens.length > 0 ? overlap / queryTokens.length : 0;

  return Math.min(jaccard * 0.5 + coverage * 0.5, 0.9);
}

export async function resolveCalendarEvent(
  input: ResolveCalendarEventInput,
): Promise<ResolveCalendarEventResult> {
  const now = new Date();
  const timeMin = input.timeMin
    ? toIso(input.timeMin, "timeMin")
    : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const timeMax = input.timeMax
    ? toIso(input.timeMax, "timeMax")
    : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const calendars = await listGoogleCalendars();
  // #region agent log
  fetch("http://127.0.0.1:7247/ingest/47f72c19-1052-41f0-8ef0-115f189fc319", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      runId: "calendar-find-miss",
      hypothesisId: "H3",
      location: "lib/calendar/google-calendar.ts:resolveCalendarEvent",
      message: "resolveCalendarEvent started",
      data: {
        calendarCount: calendars.count,
        queryLength: input.query.length,
        timeMin,
        timeMax,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  type AnnotatedEvent = CalendarEventSummary & {
    calendarId: string;
    calendarName?: string;
  };

  async function fetchAllFromCalendars(query?: string): Promise<AnnotatedEvent[]> {
    const results = await Promise.all(
      calendars.calendars.map(async (cal) => {
        const listed = await listGoogleCalendarEvents({
          calendarId: cal.id,
          timeMin,
          timeMax,
          maxResults: 50,
          query,
        });
        return listed.events.map((ev) => ({
          ...ev,
          calendarId: cal.id,
          calendarName: cal.summary,
        }));
      }),
    );
    return results.flat();
  }

  function scoreCandidates(events: AnnotatedEvent[]): ResolvedEvent[] {
    return events
      .map((ev) => ({
        ...ev,
        confidence: scoreEventMatch(input.query, ev.summary),
      }))
      .filter((ev) => ev.confidence > 0.2)
      .sort((a, b) => b.confidence - a.confidence);
  }

  // Pass 1: Google API q search
  const googleResults = await fetchAllFromCalendars(input.query);
  if (googleResults.length > 0) {
    const scored = scoreCandidates(googleResults);
    // #region agent log
    fetch("http://127.0.0.1:7247/ingest/47f72c19-1052-41f0-8ef0-115f189fc319", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: "calendar-find-miss",
        hypothesisId: "H2",
        location: "lib/calendar/google-calendar.ts:resolveCalendarEvent",
        message: "google_q scoring complete",
        data: {
          googleResultsCount: googleResults.length,
          scoredCount: scored.length,
          topConfidence: scored[0]?.confidence ?? null,
          topMatchedQueryTokens: scored[0]
            ? tokenize(stripEmojis(input.query).toLowerCase()).filter((qt) =>
                tokenize(stripEmojis(scored[0].summary).toLowerCase()).some(
                  (st) => st.includes(qt) || qt.includes(st),
                ),
              ).length
            : 0,
          queryTokenCount: tokenize(stripEmojis(input.query).toLowerCase()).length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
    if (scored.length > 0 && scored[0].confidence >= 0.5) {
      return {
        match: scored[0],
        candidates: scored.slice(0, 3),
        strategy: "google_q",
      };
    }
  }

  // Pass 2: Fetch ALL events (no q filter) and fuzzy match locally
  const allEvents = await fetchAllFromCalendars();
  const scored = scoreCandidates(allEvents);
  // #region agent log
  fetch("http://127.0.0.1:7247/ingest/47f72c19-1052-41f0-8ef0-115f189fc319", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      runId: "calendar-find-miss",
      hypothesisId: "H2",
      location: "lib/calendar/google-calendar.ts:resolveCalendarEvent",
      message: "fuzzy_local scoring complete",
      data: {
        allEventsCount: allEvents.length,
        scoredCount: scored.length,
        topConfidence: scored[0]?.confidence ?? null,
        secondConfidence: scored[1]?.confidence ?? null,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  if (scored.length > 0 && scored[0].confidence >= 0.5) {
    return {
      match: scored[0],
      candidates: scored.slice(0, 3),
      strategy: "fuzzy_local",
    };
  }

  return {
    match: null,
    candidates: scored.slice(0, 3),
    strategy: "fuzzy_local",
  };
}

export async function createGoogleCalendarEvent(input: CreateCalendarEventInput) {
  const managedId = await ensureManagedCalendar();
  const calendarId = input.calendarId || managedId;
  const start = toIso(input.start, "start");
  const end = toIso(input.end, "end");

  if (new Date(end) <= new Date(start)) {
    throw new Error("Event end must be later than start.");
  }

  const payload = await calendarRequest<Record<string, unknown>>(
    `/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      body: JSON.stringify({
        summary: input.summary,
        description: input.description,
        location: input.location,
        start: { dateTime: start, timeZone: input.timeZone },
        end: { dateTime: end, timeZone: input.timeZone },
        attendees: input.attendees?.map((email) => ({ email })),
      }),
    },
  );

  const event = normalizeGoogleEvent(payload);
  if (!event) throw new Error("Google Calendar returned an invalid event payload.");
  return { calendarId, event };
}

export async function updateGoogleCalendarEvent(input: UpdateCalendarEventInput) {
  const managedId = await ensureManagedCalendar();
  const calendarId = input.calendarId || managedId;
  const eventId = input.eventId?.trim();
  if (!eventId) throw new Error("eventId is required.");

  const patchBody: Record<string, unknown> = {};
  if (input.summary !== undefined) patchBody.summary = input.summary;
  if (input.description !== undefined) patchBody.description = input.description;
  if (input.location !== undefined) patchBody.location = input.location;
  if (input.attendees !== undefined) {
    patchBody.attendees = input.attendees.map((email) => ({ email }));
  }
  if (input.start !== undefined) {
    patchBody.start = { dateTime: toIso(input.start, "start"), timeZone: input.timeZone };
  }
  if (input.end !== undefined) {
    patchBody.end = { dateTime: toIso(input.end, "end"), timeZone: input.timeZone };
  }
  if (Object.keys(patchBody).length === 0) {
    throw new Error("No update fields provided.");
  }
  // #region agent log
  fetch("http://127.0.0.1:7247/ingest/47f72c19-1052-41f0-8ef0-115f189fc319", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      runId: "calendar-update-visibility",
      hypothesisId: "N2",
      location: "lib/calendar/google-calendar.ts:updateGoogleCalendarEvent",
      message: "calendar update request prepared",
      data: {
        calendarId,
        eventId,
        patchKeys: Object.keys(patchBody),
        descriptionLength:
          typeof patchBody.description === "string" ? patchBody.description.length : 0,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  const payload = await calendarRequest<Record<string, unknown>>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patchBody),
    },
  );

  const event = normalizeGoogleEvent(payload);
  if (!event) throw new Error("Google Calendar returned an invalid event payload.");
  // #region agent log
  fetch("http://127.0.0.1:7247/ingest/47f72c19-1052-41f0-8ef0-115f189fc319", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      runId: "calendar-update-visibility",
      hypothesisId: "N3",
      location: "lib/calendar/google-calendar.ts:updateGoogleCalendarEvent",
      message: "calendar update response received",
      data: {
        calendarId,
        eventId: event.id,
        summary: event.summary,
        descriptionLength:
          typeof event.description === "string" ? event.description.length : 0,
      },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  return { calendarId, event };
}

export async function deleteGoogleCalendarEvent(input: { eventId: string; calendarId?: string }) {
  const managedId = await ensureManagedCalendar();
  const calendarId = input.calendarId || managedId;
  const eventId = input.eventId?.trim();
  if (!eventId) throw new Error("eventId is required.");

  await calendarRequest<Record<string, unknown>>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    { method: "DELETE" },
  );

  return { calendarId, eventId, deleted: true };
}

export async function getGoogleCalendarAvailability(input?: {
  calendarId?: string;
  timeMin?: string;
  timeMax?: string;
  durationMinutes?: number;
}) {
  const ctx = await getGoogleAuthContext();
  const calendarId = input?.calendarId || ctx.calendarId || "primary";
  const now = new Date();
  const timeMin = input?.timeMin ? toIso(input.timeMin, "timeMin") : now.toISOString();
  const timeMax = input?.timeMax
    ? toIso(input.timeMax, "timeMax")
    : new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const durationMinutes = Math.min(Math.max(input?.durationMinutes ?? 60, 15), 8 * 60);

  const payload = await calendarRequest<{
    calendars?: Record<string, { busy?: Array<{ start?: string; end?: string }> }>;
  }>(
    "/freeBusy",
    {
      method: "POST",
      body: JSON.stringify({
        timeMin,
        timeMax,
        items: [{ id: calendarId }],
      }),
    },
  );

  const busy = (payload.calendars?.[calendarId]?.busy ?? [])
    .map((slot) => {
      if (!slot.start || !slot.end) return null;
      const start = toIso(slot.start, "busy.start");
      const end = toIso(slot.end, "busy.end");
      return { start, end };
    })
    .filter((slot): slot is { start: string; end: string } => slot != null)
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  const freeSlots: Array<{ start: string; end: string }> = [];
  let cursor = new Date(timeMin).getTime();
  const maxTs = new Date(timeMax).getTime();
  const minSlotMs = durationMinutes * 60 * 1000;

  for (const slot of busy) {
    const slotStart = new Date(slot.start).getTime();
    const slotEnd = new Date(slot.end).getTime();
    if (slotEnd <= cursor) continue;
    if (slotStart - cursor >= minSlotMs) {
      freeSlots.push({
        start: new Date(cursor).toISOString(),
        end: new Date(Math.min(slotStart, maxTs)).toISOString(),
      });
    }
    cursor = Math.max(cursor, slotEnd);
    if (cursor >= maxTs) break;
  }
  if (maxTs - cursor >= minSlotMs) {
    freeSlots.push({
      start: new Date(cursor).toISOString(),
      end: new Date(maxTs).toISOString(),
    });
  }

  return {
    calendarId,
    timeMin,
    timeMax,
    busy,
    freeSlots,
  } satisfies CalendarAvailability;
}
