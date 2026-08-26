import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addFuelLog, addMaintenanceLog, addVehicleUsage } from "../actions";
import { canAddFuelLog, canManageFleetRecords } from "@/lib/rbac";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VehicleDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ section?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const section = sp.section || "fuel";

  const session = await auth();
  const canEdit = session?.user && canManageFleetRecords(session.user.role);
  const canAddFuel = session?.user && canAddFuelLog(session.user.role);

  const vehicle = await prisma.vehicle.findUnique({
    where: { id },
    include: {
      driver: true,
      linkedTanker: true,
      fuelLogs: { include: { driver: true }, orderBy: { date: "desc" }, take: 50 },
      usageLogs: { include: { driver: true }, orderBy: { date: "desc" }, take: 50 },
      maintenance: { orderBy: { date: "desc" }, take: 50 },
    },
  });

  if (!vehicle) notFound();

  const drivers =
    canAddFuel || canEdit
      ? await prisma.employee.findMany({
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, employeeCode: true },
      })
      : [];

  const tabs = [
    { key: "fuel", label: "Fuel logs" },
    { key: "usage", label: "Daily usage" },
    { key: "maintenance", label: "Maintenance" },
  ];

  return (
    <div>
      <div className="mb-4">
        <Link href="/vehicles" className="text-sm text-teal-800 hover:underline">
          ← Vehicles
        </Link>
      </div>

      <PageHeader
        title={vehicle.vehicleCode}
        description={`${labelize(vehicle.vehicleType)}${vehicle.registrationNo ? ` · ${vehicle.registrationNo}` : ""}`}
        actions={<Badge status={vehicle.isActive ? "ACTIVE" : "INACTIVE"} />}
      />

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <Row label="Driver" value={vehicle.driver ? `${vehicle.driver.name} (${vehicle.driver.employeeCode})` : "—"} />
          <Row label="Registration" value={vehicle.registrationNo ?? "—"} />
          <Row label="Used for" value={labelize(vehicle.usedFor)} />
          <Row
            label="Linked tanker"
            value={
              vehicle.linkedTanker ? (
                <Link href="/tankers/fleet" className="text-teal-800 hover:underline">
                  {vehicle.linkedTanker.tankerCode}
                </Link>
              ) : (
                "—"
              )
            }
          />
          {vehicle.remarks ? <Row label="Remarks" value={vehicle.remarks} /> : null}
        </dl>
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {tabs.map((t) => (
          <Link
            key={t.key}
            href={`/vehicles/${vehicle.id}?section=${t.key}`}
            className={`rounded-md px-3 py-1.5 text-sm ${
              section === t.key
                ? "bg-teal-800 text-white"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {(canAddFuel || canEdit) ? (
          <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-display mb-4 text-lg font-semibold">
              {section === "fuel" ? "Add fuel log" : section === "usage" ? "Add usage log" : "Add maintenance"}
            </h2>

            {section === "fuel" && canAddFuel ? (
              <form action={addFuelLog} className="space-y-3">
                <input type="hidden" name="vehicleId" value={vehicle.id} />
                <Field label="Date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                <Field label="Liters" name="liters" type="number" step="0.01" required />
                <Field label="Amount (PKR)" name="amount" type="number" step="0.01" required />
                <DriverSelect drivers={drivers} defaultDriverId={vehicle.driverId} />
                <Field label="Remarks" name="remarks" />
                <Button type="submit">Save fuel log</Button>
              </form>
            ) : null}

            {section === "usage" && canEdit ? (
              <form action={addVehicleUsage} className="space-y-3">
                <input type="hidden" name="vehicleId" value={vehicle.id} />
                <Field label="Date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                <Field label="Assignment" name="assignment" placeholder="e.g. Street sweeping E-17" />
                <Field label="Hours used" name="hoursUsed" type="number" step="0.1" />
                <DriverSelect drivers={drivers} defaultDriverId={vehicle.driverId} />
                <Field label="Remarks" name="remarks" />
                <Button type="submit">Save usage log</Button>
              </form>
            ) : null}

            {section === "maintenance" && canEdit ? (
              <form action={addMaintenanceLog} className="space-y-3">
                <input type="hidden" name="vehicleId" value={vehicle.id} />
                <Field label="Date" name="date" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                <Field label="Description" name="description" required />
                <Field label="Cost (PKR)" name="cost" type="number" step="0.01" required />
                <Field label="Remarks" name="remarks" />
                <Button type="submit">Save maintenance log</Button>
              </form>
            ) : null}
          </section>
        ) : null}

        <section className={`rounded-xl border border-slate-200 bg-white p-5 shadow-sm ${canAddFuel || canEdit ? "" : "lg:col-span-2"}`}>
          <h2 className="font-display mb-4 text-lg font-semibold">History</h2>

          {section === "fuel" ? (
            <HistoryTable
              headers={["Date", "Liters", "Amount", "Driver"]}
              rows={vehicle.fuelLogs.map((f) => [
                formatDate(f.date),
                String(f.liters),
                formatCurrency(f.amount),
                f.driver?.name ?? "—",
              ])}
            />
          ) : null}

          {section === "usage" ? (
            <HistoryTable
              headers={["Date", "Assignment", "Hours", "Driver"]}
              rows={vehicle.usageLogs.map((u) => [
                formatDate(u.date),
                u.assignment ?? "—",
                u.hoursUsed ? String(u.hoursUsed) : "—",
                u.driver?.name ?? "—",
              ])}
            />
          ) : null}

          {section === "maintenance" ? (
            <HistoryTable
              headers={["Date", "Description", "Cost"]}
              rows={vehicle.maintenance.map((m) => [
                formatDate(m.date),
                m.description,
                formatCurrency(m.cost),
              ])}
            />
          ) : null}
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{value}</dd>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  step,
  required,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  type?: string;
  step?: string;
  required?: boolean;
  defaultValue?: string;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">{label}</label>
      <Input
        name={name}
        type={type}
        step={step}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
      />
    </div>
  );
}

function DriverSelect({
  drivers,
  defaultDriverId,
}: {
  drivers: { id: string; name: string; employeeCode: string }[];
  defaultDriverId?: string | null;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Driver (optional)</label>
      <select
        name="driverId"
        defaultValue={defaultDriverId ?? ""}
        className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
      >
        <option value="">—</option>
        {drivers.map((d) => (
          <option key={d.id} value={d.id}>
            {d.name} ({d.employeeCode})
          </option>
        ))}
      </select>
    </div>
  );
}

function HistoryTable({ headers, rows }: { headers: string[]; rows: string[][] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No records yet.</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
