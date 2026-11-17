import type { FlightCard } from "@/lib/chat/rich-message";
import {
  AXEL_HOTEL_SEED,
  HOTEL_SOURCE,
  derivedNightly,
  nightsBetween,
} from "./hotel-prices";

// Travel compare core for unit U3.
// Flights are live Duffel results. The snapshot below is copied verbatim from
// the unedited evidence file duffel-yyz-nyc-20261211.json in the run folder.
// Hotels are the saved Hello Axel check from Nov 16, 2026, in
// lib/travel/hotel-prices.ts. Expedia and Agoda failed with
// connector_country_not_allowed, so no live hotel source is wired in.
// Prices are saved, not live, and the page says so.

export type FlightSlice = {
  from: string;
  to: string;
  departAt: string;
  arriveAt: string;
  duration: string;
  stops: number;
  fareBrand: string;
  flightNumbers: string[];
};

export type FlightOption = {
  pointer: string;
  totalAmount: number;
  currency: string;
  airline: string;
  stops: number;
  duration: string;
  fareBrand: string;
  carryOnBags: number;
  changeable: boolean;
  refundable: boolean;
  label: string;
  slices: FlightSlice[];
};

export type FlightSearchEvidence = {
  source: string;
  searchedAt: string;
  origin: string;
  destination: string;
  departureDate: string;
  returnDate: string;
  adults: number;
  cabin: string;
  offersTotal: number;
  offersShown: number;
  coverageComplete: boolean;
  evidenceFile: string;
  options: FlightOption[];
};

export const FLIGHT_SEARCH: FlightSearchEvidence = {
  source: "Duffel",
  searchedAt: "2026-11-16T23:27:40Z",
  origin: "YYZ",
  destination: "NYC",
  departureDate: "2026-12-11",
  returnDate: "2026-12-14",
  adults: 1,
  cabin: "economy",
  offersTotal: 1179,
  offersShown: 311,
  coverageComplete: true,
  evidenceFile: "duffel-yyz-nyc-20261211.json",
  options: [
    {
      pointer: "/offers/0",
      totalAmount: 377.68,
      currency: "CAD",
      airline: "Delta Air Lines",
      stops: 0,
      duration: "3h51m",
      fareBrand: "Delta Main Basic",
      carryOnBags: 1,
      changeable: true,
      refundable: false,
      label: "cheapest",
      slices: [
        {
          from: "YYZ",
          to: "LGA",
          departAt: "2026-12-11T18:50:00",
          arriveAt: "2026-12-11T20:46:00",
          duration: "1h56m",
          stops: 0,
          fareBrand: "Delta Main Basic",
          flightNumbers: ["DL5154"],
        },
        {
          from: "LGA",
          to: "YYZ",
          departAt: "2026-12-14T07:15:00",
          arriveAt: "2026-12-14T09:10:00",
          duration: "1h55m",
          stops: 0,
          fareBrand: "Delta Main Basic",
          flightNumbers: ["DL5187"],
        },
      ],
    },
    {
      pointer: "/offers/2",
      totalAmount: 398.68,
      currency: "CAD",
      airline: "Porter Airlines",
      stops: 0,
      duration: "3h18m",
      fareBrand: "Basic",
      carryOnBags: 0,
      changeable: false,
      refundable: false,
      label: "balance of price and time",
      slices: [
        {
          from: "YYZ",
          to: "LGA",
          departAt: "2026-12-11T15:25:00",
          arriveAt: "2026-12-11T16:59:00",
          duration: "1h34m",
          stops: 0,
          fareBrand: "Basic",
          flightNumbers: ["PD0605"],
        },
        {
          from: "LGA",
          to: "YYZ",
          departAt: "2026-12-14T09:40:00",
          arriveAt: "2026-12-14T11:24:00",
          duration: "1h44m",
          stops: 0,
          fareBrand: "Basic",
          flightNumbers: ["PD0604"],
        },
      ],
    },
    {
      pointer: "/offers/3",
      totalAmount: 398.68,
      currency: "CAD",
      airline: "Air Canada",
      stops: 0,
      duration: "3h23m",
      fareBrand: "Economy Basic",
      carryOnBags: 0,
      changeable: false,
      refundable: false,
      label: "cheapest YYZ-EWR",
      slices: [
        {
          from: "YYZ",
          to: "EWR",
          departAt: "2026-12-11T16:20:00",
          arriveAt: "2026-12-11T18:01:00",
          duration: "1h41m",
          stops: 0,
          fareBrand: "Economy Basic",
          flightNumbers: ["AC1508"],
        },
        {
          from: "LGA",
          to: "YYZ",
          departAt: "2026-12-14T06:00:00",
          arriveAt: "2026-12-14T07:42:00",
          duration: "1h42m",
          stops: 0,
          fareBrand: "Economy Basic",
          flightNumbers: ["AC0701"],
        },
      ],
    },
  ],
};

