import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { createTankerBooking } from "../actions";
import {
  formatTimeSlotLabel,
  getSlotAvailabilityForDate,
  getTankerPriceMap,
  listActiveTankers,
  listTankerDrivers,
  TANKER_TYPE_LABELS,
} from "@/lib/tankers";
import { formatCurrency } from "@/lib/utils";
import { format, parseISO, startOfDay } from "date-fns";

export const dynamic = "force-dynamic";

export default async function NewTankerBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.role, "create")) {
    redirect("/tankers");
  }

  const sp = await searchParams;
  const defaultDate = sp.date
    ? (() => {
        const parsed = parseISO(sp.date);
        return Number.isNaN(parsed.getTime()) ? startOfDay(new Date()) : startOfDay(parsed);
      })()
    : startOfDay(new Date());
  const dateValue = format(defaultDate, "yyyy-MM-dd");

  const [prices, tankers, drivers, slotAvailability] = await Promise.all([
    getTankerPriceMap(),
    listActiveTankers(),
    listTankerDrivers(),
    getSlotAvailabilityForDate(defaultDate),
  ]);

  return (
    <div>
      <div className="mb-4">
        <Link href="/tankers" className="text-sm text-teal-800 hover:underline">
          ← Tanker schedule
        </Link>
      </div>

      <PageHeader
        title="New tanker booking"
        description="Book a water tanker delivery with date and time slot. Price is taken from the active fee configuration."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <form action={createTankerBooking} className="space-y-5 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Booker name *</span>
              <input
                name="bookerName"
                required
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                placeholder="Resident / customer name"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Contact</span>
              <input
                name="bookerContact"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                placeholder="03xx-xxxxxxx"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Tanker type *</span>
              <select name="tankerType" required defaultValue="CLEAN_WATER" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                {Object.entries(TANKER_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label} — {formatCurrency(prices[value as keyof typeof prices])}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">House no.</span>
              <input name="houseNo" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Street no.</span>
              <input name="streetNo" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm" />
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Street / area</span>
              <input
                name="streetArea"
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                placeholder="e.g. E-17 Street 12"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Delivery date *</span>
              <input
                name="distributionDate"
                type="date"
                required
                defaultValue={dateValue}
                className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Delivery time slot *</span>
              <select name="timeSlotId" required className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">Select slot…</option>
                {slotAvailability.map((slot) => (
                  <option key={slot.id} value={slot.id} disabled={slot.isFull}>
                    {formatTimeSlotLabel(slot)}
                    {slot.isFull ? " (full)" : ` — ${slot.remaining} left`}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Assign tanker (optional)</span>
              <select name="tankerId" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">Assign later</option>
                {tankers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.tankerCode} ({t.capacityLiters}L)
                    {t.driver ? ` — ${t.driver.name}` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Assign driver (optional)</span>
              <select name="driverId" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">Assign later</option>
                {drivers.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.employeeCode})
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Remarks</span>
              <textarea
                name="remarks"
                rows={2}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="submit">Create booking</Button>
            <Link href={`/tankers?date=${dateValue}`}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>
          <p className="text-xs text-slate-500">
            Change the delivery date above and refresh this page to see updated slot availability for that day.
          </p>
        </form>

        <aside className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm">
          <h2 className="font-display mb-3 font-semibold text-slate-900">Slot availability</h2>
          <p className="mb-3 text-slate-600">
            For {defaultDate.toLocaleDateString("en-GB")}:
          </p>
          <ul className="space-y-2">
            {slotAvailability.map((slot) => (
              <li key={slot.id} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div className="font-medium">{formatTimeSlotLabel(slot)}</div>
                <div className={slot.isFull ? "text-rose-700" : "text-emerald-700"}>
                  {slot.isFull ? "Full" : `${slot.remaining} of ${slot.maxBookingsPerDay} available`}
                </div>
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </div>
  );
}
