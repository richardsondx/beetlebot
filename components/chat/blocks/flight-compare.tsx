"use client";

import { useState } from "react";
import type { FlightCard, FlightCompareBlock } from "@/lib/chat/rich-message";
import { formatMoney } from "@/lib/chat/rich-message";
import { formatFlightRange } from "@/lib/travel/compare";

function stopsLabel(stops: number): string {
  if (stops === 0) return "Nonstop";
  return `${stops} stop${stops > 1 ? "s" : ""}`;
}

function FlightCardView({
  card,
  selected,
  onSelect,
  onRefresh,
}: {
  card: FlightCard;
  selected: boolean;
  onSelect: () => void;
  onRefresh: () => void;
}) {
  const [rulesOpen, setRulesOpen] = useState(false);
  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-[#0d1422] transition-all ${
        selected
          ? "border-amber-300 shadow-lg shadow-amber-400/10"
          : "border-white/8 hover:border-amber-300/20"
      }`}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="block w-full p-4 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            {card.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={card.logoUrl} alt="" className="h-5 w-5 object-contain" />
            ) : null}
            <p className="text-sm font-semibold text-slate-100">{card.airline}</p>
          </div>
          {selected && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-amber-400 text-xs font-bold text-[#060b12]">
              ✓
            </span>
          )}
        </div>

        <div className="mt-3 space-y-1.5 text-xs text-slate-400">
          <p>
            <span className="text-slate-500">Out </span>
            {card.outbound.from} to {card.outbound.to} ·{" "}
            {formatFlightRange(card.outbound.departAt, card.outbound.arriveAt)}
          </p>
          <p>
            <span className="text-slate-500">Back </span>
            {card.return.from} to {card.return.to} ·{" "}
            {formatFlightRange(card.return.departAt, card.return.arriveAt)}
          </p>
          <p>
            {stopsLabel(card.stops)} · {card.duration}
            {card.outbound.flightNumbers.length > 0 &&
              ` · ${card.outbound.flightNumbers.join(", ")}`}
          </p>
        </div>

        <p className="mt-3 text-xl font-bold text-slate-100">
          {formatMoney(card.totalAmount, card.currency)}
        </p>
        <p className="text-[11px] text-slate-500">
          incl. {card.taxAmount !== undefined ? formatMoney(card.taxAmount, card.currency) : "taxes"}
          , 1 adult
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {card.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] font-medium text-amber-300"
            >
              {tag}
            </span>
          ))}
        </div>
      </button>

      <div className="border-t border-white/6 px-4 py-2.5 text-xs">
        <button
          type="button"
          onClick={() => setRulesOpen((v) => !v)}
          className="text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
        >
          Fare rules {rulesOpen ? "▾" : "▸"}
        </button>
        {rulesOpen && (
          <div className="mt-2 space-y-1 text-slate-400">
            <p>
              Changes:{" "}
              {card.changeable
                ? `allowed${card.changeFee ? `, ${card.changeFee} fee` : ""}`
                : "not allowed"}
            </p>
            <p>Refund: {card.refundable ? "allowed" : "not allowed"}</p>
            <p>
              Bags: {card.carryOnBags > 0 ? `${card.carryOnBags} carry-on` : "carry-on not listed"}
              , no checked bag listed
            </p>
            {!card.changeable && !card.refundable && (
              <p className="text-slate-500">
                Not provided. Check with the airline before booking.
              </p>
            )}
          </div>
        )}
        {selected && card.bookUrl && (
          <a
            href={card.bookUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block rounded-lg bg-amber-400/15 px-3 py-1.5 font-semibold text-amber-300 hover:bg-amber-400/25"
          >
            Book on {card.airline.replace(" Airlines", "").replace(" Air Lines", "")}
          </a>
        )}
        {card.expired && (
          <button
            type="button"
            onClick={onRefresh}
            className="mt-2 block rounded-lg border border-white/10 px-3 py-1.5 text-slate-300 hover:border-white/20"
          >
            Price may have changed. Refresh prices
          </button>
        )}
      </div>
    </div>
  );
}

export function FlightCompareView({
  block,
  selectedOfferId,
  onSelect,
  onRefresh,
}: {
  block: FlightCompareBlock;
  selectedOfferId?: string;
  onSelect: (card: FlightCard) => void;
  onRefresh: () => void;
}) {
  const isSample = block.source === "duffel_snapshot";
  return (
    <div className="mt-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {block.offers.map((card) => (
          <FlightCardView
            key={card.id}
            card={card}
            selected={selectedOfferId === card.id}
            onSelect={() => onSelect(card)}
            onRefresh={onRefresh}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
        {isSample ? (
          <p>
            Sample prices from a saved Duffel search for {block.query.depart} to{" "}
            {block.query.return}. Not live.
          </p>
        ) : (
          <p>Prices from Duffel, checked {block.checkedAt}.</p>
        )}
        <a
          href={block.compareUrl}
          className="text-amber-300 underline-offset-2 hover:underline"
        >
          Compare all {block.offersTotal.toLocaleString()} offers
        </a>
        <p>Beetlebot does not book. You book with the airline.</p>
      </div>
      {block.failed && (
        <p className="mt-2 text-xs text-slate-500">Flight prices didn&apos;t load.</p>
      )}
    </div>
  );
}
