// Travel compare core for unit U3.
// Flights are live Duffel results. The snapshot below is copied verbatim from
// the unedited evidence file duffel-yyz-nyc-20261211.json in the run folder.
// Hotels have no live price source in this region, so hotels are a structured
// check-live-rates handoff with no prices. See u3-search-evidence-note.md.

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
  address: string;
  rating: number;
  reviewCount: number;
  placeId: string;
  website: string;
  checkLiveRatesUrl: string;
  price: null;
  priceNote: string;
};

// Live hotel identity and location from Places Search, Nov 16 2026.
// No live rate source worked in this region: Expedia and Agoda both failed
// with connector_country_not_allowed. Prices are null on purpose and hotel
// prices stay a Queued gap. Never fill price from another source.
export const HOTEL_HANDOFFS: HotelHandoff[] = [
  {
    name: "The Muse New York",
    address: "130 W 46th St, New York, NY, US",
    rating: 4.6,
    reviewCount: 571,
    placeId: "774477037069671",
    website: "https://www.themusehotel.com/",
    checkLiveRatesUrl: "https://www.themusehotel.com/",
    price: null,
    priceNote: "Live rate not available. Check the rate on the hotel site before booking.",
  },
  {
    name: "Millennium Hotel Broadway Times Square",
    address: "145 W 44th St, New York, NY, US",
    rating: 4.3,
    reviewCount: 986,
    placeId: "2504767233028997",
    website: "https://www.millenniumhotels.com/en/new-york/millennium-hotel-broadway-times-square/",
    checkLiveRatesUrl: "https://www.millenniumhotels.com/en/new-york/millennium-hotel-broadway-times-square/",
    price: null,
    priceNote: "Live rate not available. Check the rate on the hotel site before booking.",
  },
  {
    name: "Hyatt Centric Times Square New York",
    address: "135 W 45th St, New York, NY, US",
    rating: 4.7,
    reviewCount: 886,
    placeId: "1156288158285936",
    website: "https://www.hyatt.com/hyatt-centric/en-US/nycts-hyatt-centric-times-square",
    checkLiveRatesUrl: "https://www.hyatt.com/hyatt-centric/en-US/nycts-hyatt-centric-times-square",
    price: null,
    priceNote: "Live rate not available. Check the rate on the hotel site before booking.",
  },
];

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
  "Hotel prices are a Queued gap. No live hotel price source worked, so no hotel price is shown. " +
  "Check live rates on the hotel site or on Google Hotels before booking.";

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
