import { formatFlightRange } from "@/lib/travel/compare";

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
  | HotelSetBlock;

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
            parts.push(
              `${index}. ${card.title}, ${card.subtitle ?? row("Country") ?? ""} — ${row("Hotel") ?? "No hotel in seed data"} — ${row("Per night") ?? "Price not available"} — ${card.actionUrl ?? card.imageUrl}`,
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
    }
  }

  return parts.filter(Boolean).join("\n\n");
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
  }

  return out;
}
