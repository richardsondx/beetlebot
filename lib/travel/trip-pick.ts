/**
 * Pick to plan: the state a beach pick carries into the trip plan.
 *
 * Design (opus_pass1.md section 3, kit/timeline-checklist.md):
 * - Tap "Pick" or type "2" or "Maldives". The pick carries destination,
 *   country, hotel (id, name, photo, coords), flight (Duffel sample
 *   offer), dates, nights, budget, and travelers into the trip plan.
 * - When dates or budget are unknown, Beetlebot asks one short
 *   question with quick-reply chips. It never assumes them: dates and
 *   nights stay null until the user gives them.
 * - Geography is fixed and checked by test: Bali is in Indonesia, the
 *   Maldives is its own country in the Indian Ocean, Palawan is an
 *   island in the Philippines.
 *
 * Prices are Sample, not live. The flight figure is the labelled Sample
 * figure from the approved compare mockup. Beetlebot does not book.
 */

import {
  BEACH_COUNTRY,
  BEACH_DESTINATIONS,
  type BeachDestination,
} from "@/lib/travel/beach-compare";
import type { FollowUp } from "@/lib/chat/rich-message";

export type TripPickHotel = {
  id: string;
  name: string;
  area: string;
  photoUrl: string | null;
  photoSourceName: string | null;
  lat: number;
  lng: number;
};

export type TripPickFlight = {
  /** Sample round-trip flight price in CAD, labelled Sample everywhere. */
  priceCad: number;
  label: string;
};

export type TripPick = {
  destination: string;
  country: string;
  hotel: TripPickHotel;
  flight: TripPickFlight;
  /** ISO dates, null when the user has not given them yet. Never assumed. */
  depart: string | null;
  return: string | null;
  nights: number | null;
  /** Budget in CAD, null when the user has not given one yet. Never assumed. */
  budgetCad: number | null;
  travelers: number;
};

export const TRIP_PICK_DEFAULT_TRAVELERS = 2;

