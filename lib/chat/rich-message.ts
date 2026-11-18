import { formatFlightRange } from "@/lib/travel/compare";
import { PRICE_PENDING_LABEL } from "@/lib/travel/destination-suggestion";

/**
 * Canonical rich-message types shared across web UI, CLI, and channel adapters.
 *
 * Design rule: every block MUST be representable as plain text + URL so that
 * CLI and messaging channels that cannot render images still work correctly.
 */

// ── Block types ────────────────────────────────────────────────────────────

export type CompareRow = { label: string; value: string };

export type ImageCard = {
  type: "image_card";
  title: string;
  subtitle?: string;
  imageUrl: string;
  alt?: string;
  /** Badge shown on the photo corner, for example "Beach". */
  category?: string;
  /** Fixed label/value rows under the title, used by the compare variant. */
  compareRows?: CompareRow[];
  /** Structured metadata chips: price, rating, neighborhood, distance, etc. */
  meta?: Record<string, string>;
  /** Deep-link to booking/detail page */
  actionUrl?: string;
  /** Attribution label (e.g. "Google Hotels", "Unsplash / @photographer") */
  sourceName?: string;
  /** True when no price exists yet; the UI shows "Price coming soon" where the price would go. */
  pricePending?: boolean;
  /** Extra real photos of the same place, at most 5 total with the hero. Shown when the photo is tapped. */
  gallery?: Array<{ imageUrl: string; sourceName?: string }>;
};

export type TextBlock = {
  type: "text_block";
  text: string;
};

export type ImageGallery = {
  type: "image_gallery";
  /** Maximum 5 cards */
  items: ImageCard[];
};

export type OptionSet = {
  type: "option_set";
  prompt?: string;
  /** "compare" renders aligned rows, 3 across on desktop, swipe on phone. */
  variant?: "default" | "compare";
  items: Array<{
    index: number;
    card: ImageCard;
  }>;
};

// ── Flight compare block (in-chat Duffel results) ───────────────────────────

export type FlightLeg = {
  from: string;
  to: string;
  departAt: string;
  arriveAt: string;
  duration: string;
  stops: number;
  flightNumbers: string[];
};

export type FlightCard = {
  id: string;
  offerId?: string;
  airline: string;
  logoUrl?: string;
  outbound: FlightLeg;
  return: FlightLeg;
  stops: number;
  /** Total round-trip time, for example "3h51m". */
  duration: string;
  totalAmount: number;
  currency: string;
  taxAmount?: number;
  changeable: boolean;
  refundable: boolean;
  changeFee?: string;
  carryOnBags: number;
  /** At most one tag per card: "Lowest price", "Fastest", "Fewest stops", or "Sample". */
  tags: string[];
  bookUrl?: string;
  /** True when the Duffel offer expired before the tap. */
  expired?: boolean;
};

export type FlightCompareBlock = {
  type: "flight_compare";
  searchId: string;
  query: {
    origin: string;
    destination: string;
    originCode: string;
    destinationCode: string;
    depart: string;
    return: string;
    adults: number;
  };
  offers: FlightCard[];
  source: "duffel_live" | "duffel_snapshot";
  checkedAt: string;
  offersTotal: number;
  compareUrl: string;
  /** True when the live search failed and the model reply still went out. */
  failed?: boolean;
};

// ── Map strip block (hotel pin plus numbered day stops) ───────────────────

export type MapStripStop = {
  /** Pin number, 1-based. Null when the stop has no coordinates. */
  pin: number | null;
  name: string;
  day?: number;
  distanceText: string | null;
  walkText: string | null;
  mapsUrl: string;
};

export type MapStripBlock = {
  type: "map_strip";
  hotelName: string;
  hotelLat: number;
  hotelLng: number;
  hotelMapsUrl: string;
  /** Static Maps image URL, null when no Google key exists. */
  staticMapsUrl: string | null;
  /** Named reason shown when no map image exists. */
  mapFallback: string;
  stops: MapStripStop[];
};

// ── Near your hotel row (places within 800 m) ─────────────────────────────

export type NearbyPlaceCard = {
  name: string;
  category: string;
  rating: number | null;
  walkText: string;
  mapsUrl: string;
  photoUrl: string | null;
  photoSourceName: string | null;
  photoFallback: string;
};

export type NearbyRowBlock = {
  type: "nearby_row";
  hotelName: string;
  places: NearbyPlaceCard[];
  /** Empty state text, shown when no place is within 800 m. */
  emptyText: string;
};

// ── Visual itinerary timeline (one card per day, stops vertical) ───────────

export type ItineraryTimelineStop = {
  /** Pin number, 1-based, matching the map strip. Null when unpinned. */
  pin: number | null;
  name: string;
  /** Suggested start time, for example "09:00". */
  time: string;
  category?: string;
  /** From-hotel distance line, for example "1.2 km from hotel · ~14 min walk". */
  distanceLine: string | null;
  mapsUrl: string;
  /** Real stop photo, null when none resolved; the row then stays compact text. */
  photoUrl: string | null;
  photoSourceName: string | null;
  photoFallback: string;
};

