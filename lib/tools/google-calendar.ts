import type { ChatToolDefinition } from "@/lib/tools/types";
import { assertIntegrationScope } from "@/lib/integrations/scope-guard";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  getGoogleCalendarEvent,
  getGoogleCalendarAvailability,
  listGoogleCalendars,
  listGoogleCalendarEvents,
  resolveCalendarEvent,
  updateGoogleCalendarEvent,
} from "@/lib/calendar/google-calendar";

const OPERATION_SCOPES: Record<string, "read" | "write" | "delete"> = {
  list: "read",
  list_calendars: "read",
  list_multi: "read",
  find: "read",
  get: "read",
  availability: "read",
  create: "write",
  update: "write",
  delete: "delete",
};

export const googleCalendarEventsTool: ChatToolDefinition = {
  name: "google_calendar_events",
  integration: "google_calendar",
  operationScopes: OPERATION_SCOPES,
  description:
    "Read and manage Google Calendar events. IMPORTANT: Before calling UPDATE or DELETE, ALWAYS call FIND first to resolve the event by name — it handles emoji prefixes, partial names, and fuzzy matching to return the correct eventId and calendarId. For CREATE/UPDATE/DELETE, events go to the '🪲 Managed Calendar' by default (auto-created if missing). For LIST and AVAILABILITY, reads from the user's primary calendar unless a calendarId is given. Use LIST_CALENDARS to discover calendar IDs. Use LIST_MULTI to search all readable calendars.",
  parameters: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["list", "list_calendars", "list_multi", "find", "get", "create", "update", "delete", "availability"],
        description: "Calendar operation to perform. Use FIND to locate an event by name before UPDATE or DELETE.",
      },
      calendarId: {
        type: "string",
        description: "Google calendar ID. Omit for default behavior (managed calendar for writes, primary for reads).",
      },
      eventId: {
        type: "string",
        description: "Required for update/delete.",
      },
      summary: {
        type: "string",
        description: "Event title (required for create).",
      },
      description: {
        type: "string",
      },
      location: {
        type: "string",
      },
      start: {
        type: "string",
        description: "ISO datetime string.",
      },
      end: {
        type: "string",
        description: "ISO datetime string.",
      },
      timeZone: {
        type: "string",
        description: "IANA timezone (optional).",
      },
      attendees: {
        type: "array",
        items: { type: "string" },
        description: "Optional attendee emails.",
      },
      timeMin: {
        type: "string",
        description: "ISO datetime lower bound for list/availability.",
      },
      timeMax: {
        type: "string",
        description: "ISO datetime upper bound for list/availability.",
      },
      maxResults: {
        type: "number",
        description: "Max number of events for list (1-100).",
      },
      query: {
        type: "string",
        description: "Optional full-text query for list.",
      },
      calendarIds: {
        type: "array",
        items: { type: "string" },
        description: "For list_multi: optional calendar IDs to include. Omit to search all readable calendars.",
      },
      durationMinutes: {
        type: "number",
        description: "Min free slot duration for availability.",
      },
      maxResultsPerCalendar: {
        type: "number",
        description: "For list_multi: max events per calendar (1-100).",
      },
    },
    required: ["operation"],
    additionalProperties: false,
  },
  async execute(args) {
    try {
      const operation = typeof args.operation === "string" ? args.operation : "";
      const requiredScope = OPERATION_SCOPES[operation];
      if (requiredScope) {
        await assertIntegrationScope("google_calendar", requiredScope);
      }
      const calendarId = typeof args.calendarId === "string" ? args.calendarId : undefined;
      switch (operation) {
        case "list":
          return await listGoogleCalendarEvents({
            calendarId,
            timeMin: typeof args.timeMin === "string" ? args.timeMin : undefined,
            timeMax: typeof args.timeMax === "string" ? args.timeMax : undefined,
            maxResults:
              typeof args.maxResults === "number"
                ? Math.round(args.maxResults)
                : undefined,
            query: typeof args.query === "string" ? args.query : undefined,
          });
        case "list_calendars":
          return await listGoogleCalendars();
        case "list_multi": {
          const calendars = await listGoogleCalendars();
          const requestedCalendarIds = Array.isArray(args.calendarIds)
            ? args.calendarIds.filter((value): value is string => typeof value === "string" && value.trim().length > 0)
            : [];
          const targetCalendars = requestedCalendarIds.length
            ? calendars.calendars.filter((calendar) => requestedCalendarIds.includes(calendar.id))
            : calendars.calendars;
          const maxResultsPerCalendar =
            typeof args.maxResultsPerCalendar === "number"
              ? Math.min(Math.max(Math.round(args.maxResultsPerCalendar), 1), 100)
              : 20;

          const eventResponses = await Promise.allSettled(
            targetCalendars.map(async (calendar) => {
              const listed = await listGoogleCalendarEvents({
                calendarId: calendar.id,
                timeMin: typeof args.timeMin === "string" ? args.timeMin : undefined,
                timeMax: typeof args.timeMax === "string" ? args.timeMax : undefined,
                maxResults: maxResultsPerCalendar,
                query: typeof args.query === "string" ? args.query : undefined,
              });
              return {
                calendarId: calendar.id,
                calendarName: calendar.summary,
                primary: calendar.primary,
                count: listed.count,
                events: listed.events,
              };
            }),
          );

          const successfulResponses = eventResponses
            .filter(
              (
                response,
              ): response is PromiseFulfilledResult<{
                calendarId: string;
                calendarName: string;
                primary: boolean;
                count: number;
                events: Array<Record<string, unknown>>;
              }> => response.status === "fulfilled",
            )
            .map((response) => response.value);
          const failedResponses = eventResponses.filter(
            (response): response is PromiseRejectedResult => response.status === "rejected",
          );
          const events = successfulResponses.flatMap((result) =>
            result.events.map((event) => ({
              ...event,
              calendarId: result.calendarId,
              calendarName: result.calendarName,
              primary: result.primary,
            })),
          );
          const partialFailures = eventResponses
            .map((response, index) => {
              if (response.status === "fulfilled") return null;
              const calendar = targetCalendars[index];
              return {
                calendarId: calendar?.id ?? "unknown",
                calendarName: calendar?.summary ?? "unknown",
                error:
                  response.reason instanceof Error
                    ? response.reason.message
                    : "Failed to list events for this calendar.",
              };
            })
            .filter((failure): failure is { calendarId: string; calendarName: string; error: string } => failure !== null);

          if (!successfulResponses.length && partialFailures.length > 0) {
            return {
              error: "Failed to list events from all selected calendars.",
              calendarCount: targetCalendars.length,
              partialFailures,
            };
          }

          return {
            calendarCount: targetCalendars.length,
            calendars: targetCalendars,
            count: events.length,
            events,
            partialFailures,
          };
        }
        case "find": {
          const findQuery = typeof args.query === "string" ? args.query.trim() : "";
          if (!findQuery) {
            return { error: "find requires a query (the event name or description to search for)." };
          }
          // #region agent log
          fetch("http://127.0.0.1:7247/ingest/47f72c19-1052-41f0-8ef0-115f189fc319", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              runId: "calendar-find-miss",
              hypothesisId: "H1",
              location: "lib/tools/google-calendar.ts:find",
              message: "calendar find invoked",
              data: {
                query: findQuery,
                hasTimeMin: typeof args.timeMin === "string",
                hasTimeMax: typeof args.timeMax === "string",
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          const resolved = await resolveCalendarEvent({
            query: findQuery,
            timeMin: typeof args.timeMin === "string" ? args.timeMin : undefined,
            timeMax: typeof args.timeMax === "string" ? args.timeMax : undefined,
          });
          // #region agent log
          fetch("http://127.0.0.1:7247/ingest/47f72c19-1052-41f0-8ef0-115f189fc319", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              runId: "calendar-find-miss",
              hypothesisId: "H2",
              location: "lib/tools/google-calendar.ts:find",
              message: "calendar find resolved",
              data: {
                found: Boolean(resolved.match),
                strategy: resolved.strategy,
                topCandidateConfidence: resolved.candidates[0]?.confidence ?? null,
                candidateCount: resolved.candidates.length,
              },
              timestamp: Date.now(),
            }),
          }).catch(() => {});
          // #endregion
          if (resolved.match) {
            return {
              found: true,
              event: resolved.match,
              eventId: resolved.match.id,
              calendarId: resolved.match.calendarId,
              calendarName: resolved.match.calendarName,
              confidence: resolved.match.confidence,
              strategy: resolved.strategy,
              otherCandidates: resolved.candidates.slice(1).map((c) => ({
                eventId: c.id,
                summary: c.summary,
                calendarId: c.calendarId,
                calendarName: c.calendarName,
                confidence: c.confidence,
                start: c.start,
                end: c.end,
              })),
            };
          }
          return {
            found: false,
            error: "No matching event found.",
            closestCandidates: resolved.candidates.map((c) => ({
              eventId: c.id,
              summary: c.summary,
              calendarId: c.calendarId,
              calendarName: c.calendarName,
              confidence: c.confidence,
              start: c.start,
              end: c.end,
            })),
          };
        }
        case "get":
          if (typeof args.eventId !== "string") {
            return { error: "get requires eventId" };
          }
          return await getGoogleCalendarEvent({
            calendarId,
            eventId: args.eventId,
          });
        case "create":
          if (typeof args.summary !== "string" || typeof args.start !== "string" || typeof args.end !== "string") {
            return { error: "create requires summary, start, and end" };
          }
          return await createGoogleCalendarEvent({
            calendarId,
            summary: args.summary,
            start: args.start,
            end: args.end,
            description: typeof args.description === "string" ? args.description : undefined,
            location: typeof args.location === "string" ? args.location : undefined,
            timeZone: typeof args.timeZone === "string" ? args.timeZone : undefined,
            attendees: Array.isArray(args.attendees)
              ? args.attendees.filter((value): value is string => typeof value === "string")
              : undefined,
          });
        case "update":
          if (typeof args.eventId !== "string") {
            return { error: "update requires eventId" };
          }
          return await updateGoogleCalendarEvent({
            calendarId,
            eventId: args.eventId,
            summary: typeof args.summary === "string" ? args.summary : undefined,
            start: typeof args.start === "string" ? args.start : undefined,
            end: typeof args.end === "string" ? args.end : undefined,
            description: typeof args.description === "string" ? args.description : undefined,
            location: typeof args.location === "string" ? args.location : undefined,
            timeZone: typeof args.timeZone === "string" ? args.timeZone : undefined,
            attendees: Array.isArray(args.attendees)
              ? args.attendees.filter((value): value is string => typeof value === "string")
              : undefined,
          });
        case "delete":
          if (typeof args.eventId !== "string") {
            return { error: "delete requires eventId" };
          }
          return await deleteGoogleCalendarEvent({ calendarId, eventId: args.eventId });
        case "availability":
          return await getGoogleCalendarAvailability({
            calendarId,
            timeMin: typeof args.timeMin === "string" ? args.timeMin : undefined,
            timeMax: typeof args.timeMax === "string" ? args.timeMax : undefined,
            durationMinutes:
              typeof args.durationMinutes === "number"
                ? Math.round(args.durationMinutes)
                : undefined,
          });
        default:
          return {
            error:
              "Unknown operation. Use one of: list, list_calendars, list_multi, find, get, create, update, delete, availability.",
          };
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Google Calendar tool failed." };
    }
  },
};
