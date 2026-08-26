import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createVehicle } from "./actions";
import { canManageFleetRecords, canViewFuelSpending } from "@/lib/rbac";
import { listWaterTankersWithoutVehicle, VEHICLE_TYPE_OPTIONS, VEHICLE_USED_FOR_OPTIONS } from "@/lib/vehicles";
import { labelize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  const session = await auth();
  const canManage = session?.user && canManageFleetRecords(session.user.role);
  const canViewFuel = session?.user && canViewFuelSpending(session.user.role);

  const [vehicles, unlinkedTankers] = await Promise.all([
    prisma.vehicle.findMany({
      include: { driver: true, linkedTanker: true },
      orderBy: { vehicleCode: "asc" },
    }),
    canManage ? listWaterTankersWithoutVehicle() : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title="Vehicles"
        description="Staff pickup, tractors, tanker vehicles, and society fleet."
        actions={
          canViewFuel ? (
            <Link href="/vehicles/fuel">
              <Button variant="outline" size="sm">
                Fuel spending
              </Button>
            </Link>
          ) : null
        }
      />

      {canManage ? (
        <form action={createVehicle} className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
          <Input name="vehicleCode" placeholder="Code (auto if blank)" />
          <Input name="registrationNo" placeholder="Registration no." />
          <select name="vehicleType" defaultValue="STAFF_PICKUP" className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
            {VEHICLE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <select name="usedFor" defaultValue="STAFF_PICKUP" className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
            {VEHICLE_USED_FOR_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          {unlinkedTankers.length > 0 ? (
            <select name="waterTankerId" defaultValue="" className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm lg:col-span-2">
              <option value="">Link water tanker (optional)</option>
              {unlinkedTankers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.tankerCode} ({t.capacityLiters.toLocaleString()} L)
                </option>
              ))}
            </select>
          ) : null}
          <Input name="remarks" placeholder="Remarks" className="lg:col-span-2" />
          <Button type="submit">Add vehicle</Button>
        </form>
      ) : null}

      {vehicles.length === 0 ? (
        <EmptyState title="No vehicles registered" description="Fleet vehicles will appear here." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Registration</th>
                <th>Type</th>
                <th>Used for</th>
                <th>Linked tanker</th>
                <th>Driver</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {vehicles.map((v) => (
                <tr key={v.id}>
                  <td className="font-medium">
                    <Link href={`/vehicles/${v.id}`} className="text-teal-900 hover:underline">
                      {v.vehicleCode}
                    </Link>
                  </td>
                  <td>{v.registrationNo ?? "—"}</td>
                  <td>{labelize(v.vehicleType)}</td>
                  <td>{labelize(v.usedFor)}</td>
                  <td>{v.linkedTanker?.tankerCode ?? "—"}</td>
                  <td>
                    {v.driver ? (
                      <span>
                        {v.driver.name}
                        <div className="text-xs text-slate-500">{v.driver.employeeCode}</div>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <Badge status={v.isActive ? "ACTIVE" : "INACTIVE"} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