export type HotelHandoff = {
  name: string;
  area: string;
  stars: number;
  price: {
    total: number;
    nightly: number;
    currency: "USD";
    nightlyDerived: boolean;
  } | null;
  source: string;
  sourceUrl: string;
  checkLiveRatesUrl: string;
  priceNote: string;
  feeNote?: string;
};

// Hotel prices from the saved Hello Axel check, Nov 16, 2026, for New York,
// Dec 11 to 14, 2026, 3 nights, 2 adults, 1 room. Same seed the chat hotel
// cards use. Prices are saved, not live. Never fill a price from another
// source, and never present a saved price as live.
const HOTEL_NIGHTS = nightsBetween("2026-12-11", "2026-12-14");

export const HOTEL_HANDOFFS: HotelHandoff[] = AXEL_HOTEL_SEED.map((seed) => ({
  name: seed.name,
  area: seed.area,
  stars: seed.stars,
  price:
    seed.total === null
      ? null
      : {
          total: seed.total,
          nightly:
            seed.nightly ?? derivedNightly(seed.total, HOTEL_NIGHTS),
          currency: "USD" as const,
          nightlyDerived: seed.nightly === null,
        },
  source: HOTEL_SOURCE,
  sourceUrl: seed.sourceUrl,
  checkLiveRatesUrl: seed.sourceUrl,
  priceNote:
    "Saved Hello Axel price, checked Nov 16, 2026. Rates are for 2 adults, 1 room, Dec 11 to 14, 2026, 3 nights. Not a live price.",
  feeNote: seed.feeNote,
}));

export const HOTEL_RATE_SOURCES_FAILED = [
  {
    source: "Expedia",
    error: "connector_country_not_allowed",
    detail: "Expedia is not offered in this account's region. Reconnecting or retrying will not make it available.",
  },
  {
    source: "Agoda",
    error: "connector_country_not_allowed",
    detail: "Agoda is not offered in this account's region. Reconnecting or retrying will not make it available.",
  },
];

export const HOTEL_COMPARE_NOTE =
  "Hotel prices are from a saved Hello Axel check on Nov 16, 2026, for Dec 11 to 14, 2026, " +
  "3 nights, 2 adults, 1 room. These are not live prices. Prices move daily, confirm on the " +
  "seller before booking.";

export const HOTEL_RATE_CHECK_LINKS = {
  googleHotels: "https://www.google.com/travel/hotels",
  bookingCom: "https://www.booking.com/",
};

// Plan Object shape from docs/PLAN_OBJECT_SCHEMA.md.
export type PlanObject = {
  title: string;
  mode: string;
  participants: string[];
  timeWindows: Array<{ startAt: string; endAt: string }>;
  location: { center: string; radiusKm: number };
  constraints: {
    budgetCap?: number;
    accessibility?: string[];
    groupType?: string;
  };
  weatherAssumptions: string[];
  steps: Array<"suggest" | "soft_hold" | "approval" | "book">;
  fallbackPlan: string;
};

export function buildPlanObject(flight: FlightOption): PlanObject {
  const outbound = flight.slices[0];
  const inbound = flight.slices[flight.slices.length - 1];
  return {
    title: `Toronto to New York, Dec 11 to Dec 14 2026, ${flight.airline}`,
    mode: "travel",
    participants: ["1 adult"],
    timeWindows: [
      { startAt: outbound.departAt, endAt: outbound.arriveAt },
      { startAt: inbound.departAt, endAt: inbound.arriveAt },
    ],
    location: { center: "New York, NY", radiusKm: 10 },
    constraints: {
      budgetCap: flight.totalAmount,
      groupType: "solo",
    },
    weatherAssumptions: ["December weather in New York. Check the forecast before packing."],
    steps: ["suggest", "soft_hold", "approval"],
    fallbackPlan:
      "If the picked flight is gone at checkout, pick the next cheapest live Duffel offer and recheck hotel rates before paying. Beetlebot makes no booking.",
  };
}

export function getComparePayload() {
  return {
    flights: FLIGHT_SEARCH,
    hotels: HOTEL_HANDOFFS,
    hotelRateSourcesFailed: HOTEL_RATE_SOURCES_FAILED,
    hotelCompareNote: HOTEL_COMPARE_NOTE,
    hotelRateCheckLinks: HOTEL_RATE_CHECK_LINKS,
    planObject: buildPlanObject(FLIGHT_SEARCH.options[0]),
  };
}

const FLIGHT_DAY_FORMAT = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  month: "short",
  day: "numeric",
});
const FLIGHT_TIME_FORMAT = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
});

/** Format one flight leg for humans, for example "Fri, Dec 11, 6:50 PM – 8:46 PM". */
export function formatFlightRange(departAt: string, arriveAt: string): string {
  const depart = new Date(departAt);
  const arrive = new Date(arriveAt);
  if (Number.isNaN(depart.getTime()) || Number.isNaN(arrive.getTime())) {
    return `${departAt} to ${arriveAt}`;
  }
  const day = FLIGHT_DAY_FORMAT.format(depart);
  const departTime = FLIGHT_TIME_FORMAT.format(depart);
  const arriveTime = FLIGHT_TIME_FORMAT.format(arrive);
  if (depart.toDateString() === arrive.toDateString()) {
    return `${day}, ${departTime} – ${arriveTime}`;
  }
  return `${day}, ${departTime} – ${FLIGHT_DAY_FORMAT.format(arrive)}, ${arriveTime}`;
}