export type ItineraryTimelineDay = {
  day: number;
  /** "Day 2 · Tue" when a start date is known, else "Day 2". */
  label: string;
  stops: ItineraryTimelineStop[];
};

export type ItineraryTimelineBlock = {
  type: "itinerary_timeline";
  hotelName: string;
  days: ItineraryTimelineDay[];
};

// ── Destination preview block (visual field guide, not a pick grid) ─────

/** Source label on a preview section: model-written or Wikipedia text. */
export type PreviewSectionLabel = "General guidance" | "From Wikipedia";

/** One section of a destination preview, in design section 2 order. */
export type DestinationPreviewSection = {
  kind:
    | "what_it_is_like"
    | "why_it_fits"
    | "highlights"
    | "best_time"
    | "honest_take"
    | "stay"
    | "map"
    | "nearby"
    | "sample_day"
    | "practical_notes";
  heading: string;
  /** Small source label shown on the section. */
  label?: PreviewSectionLabel;
  /** Source link for Wikipedia text. */
  sourceUrl?: string;
  /** Plain body for text sections (what it's like, why it fits, best time). */
  body?: string;
  /** Short bullets for highlights. */
  bullets?: string[];
  /** Label/value rows for the honest take (good for, suits, trade-offs). */
  rows?: Array<{ label: string; value: string }>;
  /** Where you'd stay: hotel seed plus one line on why it fits. */
  hotel?: {
    name: string;
    area: string;
    whyItFits: string;
    photoUrl?: string;
    photoSourceName?: string;
    photoFallback?: string;
  };
  /** Where things are: embedded map strip block. */
  map?: MapStripBlock;
  /** What's nearby: embedded nearby row block. */
  nearby?: NearbyRowBlock;
  /** What a day could look like: embedded single-day timeline block. */
  day?: ItineraryTimelineBlock;
  /** Practical notes: getting there plus Sample figures, never a live price. */
  practical?: {
    gettingThere?: string;
    /** Sample round-trip flight line, for example "CA$1,240 Sample". */
    flight?: string;
    /** Sample nightly line, for example "$420 per night Sample". */
    nightly?: string;
    /** True when no Sample figures exist: the line reads "Price coming soon". */
    pricePending: boolean;
  };
  /**
   * In the three-place case the map, nearby, and sample-day sections
   * start collapsed behind "Show where things are and a sample day".
   */
  collapsed?: boolean;
};

export type DestinationPreviewBlock = {
  type: "destination_preview";
  place: string;
  /** Country line under the place name, for example "Bali, Indonesia". */
  countryLine: string;
  /** Real hero photo URL, "" when none resolved (named fallback renders). */
  heroPhotoUrl: string;
  heroPhotoSourceName?: string;
  /** Named reason shown when no hero photo exists. */
  heroPhotoFallback: string;
  wikiUrl: string;
  /** Sections 2 to 11 in design order; the hero is section 1. */
  sections: DestinationPreviewSection[];
  /** Short line introducing the set, shown after the last of three previews. */
  setLine?: string;
  /** Closing line shown under the preview (section 12). */
  closingLine?: string;
};

// ── Hotel set block (in-chat Hello Axel prices) ─────────────────────────────

export type HotelPrice = {
  nightly: number | null;
  total: number | null;
  currency: string;
  adults: number;
  nights: number;
  /** True when the nightly rate was derived from the stay total, not sourced. */
  derived: boolean;
};

export type HotelCard = {
  id: string;
  name: string;
  area: string;
  stars: number | null;
  price: HotelPrice | null;
  source: string;
  sourceUrl: string;
  checkedAt: string | null;
  feeNote?: string;
  /** Real hotel photo URL, when a photo source returned one. */
  photoUrl?: string;
  /** Who supplied the hotel photo, for example "Wikipedia". */
  photoSourceName?: string;
  /** Named reason shown when no hotel photo exists, for example "No hotel photo found". */
  photoFallback?: string;
};

export type HotelSetBlock = {
  type: "hotel_set";
  stay: { checkIn: string; checkOut: string; adults: number };
  hotels: HotelCard[];
  checkedAt: string;
};

export type FollowUp = {
  label: string;
  message: string;
};

export type RichBlock =
  | TextBlock
  | ImageCard
  | ImageGallery
  | OptionSet
  | FlightCompareBlock
  | HotelSetBlock
  | MapStripBlock
  | NearbyRowBlock
  | ItineraryTimelineBlock
  | DestinationPreviewBlock;

// ── Top-level message ──────────────────────────────────────────────────────

export type AssistantMessage = {
  /** Always-present plain-text fallback used by CLI and simple channels */
  text: string;
  blocks?: RichBlock[];
  /** Tappable follow-ups shown under the latest reply only. */
  followUps?: FollowUp[];
};

// ── Plain-text serializer (CLI / channel fallback) ─────────────────────────

