import Link from "next/link";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { DriverRunSheetContent } from "@/components/tankers/driver-run-sheet-table";
import { TankerNav } from "@/components/tankers/tanker-nav";
import { getDriverRunSheet, listTankerDrivers } from "@/lib/tankers";
import { format, parseISO, startOfDay } from "date-fns";

export const dynamic = "force-dynamic";

function parseScheduleDate(value?: string) {
  if (!value) return startOfDay(new Date());
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? startOfDay(new Date()) : startOfDay(parsed);
}

function buildReturnTo(dateParam: string, driverId?: string) {
  const params = new URLSearchParams({ date: dateParam });
  if (driverId) params.set("driverId", driverId);
  return `/tankers/driver?${params.toString()}`;
}

export default async function DriverRunSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; driverId?: string }>;
}) {
  const sp = await searchParams;
  const scheduleDate = parseScheduleDate(sp.date);
  const dateParam = format(scheduleDate, "yyyy-MM-dd");
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
  const returnTo = buildReturnTo(dateParam, canPickDriver ? sp.driverId : undefined);
  const printParams = new URLSearchParams({ date: dateParam });
  if (driverId) printParams.set("driverId", driverId);
  const isToday = scheduleDate.getTime() === startOfDay(new Date()).getTime();

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
            <Link href={`/tankers/driver/print?${printParams.toString()}`} target="_blank">
              <Button variant="outline">Print driver sheet</Button>
            </Link>
            <Link href="/tankers">
              <Button variant="outline">Office schedule</Button>
            </Link>
          </div>
        }
      />

      <TankerNav active="driver" />

      <form
        action="/tankers/driver"
        method="get"
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
      >
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
          <Link href="/tankers/driver" className="text-sm text-teal-800 hover:underline">
            Jump to today
          </Link>
        ) : null}
      </form>

      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-600">
        <p>
          <span className="font-medium text-slate-900">{runSheet.totalCount}</span>{" "}
          {runSheet.totalCount === 1 ? "delivery" : "deliveries"}
          {selectedDriver ? ` for ${selectedDriver.name}` : isLinkedDriver ? " assigned to you" : ""}
        </p>
        {runSheet.totalCount > 0 ? (
          <p className="text-slate-500">
            Grouped by time slot, then tanker
          </p>
        ) : null}
      </div>

      <DriverRunSheetContent
        slots={runSheet.slots}
        unslotted={runSheet.unslotted}
        returnTo={returnTo}
        canEdit={canEdit}
        showDriver={canPickDriver && (!driverId || sp.driverId === "all")}
      />
    </div>
  );
}