/** Nights between two ISO dates, null when either is missing or invalid. */
export function nightsBetween(depart: string | null, ret: string | null): number | null {
  if (!depart || !ret) return null;
  const start = new Date(`${depart}T12:00:00`);
  const end = new Date(`${ret}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null;
  const nights = Math.round((end.getTime() - start.getTime()) / 86400000);
  return nights > 0 ? nights : null;
}

function destinationByTitle(title: string): BeachDestination | undefined {
  const wanted = title.trim().toLowerCase();
  return BEACH_DESTINATIONS.find((d) => d.title.toLowerCase() === wanted);
}

function destinationByIndex(index: number): BeachDestination | undefined {
  return BEACH_DESTINATIONS[index - 1];
}

/**
 * True when the message names a beach destination outright, for example
 * "Maldives" or "Pick Bali". A bare number does not count: it only
 * picks a beach when the thread just showed a beach compare.
 */
export function messageNamesBeachDestination(message: string): boolean {
  return BEACH_DESTINATIONS.some((d) =>
    new RegExp(`\\b${d.title.toLowerCase()}\\b`, "i").test(message),
  );
}

/**
 * Parse a typed reply into a beach destination. Accepts a bare number
 * ("2"), a bare name ("Maldives"), "Pick Bali", and the card tap line
 * `I'd like to go with "Maldives"`. Returns null for anything else,
 * including a number outside 1 to 3 and a message naming two beaches.
 */
export function parseBeachPickReply(message: string): string | null {
  const text = message.trim();
  if (!text) return null;
  const named = BEACH_DESTINATIONS.filter((d) =>
    new RegExp(`\\b${d.title.toLowerCase()}\\b`, "i").test(text),
  );
  if (named.length === 1) return named[0].title;
  if (named.length > 1) return null;
  const bareNumber = text.match(/^(?:pick|choose|go with)?\s*([123])\s*$/i);
  if (bareNumber) {
    const dest = destinationByIndex(Number(bareNumber[1]));
    return dest ? dest.title : null;
  }
  return null;
}

/**
 * Build the pick state for a destination. Dates, budget, and travelers
 * come from the caller when known; unknown dates and budget stay null
 * and the plan asks for them instead of assuming.
 */
export function buildTripPick(
  destinationTitle: string,
  opts: {
    photoUrl?: string | null;
    photoSourceName?: string | null;
    depart?: string | null;
    return?: string | null;
    budgetCad?: number | null;
    travelers?: number;
  } = {},
): TripPick | null {
  const dest = destinationByTitle(destinationTitle);
  if (!dest) return null;
  const depart = opts.depart ?? null;
  const ret = opts.return ?? null;
  return {
    destination: dest.title,
    country: BEACH_COUNTRY[dest.title] ?? dest.country,
    hotel: {
      id: `beach-${dest.title.toLowerCase()}`,
      name: dest.hotelName,
      area: dest.hotelArea,
      photoUrl: opts.photoUrl ?? null,
      photoSourceName: opts.photoSourceName ?? null,
      lat: dest.hotelLat,
      lng: dest.hotelLng,
    },
    flight: {
      priceCad: dest.sampleFlightCad,
      label: "Sample",
    },
    depart,
    return: ret,
    nights: nightsBetween(depart, ret),
    budgetCad:
      typeof opts.budgetCad === "number" && Number.isFinite(opts.budgetCad)
        ? opts.budgetCad
        : null,
    travelers:
      typeof opts.travelers === "number" && opts.travelers >= 1
        ? Math.min(9, Math.floor(opts.travelers))
        : TRIP_PICK_DEFAULT_TRAVELERS,
  };
}

/** Which required inputs are still missing from a pick. */
export function missingPickInputs(pick: TripPick): Array<"dates" | "budget"> {
  const missing: Array<"dates" | "budget"> = [];
  if (!pick.depart || !pick.return) missing.push("dates");
  if (pick.budgetCad === null) missing.push("budget");
  return missing;
}

/** True when the pick is complete enough to show a dated plan. */
export function isTripPickComplete(pick: TripPick): boolean {
  return missingPickInputs(pick).length === 0;
}

/**
 * One short question for the first missing input, with quick-reply
 * chips. Dates are asked before budget. Nothing is assumed.
 */
export function pickMissingInputQuestion(pick: TripPick): {
  question: string;
  followUps: FollowUp[];
} | null {
  const missing = missingPickInputs(pick);
  if (missing.length === 0) return null;
  if (missing[0] === "dates") {
    return {
      question: `Picked ${pick.destination}, ${pick.country}. What dates work for you?`,
      followUps: [
        { label: "This weekend", message: `This weekend in ${pick.destination}` },
        { label: "Next weekend", message: `Next weekend in ${pick.destination}` },
        { label: "Next month", message: `Next month in ${pick.destination}` },
      ],
    };
  }
  return {
    question: `Picked ${pick.destination}, ${pick.country}. What budget per person?`,
    followUps: [
      { label: "Under CA$1,500", message: `Budget CA$1500 per person for ${pick.destination}` },
      { label: "CA$1,500 to CA$3,000", message: `Budget CA$1500 to CA$3000 per person for ${pick.destination}` },
      { label: "Over CA$3,000", message: `Budget over CA$3000 per person for ${pick.destination}` },
    ],
  };
}

/** Hero title for the plan reply, for example "Palawan, Philippines — 5 nights". */
export function tripPickTitle(pick: TripPick): string {
  const base = `${pick.destination}, ${pick.country}`;
  return pick.nights !== null ? `${base} — ${pick.nights} nights` : base;
}

/** Price summary lines, each with its source label. Sample, never live. */
export function tripPickPriceLines(pick: TripPick): string[] {
  const lines = [
    `Flight (Sample): CA$${pick.flight.priceCad.toLocaleString("en-US")}`,
    `Hotel (Sample): $${BEACH_DESTINATIONS.find((d) => d.title === pick.destination)?.sampleNightlyUsd ?? "?"} a night`,
  ];
  if (pick.budgetCad !== null) {
    lines.push(`Budget: CA$${pick.budgetCad.toLocaleString("en-US")} per person`);
  }
  return lines;
}
