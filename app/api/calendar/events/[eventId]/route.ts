import { fail, fromError, ok } from "@/lib/api/http";
import {
  deleteGoogleCalendarEvent,
  updateGoogleCalendarEvent,
} from "@/lib/calendar/google-calendar";

type Params = { params: Promise<{ eventId: string }> };

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { eventId } = await params;
    const body = (await request.json()) as Record<string, unknown>;
    const data = await updateGoogleCalendarEvent({
      eventId,
      summary: typeof body.summary === "string" ? body.summary : undefined,
      start: typeof body.start === "string" ? body.start : undefined,
      end: typeof body.end === "string" ? body.end : undefined,
      description: typeof body.description === "string" ? body.description : undefined,
      location: typeof body.location === "string" ? body.location : undefined,
      timeZone: typeof body.timeZone === "string" ? body.timeZone : undefined,
      calendarId: typeof body.calendarId === "string" ? body.calendarId : undefined,
      attendees: Array.isArray(body.attendees)
        ? body.attendees.filter((value): value is string => typeof value === "string")
        : undefined,
    });
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}

export async function DELETE(request: Request, { params }: Params) {
  try {
    const { eventId } = await params;
    const url = new URL(request.url);
    if (!eventId) return fail("eventId is required", 400);
    const data = await deleteGoogleCalendarEvent({
      eventId,
      calendarId: url.searchParams.get("calendarId") ?? undefined,
    });
    return ok(data);
  } catch (error) {
    return fromError(error);
  }
}
