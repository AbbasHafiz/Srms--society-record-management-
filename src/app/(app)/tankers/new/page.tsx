import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page";
import { FormErrorBanner } from "@/components/ui/form-error-banner";
import { Button } from "@/components/ui/button";
import { TankerDestinationFields } from "@/components/tankers/tanker-destination-fields";
import { TankerScheduleFields, TankerSlotAvailabilityList } from "@/components/tankers/tanker-schedule-fields";
import { createTankerBooking } from "../actions";
import {
  getTankerPriceMap,
  listActiveTankers,
  listTankerDrivers,
  parseTankerScheduleDate,
  parseWaterTypeListFilter,
  tankerListHref,
  TANKER_TYPE_LABELS,
} from "@/lib/tankers";
import { formatCurrency } from "@/lib/utils";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function NewTankerBookingPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; type?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user || !hasPermission(session.user.role, "create")) {
    redirect("/tankers");
  }

  const sp = await searchParams;
  const defaultDate = parseTankerScheduleDate(sp.date);
  const dateValue = format(defaultDate, "yyyy-MM-dd");
  const typeFilter = parseWaterTypeListFilter(sp.type);
  const defaultTankerType = typeFilter === "all" ? "CLEAN_WATER" : typeFilter;

  const [prices, tankers, drivers] = await Promise.all([
    getTankerPriceMap(),
    listActiveTankers(),
    listTankerDrivers(),
  ]);

  return (
    <div>
      <div className="mb-4">
        <Link href={tankerListHref("/tankers", { date: dateValue, type: typeFilter })} className="text-sm text-teal-800 hover:underline">
          ← Tanker schedule
        </Link>
      </div>

      <PageHeader
        title="New tanker booking"
        description="Book against a society plot or a walk-in house address. Price is snapshotted from the active fee configuration."
      />

      {sp.error ? <FormErrorBanner message={sp.error} /> : null}

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
              <select name="tankerType" required defaultValue={defaultTankerType} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                {Object.entries(TANKER_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label} — {formatCurrency(prices[value as keyof typeof prices])}
                  </option>
                ))}
              </select>
            </label>

            <TankerDestinationFields />

            <TankerScheduleFields initialDate={dateValue} />

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
            <Link href={tankerListHref("/tankers", { date: dateValue, type: typeFilter })}>
              <Button type="button" variant="outline">
                Cancel
              </Button>
            </Link>
          </div>
          <p className="text-xs text-slate-500">
            Slot capacity is enforced when saving. Changing the delivery date updates available slots automatically.
          </p>
        </form>

        <TankerSlotAvailabilityList initialDate={dateValue} />
      </div>
    </div>
  );
}
