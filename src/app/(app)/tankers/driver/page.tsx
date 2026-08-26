import Link from "next/link";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PageHeader, StatCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { DriverRunSheetContent } from "@/components/tankers/driver-run-sheet-table";
import { TankerNav } from "@/components/tankers/tanker-nav";
import { WaterTypeSection, WaterTypeTabs } from "@/components/tankers/water-type-tabs";
import {
  filterRunSheetByTankerType,
  getDriverRunSheet,
  listTankerDrivers,
  parseTankerScheduleDate,
  parseWaterTypeListFilter,
  tankerListHref,
  visibleWaterTypeSections,
  waterTypeSlug,
} from "@/lib/tankers";
import { format, startOfDay } from "date-fns";

export const dynamic = "force-dynamic";

export default async function DriverRunSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; driverId?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const scheduleDate = parseTankerScheduleDate(sp.date);
  const dateParam = format(scheduleDate, "yyyy-MM-dd");
  const typeFilter = parseWaterTypeListFilter(sp.type);
  const session = await auth();
  if (!session?.user) return null;

  const isLinkedDriver =
    session.user.role === "TANKER_OPERATOR" && Boolean(session.user.employeeId);
  const canPickDriver = !isLinkedDriver;
  const canEdit = hasPermission(session.user.role, "edit");

  const driverId = isLinkedDriver
    ? session.user.employeeId!
    : sp.driverId && sp.driverId !== "all"
      ? sp.driverId
      : undefined;

  const [runSheet, drivers] = await Promise.all([
    getDriverRunSheet(scheduleDate, driverId),
    canPickDriver ? listTankerDrivers() : Promise.resolve([]),
  ]);

  const selectedDriver = driverId ? drivers.find((d) => d.id === driverId) : null;
  const returnTo = tankerListHref("/tankers/driver", {
    date: dateParam,
    type: typeFilter,
    driverId: canPickDriver ? sp.driverId : undefined,
  });
  const printHref = tankerListHref("/tankers/driver/print", {
    date: dateParam,
    type: typeFilter,
    driverId,
  });
  const isToday = scheduleDate.getTime() === startOfDay(new Date()).getTime();
  const typeCounts = {
    CLEAN_WATER: runSheet.deliveries.filter((d) => d.tankerType === "CLEAN_WATER").length,
    CONSTRUCTION_WATER: runSheet.deliveries.filter((d) => d.tankerType === "CONSTRUCTION_WATER").length,
  };
  const sections = visibleWaterTypeSections(typeFilter);
  const showDriver = canPickDriver && (!driverId || sp.driverId === "all");

  return (
    <div>
      <PageHeader
        title="Driver run sheet"
        description={
          isLinkedDriver
            ? `Your deliveries${isToday ? " — today" : ""} (${scheduleDate.toLocaleDateString("en-GB")})`
            : `All driver deliveries${isToday ? " — today" : ""} (${scheduleDate.toLocaleDateString("en-GB")})`
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={printHref} target="_blank">
              <Button variant="outline">Print driver sheet</Button>
            </Link>
            {typeFilter !== "all" ? (
              <Link
                href={tankerListHref("/tankers/driver/print", { date: dateParam, driverId })}
                target="_blank"
              >
                <Button variant="outline">Print both types</Button>
              </Link>
            ) : null}
            <Link href={tankerListHref("/tankers", { date: dateParam, type: typeFilter })}>
              <Button variant="outline">Office schedule</Button>
            </Link>
          </div>
        }
      />

      <TankerNav active="driver" />

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <StatCard
          label="Clean water"
          value={typeCounts.CLEAN_WATER}
          hint="Bookings on this driver list"
        />
        <StatCard
          label="Construction water"
          value={typeCounts.CONSTRUCTION_WATER}
          hint="Bookings on this driver list"
        />
      </div>

      <form
        action="/tankers/driver"
        method="get"
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        {waterTypeSlug(typeFilter) ? (
          <input type="hidden" name="type" value={waterTypeSlug(typeFilter)} />
        ) : null}
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Delivery date</span>
          <input
            type="date"
            name="date"
            defaultValue={dateParam}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        </label>

        {canPickDriver ? (
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Driver</span>
            <select
              name="driverId"
              defaultValue={sp.driverId ?? "all"}
              className="h-10 min-w-[12rem] rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="all">All drivers</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name} ({driver.employeeCode})
                </option>
              ))}
            </select>
          </label>
        ) : (
          <div className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Driver</span>
            <p className="h-10 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
              {session.user.name} <span className="text-slate-500">(my assignments)</span>
            </p>
          </div>
        )}

        <Button type="submit">View deliveries</Button>
        {!isToday ? (
          <Link
            href={tankerListHref("/tankers/driver", {
              type: typeFilter,
              driverId: canPickDriver ? sp.driverId : undefined,
            })}
            className="text-sm text-teal-800 hover:underline"
          >
            Jump to today
          </Link>
        ) : null}
      </form>

      <WaterTypeTabs
        pathname="/tankers/driver"
        date={dateParam}
        driverId={canPickDriver ? sp.driverId : undefined}
        active={typeFilter}
        counts={typeCounts}
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <p>
          <span className="font-medium text-slate-900">{runSheet.totalCount}</span>{" "}
          {runSheet.totalCount === 1 ? "delivery" : "deliveries"}
          {selectedDriver ? ` for ${selectedDriver.name}` : isLinkedDriver ? " assigned to you" : ""}
          {typeFilter === "all" ? " · separate clean and construction lists" : ""}
        </p>
        {runSheet.totalCount > 0 ? (
          <p className="text-slate-500">Grouped by time slot, then tanker</p>
        ) : null}
      </div>

      <div className="space-y-6">
        {sections.map((section) => {
          const typeSheet = filterRunSheetByTankerType(runSheet, section.tankerType);
          return (
            <WaterTypeSection
              key={section.tankerType}
              tankerType={section.tankerType}
              count={typeSheet.totalCount}
            >
              <DriverRunSheetContent
                slots={typeSheet.slots}
                unslotted={typeSheet.unslotted}
                returnTo={returnTo}
                canEdit={canEdit}
                showDriver={showDriver}
                hideType
                emptyMessage={`No ${section.label.toLowerCase()} deliveries for this date.`}
              />
            </WaterTypeSection>
          );
        })}
      </div>
    </div>
  );
}
