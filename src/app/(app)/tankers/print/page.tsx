import { auth } from "@/lib/auth";
import { PrintOnLoad } from "@/components/tankers/print-on-load";
import { PrintActions } from "@/components/print/print-actions";
import { PrintLetterhead, PrintDisclaimer } from "@/components/print/print-document";
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
import { getSocietyLetterhead } from "@/lib/print";
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

  const [schedule, letterhead] = await Promise.all([
    getDailySchedule(scheduleDate),
    getSocietyLetterhead(),
  ]);
  const typeStats = waterTypeStatsFromDeliveries(flattenDailyScheduleDeliveries(schedule));
  const sections = visibleWaterTypeSections(typeFilter);

  return (
    <div className="driver-run-sheet-page print-sheet mx-auto max-w-[1200px] p-6 text-slate-900">
      <PrintOnLoad />
      <PrintActions
        backHref={`/tankers?date=${format(scheduleDate, "yyyy-MM-dd")}`}
        backLabel="Back to schedule"
      />
      <PrintLetterhead
        letterhead={letterhead}
        title={`Tanker bookings — ${scheduleDate.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`}
        subtitle="Daily water tanker schedule"
      />
      <p className="mt-2 text-sm text-slate-600">
        {typeFilter === "all"
          ? `${typeStats.CLEAN_WATER.total} clean water · ${typeStats.CONSTRUCTION_WATER.total} construction water`
          : `${typeStats[typeFilter].total} ${TANKER_TYPE_LABELS[typeFilter].toLowerCase()} bookings`}
      </p>

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

      <PrintDisclaimer extra={`Printed ${format(new Date(), "dd MMM yyyy HH:mm")}`} />

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
