import Link from "next/link";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PageHeader, StatCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import {
  filterDailyScheduleByTankerType,
  flattenDailyScheduleDeliveries,
  getDailySchedule,
  getTotalBulkStockRemaining,
  parseTankerScheduleDate,
  parseWaterTypeListFilter,
  tankerListHref,
  visibleWaterTypeSections,
  waterTypeSlug,
  waterTypeStatsFromDeliveries,
} from "@/lib/tankers";
import { TankerNav } from "@/components/tankers/tanker-nav";
import { TankerScheduleBookings } from "@/components/tankers/tanker-schedule-bookings";
import { WaterTypeSection, WaterTypeTabs } from "@/components/tankers/water-type-tabs";
import { format, startOfDay } from "date-fns";

export const dynamic = "force-dynamic";

export default async function TankersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const scheduleDate = parseTankerScheduleDate(sp.date);
  const dateParam = format(scheduleDate, "yyyy-MM-dd");
  const typeFilter = parseWaterTypeListFilter(sp.type);
  const session = await auth();
  const canCreate = session?.user && hasPermission(session.user.role, "create");

  const [schedule, bulkStockRemaining] = await Promise.all([
    getDailySchedule(scheduleDate),
    getTotalBulkStockRemaining(),
  ]);

  const allDeliveries = flattenDailyScheduleDeliveries(schedule);
  const typeStats = waterTypeStatsFromDeliveries(allDeliveries);
  const typeCounts = {
    CLEAN_WATER: typeStats.CLEAN_WATER.total,
    CONSTRUCTION_WATER: typeStats.CONSTRUCTION_WATER.total,
  };
  const sections = visibleWaterTypeSections(typeFilter);
  const collectionTotal =
    typeStats.CLEAN_WATER.collection + typeStats.CONSTRUCTION_WATER.collection;

  const isToday = scheduleDate.getTime() === startOfDay(new Date()).getTime();
  const printHref = tankerListHref("/tankers/print", { date: dateParam, type: typeFilter });

  return (
    <div>
      <PageHeader
        title="Water Tankers"
        description={`Daily delivery schedule${isToday ? " — today" : ""} (${scheduleDate.toLocaleDateString("en-GB")})`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={printHref} target="_blank">
              <Button variant="outline">Print lists</Button>
            </Link>
            <Link href={tankerListHref("/tankers/driver", { date: dateParam, type: typeFilter })}>
              <Button variant="outline">Driver sheet</Button>
            </Link>
            {canCreate ? (
              <Link href={tankerListHref("/tankers/new", { date: dateParam, type: typeFilter })}>
                <Button>New booking</Button>
              </Link>
            ) : null}
            {session?.user && hasPermission(session.user.role, "edit") ? (
              <>
                <Link href="/tankers/fleet">
                  <Button variant="outline">Fleet</Button>
                </Link>
                <Link href="/tankers/slots">
                  <Button variant="outline">Time slots</Button>
                </Link>
              </>
            ) : null}
          </div>
        }
      />

      <TankerNav active="schedule" />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Bulk water in stock"
          value={`${bulkStockRemaining.toLocaleString()} L`}
          tone={bulkStockRemaining > 0 ? "success" : "warn"}
          hint="Manage bulk stock on Bulk stock tab"
        />
        <StatCard
          label="Clean water"
          value={typeStats.CLEAN_WATER.total}
          hint={`${typeStats.CLEAN_WATER.scheduled} to deliver · ${typeStats.CLEAN_WATER.completed} completed`}
        />
        <StatCard
          label="Construction water"
          value={typeStats.CONSTRUCTION_WATER.total}
          hint={`${typeStats.CONSTRUCTION_WATER.scheduled} to deliver · ${typeStats.CONSTRUCTION_WATER.completed} completed`}
        />
        <StatCard
          label="Collection"
          value={formatCurrency(collectionTotal)}
          tone="success"
          hint={`Clean ${formatCurrency(typeStats.CLEAN_WATER.collection)} · Construction ${formatCurrency(typeStats.CONSTRUCTION_WATER.collection)}`}
        />
      </div>

      <form
        action="/tankers"
        method="get"
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
        {waterTypeSlug(typeFilter) ? (
          <input type="hidden" name="type" value={waterTypeSlug(typeFilter)} />
        ) : null}
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Schedule date</span>
          <input
            type="date"
            name="date"
            defaultValue={dateParam}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        </label>
        <Button type="submit">View schedule</Button>
        {!isToday ? (
          <Link
            href={tankerListHref("/tankers", { type: typeFilter })}
            className="text-sm text-teal-800 hover:underline"
          >
            Jump to today
          </Link>
        ) : null}
      </form>

      <WaterTypeTabs
        pathname="/tankers"
        date={dateParam}
        active={typeFilter}
        counts={typeCounts}
      />
      <p className="mb-4 text-sm text-slate-500">
        {typeFilter === "all"
          ? "Showing both water types as separate lists. Click a tab to filter."
          : `Showing ${typeFilter === "CLEAN_WATER" ? "clean water" : "construction water"} only. Click the tab again to show both.`}
      </p>

      <div className="space-y-6">
        {sections.map((section) => {
          const typeSchedule = filterDailyScheduleByTankerType(schedule, section.tankerType);
          return (
            <WaterTypeSection
              key={section.tankerType}
              tankerType={section.tankerType}
              count={typeCounts[section.tankerType]}
              actions={
                canCreate ? (
                  <Link
                    href={tankerListHref("/tankers/new", {
                      date: dateParam,
                      type: section.tankerType,
                    })}
                    className="text-sm font-medium underline-offset-2 hover:underline"
                  >
                    New {section.label.toLowerCase()} booking
                  </Link>
                ) : null
              }
            >
              <TankerScheduleBookings
                schedule={typeSchedule}
                emptyMessage={`No ${section.label.toLowerCase()} bookings for this date.`}
              />
            </WaterTypeSection>
          );
        })}
      </div>
    </div>
  );
}
