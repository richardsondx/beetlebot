import { db } from "@/lib/db";

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
  const integration = await db.integrationConnection.findUnique({
    where: { provider: "google_calendar" },
  });
  if (!integration || integration.status !== "connected") {
    throw new Error("Google Calendar is not connected.");
  }

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
    data: {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token ?? ctx.refreshToken,
      tokenExpiresAt,
      lastCheckedAt: new Date(),
      lastError: null,
      status: "connected",
    },
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

  const payload = await calendarRequest<Record<string, unknown>>(
    `/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      body: JSON.stringify(patchBody),
    },
  );

  const event = normalizeGoogleEvent(payload);
  if (!event) throw new Error("Google Calendar returned an invalid event payload.");
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