// ── In-chat flight cards (shared mapper, snapshot and live) ──────────────────

/** Airline homepages used for the "Book on <airline>" link. No booking inside Beetlebot. */
export const AIRLINE_HOME_PAGES: Record<string, string> = {
  "Delta Air Lines": "https://www.delta.com/",
  "Porter Airlines": "https://www.flyporter.com/",
  "Air Canada": "https://www.aircanada.com/",
};

/** "3h51m" to minutes, for fastest-card ranking. Unknown shapes sort last. */
export function durationToMinutes(duration: string): number {
  const match = duration.match(/(?:(\d+)h)?(?:(\d+)m)?/);
  if (!match || (match[1] === undefined && match[2] === undefined)) return Number.MAX_SAFE_INTEGER;
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
}

/** Map one snapshot FlightOption to an in-chat FlightCard. No tags yet. */
export function flightOptionToCard(option: FlightOption): FlightCard {
  const outbound = option.slices[0];
  const inbound = option.slices[option.slices.length - 1];
  return {
    id: option.pointer,
    offerId: option.pointer,
    airline: option.airline,
    outbound: {
      from: outbound.from,
      to: outbound.to,
      departAt: outbound.departAt,
      arriveAt: outbound.arriveAt,
      duration: outbound.duration,
      stops: outbound.stops,
      flightNumbers: outbound.flightNumbers,
    },
    return: {
      from: inbound.from,
      to: inbound.to,
      departAt: inbound.departAt,
      arriveAt: inbound.arriveAt,
      duration: inbound.duration,
      stops: inbound.stops,
      flightNumbers: inbound.flightNumbers,
    },
    stops: option.stops,
    duration: option.duration,
    totalAmount: option.totalAmount,
    currency: option.currency,
    changeable: option.changeable,
    refundable: option.refundable,
    carryOnBags: option.carryOnBags,
    tags: [],
    bookUrl: AIRLINE_HOME_PAGES[option.airline],
  };
}

/**
 * Pick the three cards to show: lowest total, fastest, fewest stops.
 * At most one tag per card. A card that wins two slots keeps the first tag
 * and the other slot is filled with the next cheapest untagged card.
 */
export function pickThreeCards(cards: FlightCard[]): FlightCard[] {
  if (cards.length <= 3) {
    const ranked = [...cards].sort((a, b) => a.totalAmount - b.totalAmount);
    return assignTags(ranked);
  }
  const sorted = [...cards].sort((a, b) => a.totalAmount - b.totalAmount);
  const picked: FlightCard[] = [];
  const take = (card: FlightCard | undefined) => {
    if (card && !picked.includes(card)) picked.push(card);
  };
  take(sorted[0]);
  take([...cards].sort((a, b) => durationToMinutes(a.duration) - durationToMinutes(b.duration))[0]);
  take([...cards].sort((a, b) => a.stops - b.stops || a.totalAmount - b.totalAmount)[0]);
  for (const card of sorted) {
    if (picked.length >= 3) break;
    take(card);
  }
  return assignTags(picked);
}

function assignTags(picked: FlightCard[]): FlightCard[] {
  const byPrice = [...picked].sort((a, b) => a.totalAmount - b.totalAmount);
  const bySpeed = [...picked].sort(
    (a, b) => durationToMinutes(a.duration) - durationToMinutes(b.duration),
  );
  const byStops = [...picked].sort(
    (a, b) => a.stops - b.stops || a.totalAmount - b.totalAmount,
  );
  const tagged = new Set<FlightCard>();
  const tags = new Map<FlightCard, string>();
  const claim = (candidates: FlightCard[], tag: string) => {
    for (const candidate of candidates) {
      if (!tagged.has(candidate)) {
        tagged.add(candidate);
        tags.set(candidate, tag);
        return;
      }
    }
  };
  claim(byPrice, "Lowest price");
  claim(bySpeed, "Fastest");
  claim(byStops, "Fewest stops");
  return picked.map((card) => ({
    ...card,
    tags: tags.has(card) ? [tags.get(card) as string] : [],
  }));
}

/** Map the snapshot options to tagged in-chat cards. */
export function flightOptionsToCards(options: FlightOption[]): FlightCard[] {
  return pickThreeCards(options.map(flightOptionToCard));
}

/** Deep link to the compare page for one search. */
export function buildFlightCompareUrl(query: {
  originCode: string;
  destinationCode: string;
  depart: string;
  return: string;
  adults: number;
}): string {
  const params = new URLSearchParams({
    from: query.originCode,
    to: query.destinationCode,
    depart: query.depart,
    return: query.return,
    adults: String(query.adults),
  });
  return `/travel/compare?${params.toString()}`;
}