export function toPlainText(msg: AssistantMessage): string {
  if (!msg.blocks?.length) return msg.text;

  const parts: string[] = [msg.text];

  for (const block of msg.blocks) {
    switch (block.type) {
      case "text_block":
        parts.push(block.text);
        break;
      case "image_card":
        parts.push(cardToText(block));
        break;
      case "image_gallery":
        block.items.forEach((item, i) =>
          parts.push(`[${i + 1}] ${cardToText(item)}`),
        );
        break;
      case "option_set":
        if (block.prompt) parts.push(block.prompt);
        block.items.forEach(({ index, card }) => {
          if (block.variant === "compare" && card.compareRows?.length) {
            const row = (label: string) =>
              card.compareRows?.find((r) => r.label === label)?.value;
            const price = row("Per night") ?? row("Price") ?? PRICE_PENDING_LABEL;
            parts.push(
              `${index}. ${card.title}, ${card.subtitle ?? row("Country") ?? ""} — ${row("Hotel") ?? "No hotel in seed data"} — ${price} — ${card.actionUrl ?? card.imageUrl}`,
            );
          } else {
            parts.push(`[${index}] ${cardToText(card)}`);
          }
        });
        break;
      case "flight_compare": {
        block.offers.forEach((offer, i) => {
          const out = formatFlightRange(offer.outbound.departAt, offer.outbound.arriveAt);
          parts.push(
            `${i + 1}. ${offer.airline}, ${out}, ${offer.stops === 0 ? "nonstop" : `${offer.stops} stop${offer.stops > 1 ? "s" : ""}`}, ${formatMoney(offer.totalAmount, offer.currency)} incl. taxes`,
          );
        });
        parts.push(`Compare all: ${block.compareUrl}`);
        parts.push("Reply 1, 2, or 3 to pick.");
        break;
      }
      case "hotel_set": {
        block.hotels.forEach((hotel, i) => {
          const price = hotelPriceText(hotel);
          parts.push(
            `${i + 1}. ${hotel.name}, ${hotel.area}, ${hotel.stars ? `${hotel.stars} star` : "stars not listed"}, ${price} (${hotel.source}, ${hotel.price?.adults ?? block.stay.adults} adults) ${hotel.sourceUrl}`,
          );
          parts.push(
            hotel.photoUrl
              ? `(photo: ${hotel.photoSourceName ?? "hotel photo"} ${hotel.photoUrl})`
              : `(no hotel photo: ${hotel.photoFallback ?? "No hotel photo found"})`,
          );
        });
        parts.push("Reply 1, 2, or 3 to pick.");
        break;
      }
      case "map_strip": {
        parts.push(`Map near ${block.hotelName}`);
        if (block.staticMapsUrl) parts.push(block.staticMapsUrl);
        block.stops.forEach((stop) => {
          if (stop.pin === null) {
            parts.push(`${stop.name} · location unknown · ${stop.mapsUrl}`);
          } else {
            parts.push(
              `${stop.pin} · ${stop.name} · ${stop.distanceText} · ${stop.walkText} · ${stop.mapsUrl}`,
            );
          }
        });
        parts.push(`Hotel on Google Maps: ${block.hotelMapsUrl}`);
        break;
      }
      case "nearby_row": {
        parts.push(`Near ${block.hotelName}`);
        if (block.places.length === 0) {
          parts.push(block.emptyText);
          break;
        }
        block.places.forEach((place) => {
          const rating =
            place.rating !== null ? `, ${place.rating} stars` : "";
          parts.push(
            `${place.name} (${place.category}${rating}) · ${place.walkText} · ${place.mapsUrl}`,
          );
        });
        break;
      }
      case "itinerary_timeline": {
        parts.push(`Itinerary near ${block.hotelName} (times are suggested)`);
        block.days.forEach((day) => {
          day.stops.forEach((stop) => {
            const walk = stop.distanceLine
              ? (stop.distanceLine.split(" · ").pop() ?? stop.distanceLine)
              : "location unknown";
            parts.push(
              `Day ${day.day}: ${stop.time} ${stop.name} (${walk}) ${stop.mapsUrl}`,
            );
          });
        });
        break;
      }
      case "destination_preview": {
        parts.push(destinationPreviewToText(block));
        break;
      }
    }
  }

  return parts.filter(Boolean).join("\n\n");
}

/**
 * Plain-text fallback for a destination preview: the hero line, then
 * each section as a headed line in the same order as the rich render.
 * Collapsed sections in the three-place case still print, so the
 * fallback loses nothing.
 */
