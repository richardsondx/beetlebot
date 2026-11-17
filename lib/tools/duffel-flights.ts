/**
 * Duffel flight search for chat. No SDK, plain fetch.
 * Live path needs DUFFEL_ACCESS_TOKEN. No token exists in the working copy
 * env today, so the saved snapshot in lib/travel/compare.ts is the fallback,
 * and every snapshot card carries the "Sample" label. A snapshot price is
 * never shown as live.
 */

import type { FlightCard, FlightCompareBlock } from "@/lib/chat/rich-message";
import {
  buildFlightCompareUrl,
  FLIGHT_SEARCH,
  flightOptionsToCards,
  pickThreeCards,
} from "@/lib/travel/compare";
import type { TripQuery } from "@/lib/travel/trip-parse";

export type FlightSearchResult = {
  cards: FlightCard[];
  source: "duffel_live" | "duffel_snapshot";
  checkedAt: string;
  offersTotal: number;
  /** The query the prices actually cover. Snapshot dates when the snapshot ran. */
  query: TripQuery;
};

export function hasDuffelToken(): boolean {
  return Boolean(process.env.DUFFEL_ACCESS_TOKEN?.trim());
}

/** The query the prices will actually cover, given the token situation. */
export function effectiveTripQuery(query: TripQuery): TripQuery {
  if (hasDuffelToken()) return query;
  return {
    ...query,
    depart: FLIGHT_SEARCH.departureDate,
    return: FLIGHT_SEARCH.returnDate,
  };
}

/** "PT1H56M" to "1h 56m". Unknown shapes pass through unchanged. */
export function formatIsoDuration(iso: string): string {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!match) return iso;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

type DuffelOffer = {
  id: string;
  total_amount: string;
  total_currency: string;
  tax_amount?: string | null;
  expires_at?: string | null;
  owner?: { name?: string; logo_symbol_url?: string | null };
  slices?: Array<{
    duration?: string;
    segments?: Array<{
      departing_at: string;
      arriving_at: string;
      origin?: { iata_code?: string };
      destination?: { iata_code?: string };
      operating_carrier_flight_number?: string;
      passengers?: Array<{ baggages?: Array<{ type?: string; quantity?: number }> }>;
    }>;
  }>;
  conditions?: {
    change_before_departure?: { allowed?: boolean; penalty_amount?: string | null; penalty_currency?: string | null };
    refund_before_departure?: { allowed?: boolean; penalty_amount?: string | null; penalty_currency?: string | null };
  };
};

function mapDuffelOffer(offer: DuffelOffer): FlightCard | null {
  const outboundSlice = offer.slices?.[0];
  const returnSlice = offer.slices?.[1];
  if (!outboundSlice || !returnSlice) return null;
  const mapLeg = (slice: NonNullable<DuffelOffer["slices"]>[number]) => {
    const segments = slice.segments ?? [];
    const first = segments[0];
    const last = segments[segments.length - 1];
    if (!first || !last) return null;
    return {
      from: first.origin?.iata_code ?? "",
      to: last.destination?.iata_code ?? "",
      departAt: first.departing_at,
      arriveAt: last.arriving_at,
      duration: formatIsoDuration(slice.duration ?? ""),
      stops: Math.max(0, segments.length - 1),
      flightNumbers: segments
        .map((s) => s.operating_carrier_flight_number ?? "")
        .filter(Boolean),
    };
  };
  const outbound = mapLeg(outboundSlice);
  const ret = mapLeg(returnSlice);
  if (!outbound || !ret) return null;
  const total = Number(offer.total_amount);
  if (!Number.isFinite(total)) return null;
  const change = offer.conditions?.change_before_departure;
  const refund = offer.conditions?.refund_before_departure;
  const carryOn = (outboundSlice.segments ?? []).reduce((sum, seg) => {
    const bags = (seg.passengers ?? []).flatMap((p) => p.baggages ?? []);
    return sum + bags.filter((b) => b.type === "carry_on").reduce((n, b) => n + (b.quantity ?? 0), 0);
  }, 0);
  const expired = offer.expires_at ? new Date(offer.expires_at).getTime() < Date.now() : false;
  return {
    id: offer.id,
    offerId: offer.id,
    airline: offer.owner?.name ?? "Airline",
    logoUrl: offer.owner?.logo_symbol_url ?? undefined,
    outbound,
    return: ret,
    stops: outbound.stops + ret.stops,
    duration: formatIsoDuration(outboundSlice.duration ?? ""),
    totalAmount: total,
    currency: offer.total_currency,
    taxAmount: offer.tax_amount ? Number(offer.tax_amount) : undefined,
    changeable: change?.allowed === true,
    refundable: refund?.allowed === true,
    changeFee:
      change?.allowed && change.penalty_amount
        ? `${change.penalty_currency ?? ""} ${change.penalty_amount}`.trim()
        : undefined,
    carryOnBags: carryOn,
    tags: [],
    expired,
  };
}

