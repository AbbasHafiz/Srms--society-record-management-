import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PrintOnLoad } from "@/components/tankers/print-on-load";
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

  const [runSheet, driver] = await Promise.all([
    getDriverRunSheet(scheduleDate, driverId),
    driverId
      ? prisma.employee.findUnique({
          where: { id: driverId },
          select: { name: true, employeeCode: true },
        })
      : Promise.resolve(null),
  ]);

  const sections = visibleWaterTypeSections(typeFilter);
  const typeCounts = {
    CLEAN_WATER: runSheet.deliveries.filter((d) => d.tankerType === "CLEAN_WATER").length,
    CONSTRUCTION_WATER: runSheet.deliveries.filter((d) => d.tankerType === "CONSTRUCTION_WATER").length,
  };

  return (
    <div className="driver-run-sheet-page print-sheet mx-auto max-w-[1200px] p-6 text-slate-900">
      <PrintOnLoad />
      <header className="mb-6 border-b border-slate-300 pb-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Water tanker — driver sheet</p>
        <h1 className="font-display text-2xl font-semibold">
          Deliveries for{" "}
          {scheduleDate.toLocaleDateString("en-GB", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {driver ? `Driver: ${driver.name} (${driver.employeeCode})` : "All drivers"}
          {" · "}
          {typeFilter === "all"
            ? `${typeCounts.CLEAN_WATER} clean · ${typeCounts.CONSTRUCTION_WATER} construction`
            : `${typeCounts[typeFilter]} ${TANKER_TYPE_LABELS[typeFilter].toLowerCase()}`}
        </p>
      </header>

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

      <footer className="mt-8 border-t border-slate-200 pt-3 text-xs text-slate-500 print:fixed print:bottom-4 print:left-6 print:right-6">
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