export function destinationPreviewToText(block: DestinationPreviewBlock): string {
  const lines: string[] = [
    block.countryLine,
    block.heroPhotoUrl
      ? `(photo: ${block.heroPhotoSourceName ?? "photo"} ${block.heroPhotoUrl})`
      : `(no photo: ${block.heroPhotoFallback})`,
  ];
  for (const section of block.sections) {
    const label = section.label ? ` (${section.label})` : "";
    switch (section.kind) {
      case "what_it_is_like":
      case "why_it_fits":
      case "best_time":
        if (section.body) {
          lines.push(`${section.heading}${label}: ${section.body}`);
          if (section.sourceUrl) lines.push(`Source: ${section.sourceUrl}`);
        }
        break;
      case "highlights":
        if (section.bullets?.length) {
          lines.push(`${section.heading}${label}:`);
          section.bullets.forEach((b) => lines.push(`- ${b}`));
        }
        break;
      case "honest_take":
        if (section.rows?.length) {
          lines.push(`${section.heading}${label}:`);
          section.rows.forEach((r) => lines.push(`${r.label}: ${r.value}`));
        }
        break;
      case "stay":
        if (section.hotel) {
          lines.push(
            `${section.heading}${label}: ${section.hotel.name}, ${section.hotel.area}. ${section.hotel.whyItFits}`,
          );
          lines.push(
            section.hotel.photoUrl
              ? `(hotel photo: ${section.hotel.photoSourceName ?? "hotel photo"} ${section.hotel.photoUrl})`
              : `(no hotel photo: ${section.hotel.photoFallback ?? "No hotel photo found"})`,
          );
        }
        break;
      case "map":
        if (section.map) {
          lines.push(`${section.heading}:`);
          lines.push(`Map near ${section.map.hotelName}`);
          if (section.map.staticMapsUrl) lines.push(section.map.staticMapsUrl);
          section.map.stops.forEach((stop) => {
            lines.push(
              stop.pin === null
                ? `${stop.name} · location unknown · ${stop.mapsUrl}`
                : `${stop.pin} · ${stop.name} · ${stop.distanceText} · ${stop.walkText} · ${stop.mapsUrl}`,
            );
          });
        }
        break;
      case "nearby":
        if (section.nearby) {
          lines.push(`${section.heading}:`);
          if (section.nearby.places.length === 0) {
            lines.push(section.nearby.emptyText);
          } else {
            section.nearby.places.forEach((place) => {
              lines.push(
                `${place.name} (${place.category}) · ${place.walkText} · ${place.mapsUrl}`,
              );
            });
          }
        }
        break;
      case "sample_day":
        if (section.day) {
          lines.push(`${section.heading} (times are suggested):`);
          section.day.days.forEach((day) => {
            day.stops.forEach((stop) => {
              const walk = stop.distanceLine
                ? (stop.distanceLine.split(" · ").pop() ?? stop.distanceLine)
                : "location unknown";
              lines.push(
                `Day ${day.day}: ${stop.time} ${stop.name} (${walk}) ${stop.mapsUrl}`,
              );
            });
          });
        }
        break;
      case "practical_notes": {
        if (!section.practical) break;
        const p = section.practical;
        const bits: string[] = [];
        if (p.gettingThere) bits.push(p.gettingThere);
        if (p.pricePending) {
          bits.push(`Price: ${PRICE_PENDING_LABEL}`);
        } else {
          if (p.flight) bits.push(`Flight from Canada: ${p.flight}`);
          if (p.nightly) bits.push(`Hotel: ${p.nightly}`);
        }
        bits.push("Beetlebot does not book.");
        lines.push(`${section.heading}${label}: ${bits.join(" ")}`);
        break;
      }
    }
  }
  if (block.setLine) lines.push(block.setLine);
  if (block.closingLine) lines.push(block.closingLine);
  lines.push(block.wikiUrl);
  return lines.filter(Boolean).join("\n");
}

