import { fail, fromError, ok } from "@/lib/api/http";
import {
  createGoogleCalendarEvent,
  listGoogleCalendarEvents,
} from "@/lib/calendar/google-calendar";

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const data = await listGoogleCalendarEvents({
      calendarId: url.searchParams.get("calendarId") ?? undefined,
      timeMin: url.searchParams.get("timeMin") ?? undefined,
      timeMax: url.searchParams.get("timeMax") ?? undefined,
      maxResults: url.searchParams.get("maxResults")
        ? Number(url.searchParams.get("maxResults"))
        : undefined,
      query: url.searchParams.get("query") ?? undefined,
    });
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const summary = typeof body.summary === "string" ? body.summary.trim() : "";
    const start = typeof body.start === "string" ? body.start : "";
    const end = typeof body.end === "string" ? body.end : "";

    if (!summary || !start || !end) {
      return fail("summary, start, and end are required.", 400);
    }

    const data = await createGoogleCalendarEvent({
      summary,
      start,
      end,
      description: typeof body.description === "string" ? body.description : undefined,
      location: typeof body.location === "string" ? body.location : undefined,
      timeZone: typeof body.timeZone === "string" ? body.timeZone : undefined,
      calendarId: typeof body.calendarId === "string" ? body.calendarId : undefined,
      attendees: Array.isArray(body.attendees)
        ? body.attendees.filter((value): value is string => typeof value === "string")
        : undefined,
    });
    return ok(data, 201);
  } catch (error) {
    return fromError(error);
  }
}
