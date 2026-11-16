import { fail, fromError, ok } from "@/lib/api/http";
import {
  FLIGHT_SEARCH,
  buildPlanObject,
  getComparePayload,
} from "@/lib/travel/compare";

// GET returns the live compare payload: Duffel flight options with totals,
// source name and search time, plus the hotel check-live-rates handoff.
export async function GET() {
  try {
    return ok(getComparePayload());
  } catch (error) {
    return fromError(error);
  }
}

// POST picks one flight option by index and returns the Plan Object built
// from it. No booking is made here. Booking stops at handoff links.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const index = typeof body?.flightIndex === "number" ? body.flightIndex : 0;
    const flight = FLIGHT_SEARCH.options[index];
    if (!flight) return fail("flightIndex is out of range", 400);
    return ok({ planObject: buildPlanObject(flight), flight });
  } catch (error) {
    return fromError(error);
  }
}