/** "CA$377.68" for CAD, "$373" for USD. Falls back to a plain amount. */
export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount}`;
  }
}

/** One-line price text for a hotel card, honouring the derived "about" label. */
export function hotelPriceText(hotel: HotelCard): string {
  if (!hotel.price) return "No live price yet";
  const { nightly, total, currency, nights, derived } = hotel.price;
  if (nightly !== null) {
    const base = `${formatMoney(nightly, currency)} a night`;
    return derived ? `about ${base}, from ${formatMoney(total ?? 0, currency)} total` : base;
  }
  if (total !== null) {
    return `${formatMoney(total, currency)} total, ${nights} nights`;
  }
  return "No live price yet";
}

/** Validate an untrusted flight_compare block, dropping bad fields. */
export function isFlightCompareBlock(raw: unknown): FlightCompareBlock | null {
  const b = raw as Record<string, unknown>;
  if (!b || b.type !== "flight_compare") return null;
  if (!Array.isArray(b.offers) || b.offers.length === 0) return null;
  const query = b.query as Record<string, unknown> | undefined;
  const offers: FlightCard[] = [];
  for (const rawOffer of b.offers.slice(0, 5)) {
    const o = rawOffer as Record<string, unknown>;
    const outbound = validLeg(o.outbound);
    const ret = validLeg(o.return);
    if (
      typeof o.id !== "string" ||
      typeof o.airline !== "string" ||
      !o.airline.trim() ||
      !outbound ||
      !ret ||
      typeof o.totalAmount !== "number" ||
      !Number.isFinite(o.totalAmount)
    ) {
      continue;
    }
    offers.push({
      id: o.id.slice(0, 120),
      offerId: typeof o.offerId === "string" ? o.offerId.slice(0, 120) : undefined,
      airline: o.airline.slice(0, 120),
      logoUrl: typeof o.logoUrl === "string" ? o.logoUrl.slice(0, 2048) : undefined,
      outbound,
      return: ret,
      stops: typeof o.stops === "number" ? o.stops : 0,
      duration: typeof o.duration === "string" ? o.duration.slice(0, 20) : "",
      totalAmount: o.totalAmount,
      currency: typeof o.currency === "string" ? o.currency.slice(0, 8) : "CAD",
      taxAmount: typeof o.taxAmount === "number" ? o.taxAmount : undefined,
      changeable: o.changeable === true,
      refundable: o.refundable === true,
      changeFee: typeof o.changeFee === "string" ? o.changeFee.slice(0, 80) : undefined,
      carryOnBags: typeof o.carryOnBags === "number" ? o.carryOnBags : 0,
      tags: Array.isArray(o.tags)
        ? (o.tags as unknown[]).filter((t): t is string => typeof t === "string").slice(0, 2)
        : [],
      bookUrl: typeof o.bookUrl === "string" ? o.bookUrl.slice(0, 2048) : undefined,
      expired: o.expired === true,
    });
  }
  if (offers.length === 0) return null;
  return {
    type: "flight_compare",
    searchId: typeof b.searchId === "string" ? b.searchId.slice(0, 120) : "snapshot",
    query: {
      origin: typeof query?.origin === "string" ? query.origin.slice(0, 80) : "",
      destination: typeof query?.destination === "string" ? query.destination.slice(0, 80) : "",
      originCode: typeof query?.originCode === "string" ? query.originCode.slice(0, 8) : "",
      destinationCode: typeof query?.destinationCode === "string" ? query.destinationCode.slice(0, 8) : "",
      depart: typeof query?.depart === "string" ? query.depart.slice(0, 12) : "",
      return: typeof query?.return === "string" ? query.return.slice(0, 12) : "",
      adults: typeof query?.adults === "number" ? query.adults : 1,
    },
    offers,
    source: b.source === "duffel_live" ? "duffel_live" : "duffel_snapshot",
    checkedAt: typeof b.checkedAt === "string" ? b.checkedAt.slice(0, 40) : "",
    offersTotal: typeof b.offersTotal === "number" ? b.offersTotal : offers.length,
    compareUrl: typeof b.compareUrl === "string" ? b.compareUrl.slice(0, 2048) : "/travel/compare",
    failed: b.failed === true,
  };
}

function validLeg(raw: unknown): FlightLeg | null {
  const l = raw as Record<string, unknown> | null;
  if (!l) return null;
  if (
    typeof l.from !== "string" ||
    typeof l.to !== "string" ||
    typeof l.departAt !== "string" ||
    typeof l.arriveAt !== "string"
  ) {
    return null;
  }
  return {
    from: l.from.slice(0, 8),
    to: l.to.slice(0, 8),
    departAt: l.departAt.slice(0, 40),
    arriveAt: l.arriveAt.slice(0, 40),
    duration: typeof l.duration === "string" ? l.duration.slice(0, 20) : "",
    stops: typeof l.stops === "number" ? l.stops : 0,
    flightNumbers: Array.isArray(l.flightNumbers)
      ? (l.flightNumbers as unknown[]).filter((n): n is string => typeof n === "string").slice(0, 4)
      : [],
  };
}

/** Validate an untrusted hotel_set block, dropping bad fields. */
export function isHotelSetBlock(raw: unknown): HotelSetBlock | null {
  const b = raw as Record<string, unknown>;
  if (!b || b.type !== "hotel_set") return null;
  if (!Array.isArray(b.hotels) || b.hotels.length === 0) return null;
  const stay = b.stay as Record<string, unknown> | undefined;
  const hotels: HotelCard[] = [];
  for (const rawHotel of b.hotels.slice(0, 5)) {
    const h = rawHotel as Record<string, unknown>;
    if (typeof h.id !== "string" || typeof h.name !== "string" || !h.name.trim()) continue;
    const price = h.price as Record<string, unknown> | null;
    hotels.push({
      id: h.id.slice(0, 120),
      name: h.name.slice(0, 120),
      area: typeof h.area === "string" ? h.area.slice(0, 120) : "",
      stars: typeof h.stars === "number" ? h.stars : null,
      price:
        price && typeof price === "object"
          ? {
              nightly: typeof price.nightly === "number" ? price.nightly : null,
              total: typeof price.total === "number" ? price.total : null,
              currency: typeof price.currency === "string" ? price.currency.slice(0, 8) : "USD",
              adults: typeof price.adults === "number" ? price.adults : 1,
              nights: typeof price.nights === "number" ? price.nights : 1,
              derived: price.derived === true,
            }
          : null,
      source: typeof h.source === "string" ? h.source.slice(0, 80) : "",
      sourceUrl: typeof h.sourceUrl === "string" ? h.sourceUrl.slice(0, 2048) : "",
      checkedAt: typeof h.checkedAt === "string" ? h.checkedAt.slice(0, 40) : null,
      feeNote: typeof h.feeNote === "string" ? h.feeNote.slice(0, 200) : undefined,
      photoUrl:
        typeof h.photoUrl === "string" && h.photoUrl.startsWith("https://")
          ? h.photoUrl.slice(0, 2048)
          : undefined,
      photoSourceName:
        typeof h.photoSourceName === "string" ? h.photoSourceName.slice(0, 100) : undefined,
      photoFallback:
        typeof h.photoFallback === "string" ? h.photoFallback.slice(0, 200) : undefined,
    });
  }
  if (hotels.length === 0) return null;
  return {
    type: "hotel_set",
    stay: {
      checkIn: typeof stay?.checkIn === "string" ? stay.checkIn.slice(0, 12) : "",
      checkOut: typeof stay?.checkOut === "string" ? stay.checkOut.slice(0, 12) : "",
      adults: typeof stay?.adults === "number" ? stay.adults : 1,
    },
    hotels,
    checkedAt: typeof b.checkedAt === "string" ? b.checkedAt.slice(0, 40) : "",
  };
}

/** Validate an untrusted map_strip block, dropping bad fields. */
export function isMapStripBlock(raw: unknown): MapStripBlock | null {
  const b = raw as Record<string, unknown>;
  if (!b || b.type !== "map_strip") return null;
  if (typeof b.hotelName !== "string" || !b.hotelName.trim()) return null;
  if (typeof b.hotelLat !== "number" || typeof b.hotelLng !== "number") return null;
  if (!Array.isArray(b.stops) || b.stops.length === 0) return null;
  const stops: MapStripStop[] = [];
  for (const rawStop of b.stops.slice(0, 12)) {
    const s = rawStop as Record<string, unknown>;
    if (typeof s.name !== "string" || !s.name.trim()) continue;
    if (typeof s.mapsUrl !== "string" || !s.mapsUrl.startsWith("https://")) continue;
    stops.push({
      pin:
        typeof s.pin === "number" && Number.isInteger(s.pin) && s.pin > 0
          ? s.pin
          : null,
      name: s.name.slice(0, 200),
      day: typeof s.day === "number" ? s.day : undefined,
      distanceText:
        typeof s.distanceText === "string" ? s.distanceText.slice(0, 40) : null,
      walkText:
        typeof s.walkText === "string" ? s.walkText.slice(0, 40) : null,
      mapsUrl: s.mapsUrl.slice(0, 2048),
    });
  }
  if (stops.length === 0) return null;
  return {
    type: "map_strip",
    hotelName: b.hotelName.slice(0, 200),
    hotelLat: b.hotelLat,
    hotelLng: b.hotelLng,
    hotelMapsUrl:
      typeof b.hotelMapsUrl === "string" && b.hotelMapsUrl.startsWith("https://")
        ? b.hotelMapsUrl.slice(0, 2048)
        : `https://www.google.com/maps/search/?api=1&query=${b.hotelLat},${b.hotelLng}`,
    staticMapsUrl:
      typeof b.staticMapsUrl === "string" && b.staticMapsUrl.startsWith("https://")
        ? b.staticMapsUrl.slice(0, 2048)
        : null,
    mapFallback:
      typeof b.mapFallback === "string" ? b.mapFallback.slice(0, 300) : "",
    stops,
  };
}

