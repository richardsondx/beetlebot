import type { ChatToolDefinition } from "@/lib/tools/types";
import { assertIntegrationScope } from "@/lib/integrations/scope-guard";
import {
  createGoogleCalendarEvent,
  deleteGoogleCalendarEvent,
  getGoogleCalendarAvailability,
  listGoogleCalendars,
  listGoogleCalendarEvents,
  updateGoogleCalendarEvent,
} from "@/lib/calendar/google-calendar";

const OPERATION_SCOPES: Record<string, "read" | "write" | "delete"> = {
  list: "read",
  list_calendars: "read",
  list_multi: "read",
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
    "Read and manage Google Calendar events. For CREATE/UPDATE/DELETE, events go to the '🪲 Managed Calendar' by default (auto-created if missing). For LIST and AVAILABILITY, reads from the user's primary calendar unless a calendarId is given. Use LIST_CALENDARS to discover calendar IDs. Use LIST_MULTI to search all readable calendars.",
  parameters: {
    type: "object",
    properties: {
      operation: {
        type: "string",
        enum: ["list", "list_calendars", "list_multi", "create", "update", "delete", "availability"],
        description: "Calendar operation to perform.",
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

          const eventResponses = await Promise.all(
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

          const events = eventResponses.flatMap((result) =>
            result.events.map((event) => ({
              ...event,
              calendarId: result.calendarId,
              calendarName: result.calendarName,
              primary: result.primary,
            })),
          );

          return {
            calendarCount: targetCalendars.length,
            calendars: targetCalendars,
            count: events.length,
            events,
          };
        }
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
              "Unknown operation. Use one of: list, create, update, delete, availability.",
          };
      }
    } catch (error) {
      return { error: error instanceof Error ? error.message : "Google Calendar tool failed." };
    }
  },
};
