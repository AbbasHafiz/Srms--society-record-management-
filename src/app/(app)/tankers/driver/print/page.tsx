import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PrintOnLoad } from "@/components/tankers/print-on-load";
import { PrintActions } from "@/components/print/print-actions";
import { PrintLetterhead, PrintDisclaimer } from "@/components/print/print-document";
import { DriverRunSheetContent } from "@/components/tankers/driver-run-sheet-table";
import { WaterTypeSection } from "@/components/tankers/water-type-tabs";
import {
  filterRunSheetByTankerType,
  getDriverRunSheet,
  parseTankerScheduleDate,
  parseWaterTypeListFilter,
  TANKER_TYPE_LABELS,
  visibleWaterTypeSections,
} from "@/lib/tankers";
import { getSocietyLetterhead } from "@/lib/print";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

export default async function DriverRunSheetPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; driverId?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const scheduleDate = parseTankerScheduleDate(sp.date);
  const typeFilter = parseWaterTypeListFilter(sp.type);
  const session = await auth();
  if (!session?.user) return null;

  const isLinkedDriver =
    session.user.role === "TANKER_OPERATOR" && Boolean(session.user.employeeId);

  let driverId = sp.driverId && sp.driverId !== "all" ? sp.driverId : undefined;
  if (isLinkedDriver) {
    driverId = session.user.employeeId!;
  }

  const [runSheet, driver, letterhead] = await Promise.all([
    getDriverRunSheet(scheduleDate, driverId),
    driverId
      ? prisma.employee.findUnique({
          where: { id: driverId },
          select: { name: true, employeeCode: true },
        })
      : Promise.resolve(null),
    getSocietyLetterhead(),
  ]);

  const sections = visibleWaterTypeSections(typeFilter);
  const typeCounts = {
    CLEAN_WATER: runSheet.deliveries.filter((d) => d.tankerType === "CLEAN_WATER").length,
    CONSTRUCTION_WATER: runSheet.deliveries.filter((d) => d.tankerType === "CONSTRUCTION_WATER").length,
  };

  return (
    <div className="driver-run-sheet-page print-sheet mx-auto max-w-[1200px] p-6 text-slate-900">
      <PrintOnLoad />
      <PrintActions
        backHref={`/tankers/driver?date=${format(scheduleDate, "yyyy-MM-dd")}${driverId ? `&driverId=${driverId}` : ""}`}
        backLabel="Back to driver sheet"
      />
      <PrintLetterhead
        letterhead={letterhead}
        title={`Driver run sheet — ${scheduleDate.toLocaleDateString("en-GB", {
          weekday: "long",
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`}
        subtitle={driver ? `${driver.name} (${driver.employeeCode})` : "All drivers"}
      />
      <p className="mt-2 text-sm text-slate-600">
        {typeFilter === "all"
          ? `${typeCounts.CLEAN_WATER} clean · ${typeCounts.CONSTRUCTION_WATER} construction`
          : `${typeCounts[typeFilter]} ${TANKER_TYPE_LABELS[typeFilter].toLowerCase()}`}
      </p>

      <div className="space-y-8">
        {sections.map((section) => {
          const typeSheet = filterRunSheetByTankerType(runSheet, section.tankerType);
          return (
            <WaterTypeSection
              key={section.tankerType}
              tankerType={section.tankerType}
              count={typeSheet.totalCount}
              compact
            >
              <DriverRunSheetContent
                slots={typeSheet.slots}
                unslotted={typeSheet.unslotted}
                returnTo=""
                canEdit={false}
                showDriver={!driverId}
                compact
                hideType
                emptyMessage={`No ${section.label.toLowerCase()} deliveries.`}
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