/** Validate an untrusted nearby_row block, dropping bad fields. */
export function isNearbyRowBlock(raw: unknown): NearbyRowBlock | null {
  const b = raw as Record<string, unknown>;
  if (!b || b.type !== "nearby_row") return null;
  if (typeof b.hotelName !== "string" || !b.hotelName.trim()) return null;
  if (!Array.isArray(b.places)) return null;
  const places: NearbyPlaceCard[] = [];
  for (const rawPlace of b.places.slice(0, 5)) {
    const p = rawPlace as Record<string, unknown>;
    if (typeof p.name !== "string" || !p.name.trim()) continue;
    if (typeof p.mapsUrl !== "string" || !p.mapsUrl.startsWith("https://")) continue;
    places.push({
      name: p.name.slice(0, 200),
      category: typeof p.category === "string" ? p.category.slice(0, 50) : "",
      rating:
        typeof p.rating === "number" && Number.isFinite(p.rating) ? p.rating : null,
      walkText: typeof p.walkText === "string" ? p.walkText.slice(0, 40) : "",
      mapsUrl: p.mapsUrl.slice(0, 2048),
      photoUrl:
        typeof p.photoUrl === "string" && p.photoUrl.startsWith("https://")
          ? p.photoUrl.slice(0, 2048)
          : null,
      photoSourceName:
        typeof p.photoSourceName === "string"
          ? p.photoSourceName.slice(0, 100)
          : null,
      photoFallback:
        typeof p.photoFallback === "string" ? p.photoFallback.slice(0, 200) : "No photo found",
    });
  }
  return {
    type: "nearby_row",
    hotelName: b.hotelName.slice(0, 200),
    places,
    emptyText:
      typeof b.emptyText === "string" && b.emptyText.trim()
        ? b.emptyText.slice(0, 200)
        : "Nothing found within a 10 min walk",
  };
}

