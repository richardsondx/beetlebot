import { afterEach, describe, expect, it, vi } from "vitest";
import { googleCalendarEventsTool } from "../../lib/tools/google-calendar";
import * as googleCalendarApi from "../../lib/calendar/google-calendar";
import * as scopeGuard from "../../lib/integrations/scope-guard";

describe("google_calendar_events tool", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns partial results when one calendar fails in list_multi", async () => {
    vi.spyOn(scopeGuard, "assertIntegrationScope").mockResolvedValue(undefined);
    vi.spyOn(googleCalendarApi, "listGoogleCalendars").mockResolvedValue({
      calendars: [
        { id: "cal_1", summary: "Calendar One", primary: true },
        { id: "cal_2", summary: "Calendar Two", primary: false },
      ],
    });
    vi.spyOn(googleCalendarApi, "listGoogleCalendarEvents").mockImplementation(async ({ calendarId }) => {
      if (calendarId === "cal_1") {
        throw new Error("calendar unavailable");
      }
      return {
        count: 1,
        events: [
          {
            id: "evt_2",
            summary: "Team Lunch",
            start: "2026-03-01T17:00:00.000Z",
            end: "2026-03-01T18:00:00.000Z",
          },
        ],
      };
    });

    const result = (await googleCalendarEventsTool.execute({
      operation: "list_multi",
      maxResultsPerCalendar: 10,
    })) as {
      count?: number;
      events?: Array<Record<string, unknown>>;
      partialFailures?: Array<{ calendarId: string; calendarName: string; error: string }>;
      error?: string;
    };

    expect(result.error).toBeUndefined();
    expect(result.count).toBe(1);
    expect(result.events?.[0]?.calendarId).toBe("cal_2");
    expect(result.partialFailures).toHaveLength(1);
    expect(result.partialFailures?.[0]?.calendarId).toBe("cal_1");
    expect(result.partialFailures?.[0]?.error).toContain("calendar unavailable");
  });

  it("returns an error when all calendars fail in list_multi", async () => {
    vi.spyOn(scopeGuard, "assertIntegrationScope").mockResolvedValue(undefined);
    vi.spyOn(googleCalendarApi, "listGoogleCalendars").mockResolvedValue({
      calendars: [{ id: "cal_1", summary: "Calendar One", primary: true }],
    });
    vi.spyOn(googleCalendarApi, "listGoogleCalendarEvents").mockRejectedValue(new Error("token expired"));

    const result = (await googleCalendarEventsTool.execute({
      operation: "list_multi",
    })) as {
      error?: string;
      partialFailures?: Array<{ calendarId: string; calendarName: string; error: string }>;
    };

    expect(result.error).toContain("Failed to list events from all selected calendars");
    expect(result.partialFailures).toHaveLength(1);
    expect(result.partialFailures?.[0]?.calendarId).toBe("cal_1");
    expect(result.partialFailures?.[0]?.error).toContain("token expired");
  });
});
