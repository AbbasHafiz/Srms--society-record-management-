import Link from "next/link";
import { auth } from "@/lib/auth";
import { PageHeader, StatCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canAddFuelLog, canViewFuelSpending } from "@/lib/rbac";
import {
  getFuelSpendingSummary,
  listActiveVehiclesForFuel,
  VEHICLE_TYPE_OPTIONS,
} from "@/lib/vehicles";
import { formatCurrency, formatDate } from "@/lib/utils";
import { vehicleTypeLabel } from "@/lib/vehicles-shared";
import { endOfMonth, startOfMonth } from "date-fns";
import type { VehicleType } from "@/generated/prisma/client";
import { addFuelLog } from "../actions";

export const dynamic = "force-dynamic";

export default async function VehicleFuelPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; vehicleType?: string; vehicleId?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user || !canViewFuelSpending(session.user.role)) {
    return (
      <div>
        <PageHeader title="Fuel spending" description="You do not have permission to view fuel records." />
        <Link href="/vehicles" className="text-sm text-teal-800 hover:underline">
          ← Vehicles
        </Link>
      </div>
    );
  }

  const tankerOnly = session.user.role === "TANKER_OPERATOR";
  const canAdd = canAddFuelLog(session.user.role);

  const now = new Date();
  const from = sp.from ? new Date(sp.from) : startOfMonth(now);
  const to = sp.to ? new Date(sp.to) : endOfMonth(now);
  const vehicleType = sp.vehicleType as VehicleType | undefined;
  const vehicleId = sp.vehicleId || undefined;

  const [summary, vehicles] = await Promise.all([
    getFuelSpendingSummary({ from, to, vehicleType, vehicleId, tankerOnly }),
    listActiveVehiclesForFuel(tankerOnly),
  ]);

  return (
    <div>
      <PageHeader
        title="Fuel spending"
        description={
          tankerOnly
            ? "Tanker vehicle fuel history (view only)."
            : "Append-only fuel spend by vehicle, type, and date range."
        }
        actions={
          <Link href="/vehicles" className="text-sm text-teal-800 hover:underline">
            ← Vehicles
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total spend" value={formatCurrency(summary.totalAmount)} />
        <StatCard label="Total liters" value={summary.totalLiters.toLocaleString("en-PK")} />
        <StatCard label="Fuel entries" value={summary.logCount} />
      </div>

      <form className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">From</span>
          <Input type="date" name="from" defaultValue={from.toISOString().slice(0, 10)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">To</span>
          <Input type="date" name="to" defaultValue={to.toISOString().slice(0, 10)} />
        </label>
        {!tankerOnly ? (
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Vehicle type</span>
            <select name="vehicleType" defaultValue={vehicleType ?? ""} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
              <option value="">All types</option>
              {VEHICLE_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Vehicle</span>
          <select name="vehicleId" defaultValue={vehicleId ?? ""} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
            <option value="">All vehicles</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.vehicleCode}
                {v.linkedTanker ? ` (${v.linkedTanker.tankerCode})` : ""}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <Button type="submit" variant="outline">
            Apply filters
          </Button>
        </div>
      </form>

      {canAdd ? (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display mb-4 text-lg font-semibold">Quick add fuel log</h2>
          <form action={addFuelLog} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Vehicle *</span>
              <select name="vehicleId" required className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                <option value="">Select…</option>
                {vehicles.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.vehicleCode} — {vehicleTypeLabel(v.vehicleType)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Date *</span>
              <Input type="date" name="date" defaultValue={now.toISOString().slice(0, 10)} required />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Liters *</span>
              <Input type="number" name="liters" step="0.01" min="0" required />
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Amount (PKR) *</span>
              <Input type="number" name="amount" step="0.01" min="0" required />
            </label>
            <label className="text-sm lg:col-span-2">
              <span className="mb-1 block font-medium text-slate-700">Remarks</span>
              <Input name="remarks" />
            </label>
            <div className="flex items-end">
              <Button type="submit">Save fuel log</Button>
            </div>
          </form>
        </section>
      ) : null}

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold">By vehicle</h2>
          </div>
          {summary.byVehicle.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">No fuel logs in this period.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Vehicle</th>
                  <th>Type</th>
                  <th>Liters</th>
                  <th>Amount</th>
                  <th>Entries</th>
                </tr>
              </thead>
              <tbody>
                {summary.byVehicle.map((row) => (
                  <tr key={row.vehicle.id}>
                    <td className="font-medium">
                      <Link href={`/vehicles/${row.vehicle.id}`} className="text-teal-900 hover:underline">
                        {row.vehicle.vehicleCode}
                      </Link>
                    </td>
                    <td>{vehicleTypeLabel(row.vehicle.vehicleType)}</td>
                    <td>{row.liters.toLocaleString("en-PK")}</td>
                    <td>{formatCurrency(row.amount)}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold">By vehicle type</h2>
          </div>
          {summary.byType.length === 0 ? (
            <p className="px-5 py-6 text-sm text-slate-500">No fuel logs in this period.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Liters</th>
                  <th>Amount</th>
                  <th>Entries</th>
                </tr>
              </thead>
              <tbody>
                {summary.byType.map(([type, row]) => (
                  <tr key={type}>
                    <td className="font-medium">{vehicleTypeLabel(type)}</td>
                    <td>{row.liters.toLocaleString("en-PK")}</td>
                    <td>{formatCurrency(row.amount)}</td>
                    <td>{row.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Fuel log history</h2>
        </div>
        {summary.logs.length === 0 ? (
          <p className="px-5 py-6 text-sm text-slate-500">No fuel logs in this period.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Vehicle</th>
                <th>Type</th>
                <th>Liters</th>
                <th>Amount</th>
                <th>Driver</th>
              </tr>
            </thead>
            <tbody>
              {summary.logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDate(log.date)}</td>
                  <td>
                    <Link href={`/vehicles/${log.vehicle.id}`} className="text-teal-900 hover:underline">
                      {log.vehicle.vehicleCode}
                    </Link>
                    {log.vehicle.linkedTanker ? (
                      <div className="text-xs text-slate-500">{log.vehicle.linkedTanker.tankerCode}</div>
                    ) : null}
                  </td>
                  <td>{vehicleTypeLabel(log.vehicle.vehicleType)}</td>
                  <td>{String(log.liters)}</td>
                  <td>{formatCurrency(log.amount)}</td>
                  <td>{log.driver?.name ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