/** Validate an untrusted itinerary_timeline block, dropping bad fields. */
export function isItineraryTimelineBlock(raw: unknown): ItineraryTimelineBlock | null {
  const b = raw as Record<string, unknown>;
  if (!b || b.type !== "itinerary_timeline") return null;
  if (typeof b.hotelName !== "string" || !b.hotelName.trim()) return null;
  if (!Array.isArray(b.days) || b.days.length === 0) return null;
  const days: ItineraryTimelineDay[] = [];
  for (const rawDay of b.days.slice(0, 14)) {
    const d = rawDay as Record<string, unknown>;
    if (typeof d.day !== "number" || !Array.isArray(d.stops)) continue;
    const stops: ItineraryTimelineStop[] = [];
    for (const rawStop of (d.stops as unknown[]).slice(0, 12)) {
      const s = rawStop as Record<string, unknown>;
      if (typeof s.name !== "string" || !s.name.trim()) continue;
      if (typeof s.mapsUrl !== "string" || !s.mapsUrl.startsWith("https://")) continue;
      if (typeof s.time !== "string" || !s.time.trim()) continue;
      stops.push({
        pin:
          typeof s.pin === "number" && Number.isInteger(s.pin) && s.pin > 0
            ? s.pin
            : null,
        name: s.name.slice(0, 200),
        time: s.time.slice(0, 8),
        category:
          typeof s.category === "string" ? s.category.slice(0, 50) : undefined,
        distanceLine:
          typeof s.distanceLine === "string" ? s.distanceLine.slice(0, 80) : null,
        mapsUrl: s.mapsUrl.slice(0, 2048),
        photoUrl:
          typeof s.photoUrl === "string" && s.photoUrl.startsWith("https://")
            ? s.photoUrl.slice(0, 2048)
            : null,
        photoSourceName:
          typeof s.photoSourceName === "string"
            ? s.photoSourceName.slice(0, 100)
            : null,
        photoFallback:
          typeof s.photoFallback === "string" ? s.photoFallback.slice(0, 200) : "No photo found",
      });
    }
    if (stops.length === 0) continue;
    days.push({
      day: d.day,
      label:
        typeof d.label === "string" && d.label.trim()
          ? d.label.slice(0, 40)
          : `Day ${d.day}`,
      stops,
    });
  }
  if (days.length === 0) return null;
  return {
    type: "itinerary_timeline",
    hotelName: b.hotelName.slice(0, 200),
    days,
  };
}

/** Validate an untrusted destination_preview block, dropping bad fields. */
export function isDestinationPreviewBlock(raw: unknown): DestinationPreviewBlock | null {
  const b = raw as Record<string, unknown>;
  if (!b || b.type !== "destination_preview") return null;
  if (typeof b.place !== "string" || !b.place.trim()) return null;
  if (!Array.isArray(b.sections) || b.sections.length === 0) return null;
  const validKinds = new Set([
    "what_it_is_like",
    "why_it_fits",
    "highlights",
    "best_time",
    "honest_take",
    "stay",
    "map",
    "nearby",
    "sample_day",
    "practical_notes",
  ]);
  const sections: DestinationPreviewSection[] = [];
  for (const rawSection of b.sections.slice(0, 11)) {
    const s = rawSection as Record<string, unknown>;
    if (typeof s.kind !== "string" || !validKinds.has(s.kind)) continue;
    if (typeof s.heading !== "string" || !s.heading.trim()) continue;
    const kind = s.kind as DestinationPreviewSection["kind"];
    const label =
      s.label === "General guidance" || s.label === "From Wikipedia"
        ? s.label
        : undefined;
    const section: DestinationPreviewSection = {
      kind,
      heading: s.heading.slice(0, 60),
      label,
      sourceUrl:
        typeof s.sourceUrl === "string" && s.sourceUrl.startsWith("https://")
          ? s.sourceUrl.slice(0, 2048)
          : undefined,
      body: typeof s.body === "string" ? s.body.slice(0, 2000) : undefined,
      bullets: Array.isArray(s.bullets)
        ? (s.bullets as unknown[])
            .filter((x): x is string => typeof x === "string")
            .slice(0, 6)
            .map((x) => x.slice(0, 500))
        : undefined,
      rows: Array.isArray(s.rows)
        ? (s.rows as unknown[])
            .map((r) => r as Record<string, unknown>)
            .filter(
              (r) => typeof r.label === "string" && typeof r.value === "string",
            )
            .slice(0, 6)
            .map((r) => ({
              label: (r.label as string).slice(0, 60),
              value: (r.value as string).slice(0, 500),
            }))
        : undefined,
      collapsed: s.collapsed === true ? true : undefined,
    };
    if (s.hotel && typeof s.hotel === "object") {
      const h = s.hotel as Record<string, unknown>;
      if (typeof h.name === "string" && h.name.trim()) {
        section.hotel = {
          name: h.name.slice(0, 120),
          area: typeof h.area === "string" ? h.area.slice(0, 120) : "",
          whyItFits:
            typeof h.whyItFits === "string" ? h.whyItFits.slice(0, 500) : "",
          photoUrl:
            typeof h.photoUrl === "string" && h.photoUrl.startsWith("https://")
              ? h.photoUrl.slice(0, 2048)
              : undefined,
          photoSourceName:
            typeof h.photoSourceName === "string"
              ? h.photoSourceName.slice(0, 100)
              : undefined,
          photoFallback:
            typeof h.photoFallback === "string"
              ? h.photoFallback.slice(0, 200)
              : undefined,
        };
      }
    }
    if (s.map && typeof s.map === "object") {
      const map = isMapStripBlock(s.map);
      if (map) section.map = map;
    }
    if (s.nearby && typeof s.nearby === "object") {
      const nearby = isNearbyRowBlock(s.nearby);
      if (nearby) section.nearby = nearby;
    }
    if (s.day && typeof s.day === "object") {
      const day = isItineraryTimelineBlock(s.day);
      if (day) section.day = day;
    }
    if (s.practical && typeof s.practical === "object") {
      const p = s.practical as Record<string, unknown>;
      section.practical = {
        gettingThere:
          typeof p.gettingThere === "string"
            ? p.gettingThere.slice(0, 500)
            : undefined,
        flight:
          typeof p.flight === "string" ? p.flight.slice(0, 120) : undefined,
        nightly:
          typeof p.nightly === "string" ? p.nightly.slice(0, 120) : undefined,
        pricePending: p.pricePending === true,
      };
    }
    sections.push(section);
  }
  if (sections.length === 0) return null;
  return {
    type: "destination_preview",
    place: b.place.slice(0, 120),
    countryLine:
      typeof b.countryLine === "string" ? b.countryLine.slice(0, 200) : "",
    heroPhotoUrl:
      typeof b.heroPhotoUrl === "string" &&
      b.heroPhotoUrl.startsWith("https://")
        ? b.heroPhotoUrl.slice(0, 2048)
        : "",
    heroPhotoSourceName:
      typeof b.heroPhotoSourceName === "string"
        ? b.heroPhotoSourceName.slice(0, 100)
        : undefined,
    heroPhotoFallback:
      typeof b.heroPhotoFallback === "string"
        ? b.heroPhotoFallback.slice(0, 200)
        : "No photo found",
    wikiUrl:
      typeof b.wikiUrl === "string" && b.wikiUrl.startsWith("https://")
        ? b.wikiUrl.slice(0, 2048)
        : "",
    sections,
    setLine:
      typeof b.setLine === "string" ? b.setLine.slice(0, 500) : undefined,
    closingLine:
      typeof b.closingLine === "string"
        ? b.closingLine.slice(0, 500)
        : undefined,
  };
}

