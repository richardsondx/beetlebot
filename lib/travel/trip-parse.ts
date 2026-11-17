/**
 * Fast trip parse for chat: origin, destination, dates, adults.
 * No model call. Used to start the Duffel search in parallel with the reply.
 * Only the snapshot route (Toronto to New York, Dec 11 to 14) has saved prices;
 * any other route still parses, and the search falls back to the snapshot with
 * the "Sample prices" label, never presented as live.
 */

export type TripQuery = {
  origin: string;
  destination: string;
  originCode: string;
  destinationCode: string;
  /** ISO date, for example "2026-12-11". */
  depart: string;
  /** ISO date, for example "2026-12-14". */
  return: string;
  adults: number;
  /** True when the query matches the saved snapshot route and dates. */
  matchedSnapshot: boolean;
};

const CITY_CODES: Array<{ names: string[]; code: string; label: string }> = [
  { names: ["toronto"], code: "YYZ", label: "Toronto" },
  { names: ["new york", "new york city", "nyc"], code: "NYC", label: "New York" },
  { names: ["montreal"], code: "YUL", label: "Montreal" },
  { names: ["vancouver"], code: "YVR", label: "Vancouver" },
  { names: ["london"], code: "LHR", label: "London" },
  { names: ["paris"], code: "CDG", label: "Paris" },
];

const MONTHS: Record<string, number> = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3,
  may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8,
  september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};

const SNAPSHOT = {
  originCode: "YYZ",
  destinationCode: "NYC",
  depart: "2026-12-11",
  return: "2026-12-14",
};

function findCity(text: string, pattern: RegExp): { code: string; label: string } | null {
  const match = text.match(pattern);
  if (!match) return null;
  const mention = match[1].toLowerCase();
  for (const city of CITY_CODES) {
    if (city.names.includes(mention)) return { code: city.code, label: city.label };
  }
  return null;
}

function isoDate(year: number, month: number, day: number): string {
  const d = new Date(Date.UTC(year, month, day));
  return d.toISOString().slice(0, 10);
}

function nextWeekday(from: Date, weekday: number): Date {
  const d = new Date(from);
  d.setHours(0, 0, 0, 0);
  const delta = (weekday - d.getDay() + 7) % 7;
  d.setDate(d.getDate() + delta);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toIsoLocal(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse "Dec 11" or "2026-12-11" style dates from the message. */
function parseExplicitDates(text: string, now: Date): { depart: string; return: string } | null {
  const iso = [...text.matchAll(/(\d{4})-(\d{2})-(\d{2})/g)].map((m) => m[0]);
  if (iso.length >= 2) return { depart: iso[0], return: iso[1] };
  if (iso.length === 1) {
    return { depart: iso[0], return: toIsoLocal(addDays(new Date(iso[0]), 3)) };
  }
  const named = [...text.matchAll(/(jan|january|feb|february|mar|march|apr|april|may|jun|june|jul|july|aug|august|sep|sept|september|oct|october|nov|november|dec|december)\s+(\d{1,2})/gi)];
  if (named.length >= 2) {
    const year = now.getFullYear();
    const first = named[0];
    const second = named[1];
    return {
      depart: isoDate(year, MONTHS[first[1].toLowerCase()], Number(first[2])),
      return: isoDate(year, MONTHS[second[1].toLowerCase()], Number(second[2])),
    };
  }
  if (named.length === 1) {
    const year = now.getFullYear();
    const first = named[0];
    const depart = new Date(year, MONTHS[first[1].toLowerCase()], Number(first[2]));
    return { depart: toIsoLocal(depart), return: toIsoLocal(addDays(depart, 3)) };
  }
  return null;
}

export function parseTripQuery(message: string, now: Date = new Date()): TripQuery | null {
  const text = message.toLowerCase();

  const origin =
    findCity(text, /from\s+(new york city|new york|nyc|toronto|montreal|vancouver|london|paris)/) ??
    null;
  const destination =
    findCity(text, /(?:to|in|visit|visiting|weekend in|trip to)\s+(new york city|new york|nyc|toronto|montreal|vancouver|london|paris)/) ??
    findCity(text, /(new york city|new york|nyc|toronto|montreal|vancouver|london|paris)/);

  if (!destination) return null;
  // A lone "Toronto" with no "from" is a home base, not a trip.
  if (!origin && destination.code === "YYZ") return null;

  const originCode = origin?.code ?? "YYZ";
  const originLabel = origin?.label ?? "Toronto";

  const adultsMatch = text.match(/(\d+)\s+adults?/);
  const adults = adultsMatch ? Math.max(1, Math.min(9, Number(adultsMatch[1]))) : 1;

  let dates = parseExplicitDates(text, now);
  if (!dates) {
    // "Fri to Mon" or a bare "weekend": the next Friday to Monday.
    if (/\b(fri|friday)\b/.test(text) || /\bweekend\b/.test(text)) {
      const friday = nextWeekday(now, 5);
      dates = { depart: toIsoLocal(friday), return: toIsoLocal(addDays(friday, 3)) };
    }
  }
  // No dates at all: the saved snapshot dates, labelled as a sample.
  if (!dates) dates = { depart: SNAPSHOT.depart, return: SNAPSHOT.return };

  const matchedSnapshot =
    originCode === SNAPSHOT.originCode &&
    destination.code === SNAPSHOT.destinationCode &&
    dates.depart === SNAPSHOT.depart &&
    dates.return === SNAPSHOT.return;

  return {
    origin: originLabel,
    destination: destination.label,
    originCode,
    destinationCode: destination.code,
    depart: dates.depart,
    return: dates.return,
    adults,
    matchedSnapshot,
  };
}

/** "Dec 11" style short label for a status line. */
export function shortDateLabel(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}
