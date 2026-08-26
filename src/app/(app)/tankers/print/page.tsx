import { auth } from "@/lib/auth";
import { PrintOnLoad } from "@/components/tankers/print-on-load";
import { TankerScheduleBookings } from "@/components/tankers/tanker-schedule-bookings";
import { WaterTypeSection } from "@/components/tankers/water-type-tabs";
import {
  filterDailyScheduleByTankerType,
  flattenDailyScheduleDeliveries,
  getDailySchedule,
  parseTankerScheduleDate,
  parseWaterTypeListFilter,
  TANKER_TYPE_LABELS,
  visibleWaterTypeSections,
  waterTypeStatsFromDeliveries,
} from "@/lib/tankers";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function TankerSchedulePrintPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const scheduleDate = parseTankerScheduleDate(sp.date);
  const typeFilter = parseWaterTypeListFilter(sp.type);
  const session = await auth();
  if (!session?.user) return null;

  const schedule = await getDailySchedule(scheduleDate);
  const typeStats = waterTypeStatsFromDeliveries(flattenDailyScheduleDeliveries(schedule));
  const sections = visibleWaterTypeSections(typeFilter);

  return (
    <div className="driver-run-sheet-page print-sheet mx-auto max-w-[1200px] p-6 text-slate-900">
      <PrintOnLoad />
      <header className="mb-6 border-b border-slate-300 pb-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Water tanker — daily schedule</p>
        <h1 className="font-display text-2xl font-semibold">
          Bookings for{" "}
          {scheduleDate.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {typeFilter === "all"
            ? `${typeStats.CLEAN_WATER.total} clean water · ${typeStats.CONSTRUCTION_WATER.total} construction water`
            : `${typeStats[typeFilter].total} ${TANKER_TYPE_LABELS[typeFilter].toLowerCase()} bookings`}
        </p>
      </header>

      <div className="space-y-8">
        {sections.map((section) => {
          const typeSchedule = filterDailyScheduleByTankerType(schedule, section.tankerType);
          return (
            <WaterTypeSection
              key={section.tankerType}
              tankerType={section.tankerType}
              count={typeStats[section.tankerType].total}
              compact
            >
              <TankerScheduleBookings
                schedule={typeSchedule}
                compact
                emptyMessage={`No ${section.label.toLowerCase()} bookings.`}
              />
            </WaterTypeSection>
          );
        })}
      </div>

      <footer className="mt-8 border-t border-slate-200 pt-3 text-xs text-slate-500">
        Printed {format(new Date(), "dd MMM yyyy HH:mm")} · Society Records
      </footer>

      <style>{`
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { background: white !important; }
          .print-sheet table { font-size: 11px; }
          .print-sheet th, .print-sheet td { padding: 4px 6px; }
          .print-water-type-section + .print-water-type-section { break-before: page; }
        }
      `}</style>
    </div>
  );
}