/** Serialize a single ImageCard to readable text with URL at the end. */
export function cardToText(card: ImageCard): string {
  const lines: string[] = [card.title];
  if (card.subtitle) lines.push(card.subtitle);
  if (card.compareRows?.length) {
    lines.push(
      card.compareRows.map((r) => `${r.label}: ${r.value}`).join(" · "),
    );
  }
  if (card.meta) {
    const chips = Object.entries(card.meta)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ");
    lines.push(chips);
  }
  if (card.pricePending) lines.push(`Price: ${PRICE_PENDING_LABEL}`);
  if (card.actionUrl) lines.push(card.actionUrl);
  if (card.sourceName) lines.push(`via ${card.sourceName}`);
  return lines.join("\n");
}

/** Extract all navigable options from blocks for CLI `/open <n>` */
export function extractOptions(
  msg: AssistantMessage,
): Array<{ index: number; title: string; url: string }> {
  if (!msg.blocks) return [];
  const out: Array<{ index: number; title: string; url: string }> = [];
  let counter = 1;

  for (const block of msg.blocks) {
    const candidates: ImageCard[] =
      block.type === "image_gallery"
        ? block.items
        : block.type === "option_set"
          ? block.items.map((i) => i.card)
          : block.type === "image_card"
            ? [block]
            : [];

    for (const card of candidates) {
      const url = card.actionUrl ?? card.imageUrl;
      if (url) {
        out.push({ index: counter++, title: card.title, url });
      }
    }

    if (block.type === "flight_compare") {
      out.push({
        index: counter++,
        title: `Compare all ${block.offersTotal} flight offers`,
        url: block.compareUrl,
      });
    }
    if (block.type === "hotel_set") {
      for (const hotel of block.hotels) {
        if (hotel.sourceUrl) {
          out.push({ index: counter++, title: hotel.name, url: hotel.sourceUrl });
        }
      }
    }
    if (block.type === "map_strip") {
      out.push({
        index: counter++,
        title: `Map near ${block.hotelName}`,
        url: block.hotelMapsUrl,
      });
      for (const stop of block.stops) {
        out.push({ index: counter++, title: stop.name, url: stop.mapsUrl });
      }
    }
    if (block.type === "nearby_row") {
      for (const place of block.places) {
        out.push({ index: counter++, title: place.name, url: place.mapsUrl });
      }
    }
    if (block.type === "itinerary_timeline") {
      for (const day of block.days) {
        for (const stop of day.stops) {
          out.push({ index: counter++, title: stop.name, url: stop.mapsUrl });
        }
      }
    }
    if (block.type === "destination_preview") {
      out.push({
        index: counter++,
        title: `${block.place} on Wikipedia`,
        url: block.wikiUrl,
      });
      for (const section of block.sections) {
        if (section.map) {
          out.push({
            index: counter++,
            title: `Map near ${section.map.hotelName}`,
            url: section.map.hotelMapsUrl,
          });
          for (const stop of section.map.stops) {
            out.push({ index: counter++, title: stop.name, url: stop.mapsUrl });
          }
        }
        if (section.nearby) {
          for (const place of section.nearby.places) {
            out.push({ index: counter++, title: place.name, url: place.mapsUrl });
          }
        }
        if (section.day) {
          for (const day of section.day.days) {
            for (const stop of day.stops) {
              out.push({ index: counter++, title: stop.name, url: stop.mapsUrl });
            }
          }
        }
      }
    }
  }

  return out;
}
