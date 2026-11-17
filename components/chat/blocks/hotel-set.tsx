"use client";

import type { HotelCard, HotelSetBlock } from "@/lib/chat/rich-message";
import { formatMoney } from "@/lib/chat/rich-message";

function HotelCardView({
  hotel,
  stayAdults,
  selected,
  checking,
  onSelect,
  onCheckPrice,
}: {
  hotel: HotelCard;
  stayAdults: number;
  selected: boolean;
  checking: boolean;
  onSelect: () => void;
  onCheckPrice: () => void;
}) {
  const price = hotel.price;
  const mismatch = price !== null && price.adults !== stayAdults;
  return (
    <div
      className={`overflow-hidden rounded-2xl border bg-white transition-all ${
        selected
          ? "border-amber-300 shadow-lg shadow-[#1C1B19]/5"
          : "border-[#E7E5E0] hover:border-[#E7E5E0]"
      }`}
    >
      {hotel.photoUrl ? (
        <div className="relative aspect-[5/3] w-full overflow-hidden bg-[#F2F1EE]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={hotel.photoUrl}
            alt={`${hotel.name} photo`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          {hotel.photoSourceName && (
            <span className="absolute bottom-1.5 right-2 text-[10px] text-white drop-shadow">
              Photo: {hotel.photoSourceName}
            </span>
          )}
        </div>
      ) : (
        <div className="flex aspect-[5/3] w-full flex-col items-center justify-center gap-2 bg-[#F2F1EE]">
          <span className="text-3xl" aria-hidden="true">
            🏨
          </span>
          <span className="max-w-[80%] text-center text-xs text-[#6B6862]">
            {hotel.photoFallback ?? "No hotel photo found"}
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="block w-full p-4 text-left"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-[#1C1B19]">{hotel.name}</p>
            <p className="mt-0.5 text-xs text-[#6B6862]">{hotel.area}</p>
          </div>
          {selected && (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#C8811A] text-xs font-bold text-white">
              ✓
            </span>
          )}
        </div>

        <p className="mt-2 text-xs text-[#6B6862]">
          {hotel.stars ? `${hotel.stars} star` : "Stars not listed"}
        </p>

        {price ? (
          <>
            <p className="mt-3 text-xl font-bold text-[#1C1B19]">
              {price.nightly !== null
                ? `${price.derived ? "about " : ""}${formatMoney(price.nightly, price.currency)} a night`
                : `${formatMoney(price.total ?? 0, price.currency)} total`}
            </p>
            {hotel.source === "Sample" && (
              <p className="mt-1 text-[11px] font-semibold text-[#8A5710]">
                Sample price, not live
              </p>
            )}
            <p className="text-[11px] text-[#6B6862]">
              {price.nightly !== null && price.total !== null
                ? price.derived
                  ? `from ${formatMoney(price.total, price.currency)} total, ${price.nights} nights`
                  : `${formatMoney(price.total, price.currency)} total, ${price.nights} nights`
                : `${price.nights} nights`}
            </p>
          </>
        ) : (
          <p className="mt-3 text-sm font-semibold text-[#6B6862]">No live price yet</p>
        )}

        <p className="mt-2 text-xs text-[#6B6862]">
          Price for {price?.adults ?? stayAdults} adults
        </p>
        {mismatch && (
          <p className="text-xs text-[#6B6862]">
            Searched for {price?.adults} adults. Your price may differ.
          </p>
        )}
        {hotel.feeNote && <p className="mt-1 text-[11px] text-[#9A968F]">{hotel.feeNote}</p>}
      </button>

      <div className="flex flex-wrap items-center gap-2 border-t border-[#E7E5E0] px-4 py-2.5 text-xs">
        {price ? (
          <a
            href={hotel.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#8A5710] underline-offset-2 hover:underline"
          >
            View on {hotel.source}
          </a>
        ) : (
          <button
            type="button"
            onClick={onCheckPrice}
            disabled={checking}
            className="rounded-lg border border-[#E7E5E0] px-3 py-1.5 text-[#6B6862] hover:border-[#E7E5E0] disabled:opacity-40"
          >
            {checking ? "Checking…" : "Check price"}
          </button>
        )}
        <span className="text-[#9A968F]">
          {hotel.checkedAt
            ? `Checked ${new Date(hotel.checkedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
            : "Not checked yet"}
        </span>
      </div>
    </div>
  );
}

export function HotelSetView({
  block,
  selectedHotelId,
  checkingHotelId,
  onSelect,
  onCheckPrice,
}: {
  block: HotelSetBlock;
  selectedHotelId?: string;
  checkingHotelId?: string;
  onSelect: (hotel: HotelCard) => void;
  onCheckPrice: (hotel: HotelCard) => void;
}) {
  return (
    <div className="mt-3">
      <div className="grid gap-3 sm:grid-cols-3">
        {block.hotels.map((hotel) => (
          <HotelCardView
            key={hotel.id}
            hotel={hotel}
            stayAdults={block.stay.adults}
            selected={selectedHotelId === hotel.id}
            checking={checkingHotelId === hotel.id}
            onSelect={() => onSelect(hotel)}
            onCheckPrice={() => onCheckPrice(hotel)}
          />
        ))}
      </div>
      <p className="mt-3 text-xs text-[#6B6862]">
        Prices from {block.hotels[0]?.source ?? "Hello Axel"}. Prices move daily, confirm
        on the seller before booking. Beetlebot does not book.
      </p>
    </div>
  );
}