async function searchDuffelLive(query: TripQuery): Promise<FlightSearchResult> {
  const token = process.env.DUFFEL_ACCESS_TOKEN?.trim() ?? "";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(
      "https://api.duffel.com/air/offer_requests?return_offers=true",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Duffel-Version": "v2",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          data: {
            slices: [
              {
                origin: query.originCode,
                destination: query.destinationCode,
                departure_date: query.depart,
              },
              {
                origin: query.destinationCode,
                destination: query.originCode,
                departure_date: query.return,
              },
            ],
            passengers: Array.from({ length: query.adults }, () => ({ type: "adult" })),
            cabin_class: "economy",
          },
        }),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw new Error(`Duffel request failed (${response.status})`);
    }
    const payload = (await response.json()) as {
      data?: { offers?: DuffelOffer[] };
    };
    const offers = (payload.data?.offers ?? [])
      .map(mapDuffelOffer)
      .filter((c): c is FlightCard => c !== null);
    if (offers.length === 0) throw new Error("Duffel returned no usable offers");
    return {
      cards: pickThreeCards(offers),
      source: "duffel_live",
      checkedAt: new Date().toISOString(),
      offersTotal: offers.length,
      query,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function searchSnapshot(query: TripQuery): FlightSearchResult {
  return {
    cards: flightOptionsToCards(FLIGHT_SEARCH.options).map((card) => ({
      ...card,
      tags: [...card.tags, "Sample"],
    })),
    source: "duffel_snapshot",
    checkedAt: FLIGHT_SEARCH.searchedAt,
    offersTotal: FLIGHT_SEARCH.offersTotal,
    query: {
      ...query,
      depart: FLIGHT_SEARCH.departureDate,
      return: FLIGHT_SEARCH.returnDate,
    },
  };
}

/** Search Duffel when a token exists, otherwise the saved snapshot. */
export async function searchFlights(query: TripQuery): Promise<FlightSearchResult> {
  if (hasDuffelToken()) {
    try {
      return await searchDuffelLive(query);
    } catch {
      // Live failed: the reply still goes out, with the snapshot labelled.
      return searchSnapshot(query);
    }
  }
  return searchSnapshot(query);
}

/** Build the in-chat block from a search result. */
export function toFlightCompareBlock(
  result: FlightSearchResult,
  searchId = "duffel-yyz-nyc-20261211",
): FlightCompareBlock {
  return {
    type: "flight_compare",
    searchId,
    query: {
      origin: result.query.origin,
      destination: result.query.destination,
      originCode: result.query.originCode,
      destinationCode: result.query.destinationCode,
      depart: result.query.depart,
      return: result.query.return,
      adults: result.query.adults,
    },
    offers: result.cards,
    source: result.source,
    checkedAt: result.checkedAt,
    offersTotal: result.offersTotal,
    compareUrl: buildFlightCompareUrl({
      originCode: result.query.originCode,
      destinationCode: result.query.destinationCode,
      depart: result.query.depart,
      return: result.query.return,
      adults: result.query.adults,
    }),
  };
}
