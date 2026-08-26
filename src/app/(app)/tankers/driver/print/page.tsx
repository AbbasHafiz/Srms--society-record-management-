import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PrintOnLoad } from "@/components/tankers/print-on-load";
import { DriverRunSheetContent } from "@/components/tankers/driver-run-sheet-table";
import { getDriverRunSheet } from "@/lib/tankers";
import { format, parseISO, startOfDay } from "date-fns";

export const dynamic = "force-dynamic";

function parseScheduleDate(value?: string) {
  if (!value) return startOfDay(new Date());
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? startOfDay(new Date()) : startOfDay(parsed);
}

export default async function DriverRunSheetPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; driverId?: string }>;
}) {
  const sp = await searchParams;
  const scheduleDate = parseScheduleDate(sp.date);
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

  return (
    <div className="print-sheet mx-auto max-w-[1200px] p-6 text-slate-900">
      <PrintOnLoad />
      <header className="mb-6 border-b border-slate-300 pb-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">Water tanker — driver sheet</p>
        <h1 className="font-display text-2xl font-semibold">
          Deliveries for {scheduleDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {driver ? `Driver: ${driver.name} (${driver.employeeCode})` : "All drivers"}
          {" · "}
          {runSheet.totalCount} {runSheet.totalCount === 1 ? "booking" : "bookings"}
        </p>
      </header>

      <DriverRunSheetContent
        slots={runSheet.slots}
        unslotted={runSheet.unslotted}
        returnTo=""
        canEdit={false}
        showDriver={!driverId}
        compact
      />

      <footer className="mt-8 border-t border-slate-200 pt-3 text-xs text-slate-500 print:fixed print:bottom-4 print:left-6 print:right-6">
        Printed {format(new Date(), "dd MMM yyyy HH:mm")} · Society Records
      </footer>

      <style>{`
        @media print {
          @page { margin: 12mm; }
          body { background: white !important; }
          .print-sheet table { font-size: 11px; }
          .print-sheet th, .print-sheet td { padding: 4px 6px; }
        }
      `}</style>
    </div>
  );
}
