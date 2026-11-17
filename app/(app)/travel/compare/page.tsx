import Link from "next/link";
import { formatFlightRange, getComparePayload } from "@/lib/travel/compare";

export default async function TravelComparePage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const payload = getComparePayload();
  const flights = payload.flights;
  const params = (await searchParams) ?? {};
  const first = (v: string | string[] | undefined) =>
    Array.isArray(v) ? v[0] : v;
  const reqFrom = first(params.from);
  const reqTo = first(params.to);
  const reqDepart = first(params.depart);
  const reqReturn = first(params.return);
  const reqAdults = first(params.adults);
  const matchesSnapshot =
    (!reqFrom || reqFrom === flights.origin) &&
    (!reqTo || reqTo === flights.destination) &&
    (!reqDepart || reqDepart === flights.departureDate) &&
    (!reqReturn || reqReturn === flights.returnDate);

  const cheapestFlight = flights.options[0];
  const cheapestHotel = payload.hotels[0];
  const hasOptions = flights.options.length > 0 || payload.hotels.length > 0;

  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto max-w-[1040px] space-y-6 px-4 py-8 md:px-8">
        <Link href="/chat" className="text-sm font-medium text-[#8A5710] hover:underline">
          ← Back to chat
        </Link>
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold leading-8 text-[#1C1B19]">Compare options</h1>
          <p className="text-sm text-[#6B6862]">
            Toronto YYZ to New York NYC, Fri Dec 11 to Mon Dec 14 2026, 1 adult, economy.
          </p>
          {reqFrom || reqTo || reqDepart || reqReturn ? (
            <p className="text-sm text-[#6B6862]">
              Requested: {reqFrom ?? flights.origin} to {reqTo ?? flights.destination},{" "}
              {reqDepart ?? flights.departureDate} to {reqReturn ?? flights.returnDate},{" "}
              {reqAdults ?? flights.adults} adult{reqAdults === "1" ? "" : "s"}.
              {!matchesSnapshot &&
                " Showing the saved Dec 11 to 14 search below; it is the only saved search."}
            </p>
          ) : null}
          <p className="text-sm text-[#6B6862]">
            Flights searched live on {flights.source} at {flights.searchedAt}.{" "}
            {flights.offersTotal} offers found, {flights.offersShown} shown in the full
            result. Coverage complete: {flights.coverageComplete ? "yes" : "no"}.
          </p>
        </header>

        {!hasOptions ? (
          <div className="rounded-2xl border border-[#E7E5E0] bg-white px-6 py-16 text-center">
            <p className="text-sm font-medium text-[#1C1B19]">Nothing to compare yet</p>
            <p className="mt-1 text-[13px] text-[#6B6862]">Ask in chat to compare flights or hotels.</p>
          </div>
        ) : (
          <>
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[#1C1B19]">Flights</h2>
              <p className="text-sm text-[#6B6862]">
                Each total is the full round trip total for 1 adult, taxes included.
              </p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {flights.options.map((option, i) => (
                  <article
                    key={option.pointer}
                    className={`rounded-2xl border bg-white p-4 ${
                      i === 0 ? "border-[#C8811A]" : "border-[#E7E5E0]"
                    }`}
                  >
                    {i === 0 && (
                      <span className="mb-2 inline-block rounded-full bg-[#FBF1E1] px-2.5 py-0.5 text-xs font-medium text-[#8A5710]">
                        Best fit
                      </span>
                    )}
                    <h3 className="text-base font-semibold text-[#1C1B19]">{option.airline}</h3>
                    <p className="mt-0.5 text-xs text-[#6B6862]">
                      {option.fareBrand} - {option.label}
                    </p>
                    <p className="mt-2 text-sm text-[#1C1B19]">
                      {option.slices[0].from} to {option.slices[0].to} ·{" "}
                      {formatFlightRange(option.slices[0].departAt, option.slices[0].arriveAt)}
                    </p>
                    <p className="mt-1 text-sm text-[#1C1B19]">
                      {option.slices[1].from} to {option.slices[1].to} ·{" "}
                      {formatFlightRange(option.slices[1].departAt, option.slices[1].arriveAt)}
                    </p>
                    <p className="mt-2 text-sm font-semibold text-[#1C1B19]">
                      {option.totalAmount.toFixed(2)} {option.currency}
                    </p>
                    <p className="mt-1 text-xs text-[#6B6862]">
                      {option.stops === 0 ? "Nonstop" : `${option.stops} stop`} · {option.duration} ·{" "}
                      {option.changeable ? "Changes allowed" : "No changes"} ·{" "}
                      {option.refundable ? "Refundable" : "No refunds"} · carry-on: {option.carryOnBags}
                    </p>
                  </article>
                ))}
              </div>
              <p className="text-xs text-[#6B6862]">
                Evidence: {flights.evidenceFile}. Prices can change. Check the live fare
                before booking.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[#1C1B19]">Hotels in New York</h2>
              <p className="text-sm text-[#6B6862]">{payload.hotelCompareNote}</p>
              <p className="text-sm text-[#6B6862]">
                Failed live rate sources:{" "}
                {payload.hotelRateSourcesFailed
                  .map((item) => `${item.source} (${item.error})`)
                  .join(", ")}
                .
              </p>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {payload.hotels.map((hotel, i) => (
                  <article
                    key={hotel.name}
                    className={`rounded-2xl border bg-white p-4 ${
                      i === 0 ? "border-[#C8811A]" : "border-[#E7E5E0]"
                    }`}
                  >
                    {i === 0 && (
                      <span className="mb-2 inline-block rounded-full bg-[#FBF1E1] px-2.5 py-0.5 text-xs font-medium text-[#8A5710]">
                        Best fit
                      </span>
                    )}
                    <h3 className="text-base font-semibold text-[#1C1B19]">{hotel.name}</h3>
                    <p className="mt-1 text-sm text-[#6B6862]">
                      {hotel.stars} star · {hotel.area}
                    </p>
                    <p className="mt-2 text-sm font-medium text-[#8A5710]">
                      {hotel.price
                        ? `$${hotel.price.total.toLocaleString()} total for 3 nights, ${hotel.price.nightlyDerived ? "about " : ""}$${hotel.price.nightly} a night (${hotel.price.currency})`
                        : "Price: check live rates"}
                    </p>
                    <p className="mt-1 text-xs text-[#6B6862]">{hotel.priceNote}</p>
                    {hotel.feeNote ? (
                      <p className="mt-1 text-xs text-[#6B6862]">{hotel.feeNote}</p>
                    ) : null}
                    <a
                      href={hotel.checkLiveRatesUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-block rounded-[10px] border border-[#D6D3CC] bg-[#FBF1E1] px-4 py-2 text-sm text-[#8A5710]"
                    >
                      View on {hotel.source}
                    </a>
                  </article>
                ))}
              </div>
              <p className="text-sm text-[#6B6862]">
                More rate checks:{" "}
                <a
                  href={payload.hotelRateCheckLinks.googleHotels}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#2F5FA8] underline"
                >
                  Google Hotels
                </a>{" "}
                and{" "}
                <a
                  href={payload.hotelRateCheckLinks.bookingCom}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#2F5FA8] underline"
                >
                  Booking.com
                </a>
                .
              </p>
            </section>

            <p className="text-[15px] leading-[22px] text-[#6B6862]">
              <span className="font-semibold text-[#1C1B19]">Tradeoff:</span>{" "}
              {cheapestFlight
                ? `the cheapest flight is ${cheapestFlight.airline} at ${cheapestFlight.totalAmount.toFixed(2)} ${cheapestFlight.currency}`
                : "no flight options"}
              {cheapestHotel ? `, and the cheapest hotel is ${cheapestHotel.name}` : ""}. Cheaper
              options may mean less convenient times or a simpler stay.
            </p>
            <p className="text-xs leading-4 text-[#9A968F]">
              Typical range, not a live price. Check the provider before booking.
            </p>

            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-[#1C1B19]">Plan Object</h2>
              <p className="text-sm text-[#6B6862]">
                Built from the cheapest flight option. No booking is made here.
                Booking stops at the handoff links above.
              </p>
              <pre className="overflow-x-auto rounded-2xl border border-[#E7E5E0] bg-[#F2F1EE] p-4 font-mono text-xs text-[#1C1B19]">
                {JSON.stringify(payload.planObject, null, 2)}
              </pre>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
