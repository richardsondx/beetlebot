import { formatFlightRange, getComparePayload } from "@/lib/travel/compare";

export default function TravelComparePage() {
  const payload = getComparePayload();
  const flights = payload.flights;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl space-y-6 px-6 py-6">
        <header className="space-y-3">
          <h1 className="text-2xl font-semibold">Toronto to New York compare</h1>
          <p className="text-sm text-slate-400">
            Toronto YYZ to New York NYC, Fri Dec 11 to Mon Dec 14 2026, 1 adult, economy.
          </p>
          <p className="text-sm text-slate-400">
            Flights searched live on {flights.source} at {flights.searchedAt}.{" "}
            {flights.offersTotal} offers found, {flights.offersShown} shown in the full
            result. Coverage complete: {flights.coverageComplete ? "yes" : "no"}.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Flights</h2>
          <p className="text-sm text-slate-400">
            Each total is the full round trip total for 1 adult, taxes included.
          </p>
          <table className="w-full rounded-2xl border border-white/10 bg-[#0d1422] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-slate-400">
                <th className="px-4 py-3">Airline</th>
                <th className="px-4 py-3">Out</th>
                <th className="px-4 py-3">Back</th>
                <th className="px-4 py-3">Stops</th>
                <th className="px-4 py-3">Trip time</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody>
              {flights.options.map((option) => (
                <tr key={option.pointer} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3">
                    <div className="font-medium">{option.airline}</div>
                    <div className="text-xs text-slate-500">
                      {option.fareBrand} - {option.label}
                    </div>
                    <div className="text-xs text-slate-500">
                      Source: {flights.source} - {flights.searchedAt}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {option.slices[0].from} to {option.slices[0].to}
                    <div className="text-xs text-slate-500">
                      {formatFlightRange(
                        option.slices[0].departAt,
                        option.slices[0].arriveAt,
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {option.slices[0].flightNumbers.join(", ")}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {option.slices[1].from} to {option.slices[1].to}
                    <div className="text-xs text-slate-500">
                      {formatFlightRange(
                        option.slices[1].departAt,
                        option.slices[1].arriveAt,
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {option.slices[1].flightNumbers.join(", ")}
                    </div>
                  </td>
                  <td className="px-4 py-3">{option.stops === 0 ? "Nonstop" : `${option.stops} stop`}</td>
                  <td className="px-4 py-3">{option.duration}</td>
                  <td className="px-4 py-3 font-semibold">
                    {option.totalAmount.toFixed(2)} {option.currency}
                    <div className="text-xs font-normal text-slate-500">
                      {option.changeable ? "Changes allowed" : "No changes"} -{" "}
                      {option.refundable ? "Refundable" : "No refunds"} - carry-on:{" "}
                      {option.carryOnBags}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-500">
            Evidence: {flights.evidenceFile}. Prices can change. Check the live fare
            before booking.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Hotels in New York</h2>
          <p className="text-sm text-slate-400">{payload.hotelCompareNote}</p>
          <p className="text-sm text-slate-400">
            Failed live rate sources:{" "}
            {payload.hotelRateSourcesFailed
              .map((item) => `${item.source} (${item.error})`)
              .join(", ")}
            .
          </p>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {payload.hotels.map((hotel) => (
              <article
                key={hotel.placeId}
                className="rounded-2xl border border-white/10 bg-[#0d1422] p-5"
              >
                <h3 className="text-base font-semibold">{hotel.name}</h3>
                <p className="mt-1 text-sm text-slate-400">{hotel.address}</p>
                <p className="mt-1 text-sm text-slate-400">
                  {hotel.rating} stars from {hotel.reviewCount} reviews
                </p>
                <p className="mt-2 text-sm font-medium text-amber-200">
                  Price: check live rates
                </p>
                <p className="mt-1 text-xs text-slate-500">{hotel.priceNote}</p>
                <a
                  href={hotel.checkLiveRatesUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-block rounded-lg border border-amber-300/25 bg-amber-300/10 px-4 py-2 text-sm text-amber-200"
                >
                  Check live rates on the hotel site
                </a>
              </article>
            ))}
          </div>
          <p className="text-sm text-slate-400">
            More rate checks:{" "}
            <a
              href={payload.hotelRateCheckLinks.googleHotels}
              target="_blank"
              rel="noreferrer"
              className="text-sky-300 underline"
            >
              Google Hotels
            </a>{" "}
            and{" "}
            <a
              href={payload.hotelRateCheckLinks.bookingCom}
              target="_blank"
              rel="noreferrer"
              className="text-sky-300 underline"
            >
              Booking.com
            </a>
            .
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-semibold">Plan Object</h2>
          <p className="text-sm text-slate-400">
            Built from the cheapest flight option. No booking is made here.
            Booking stops at the handoff links above.
          </p>
          <pre className="overflow-x-auto rounded-2xl border border-white/10 bg-[#0d1422] p-4 text-xs text-slate-300">
            {JSON.stringify(payload.planObject, null, 2)}
          </pre>
        </section>
      </div>
    </div>
  );
}
