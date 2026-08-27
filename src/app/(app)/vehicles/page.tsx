import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { createVehicle } from "./actions";
import { canManageFleetRecords, canViewFuelSpending } from "@/lib/rbac";
import { listWaterTankersWithoutVehicle } from "@/lib/vehicles";
import { VehicleCreateForm } from "@/components/vehicles/vehicle-create-form";
import { VEHICLE_TYPE_OPTIONS, isVehicleType, vehicleTypeLabel } from "@/lib/vehicles-shared";
import { labelize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VehiclesPage({
  searchParams,
}: {
  searchParams: Promise<{ vehicleType?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const canManage = session?.user && canManageFleetRecords(session.user.role);
  const canViewFuel = session?.user && canViewFuelSpending(session.user.role);
  const typeFilter = sp.vehicleType && isVehicleType(sp.vehicleType) ? sp.vehicleType : undefined;

  const [vehicles, unlinkedTankers] = await Promise.all([
    prisma.vehicle.findMany({
      where: typeFilter ? { vehicleType: typeFilter } : undefined,
      include: { driver: true, linkedTanker: true },
      orderBy: { vehicleCode: "asc" },
    }),
    canManage ? listWaterTankersWithoutVehicle() : Promise.resolve([]),
  ]);

  return (
    <div>
      <PageHeader
        title="Vehicles"
        description="Society fleet — cars, bikes, pickups, passenger vans, plant, and tanker vehicles."
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
        <VehicleCreateForm action={createVehicle} unlinkedTankers={unlinkedTankers} />
      ) : null}

      <form className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-end">
        <label className="min-w-0 flex-1 text-sm">
          <span className="mb-1 block font-medium text-slate-700">Filter by type</span>
          <select
            name="vehicleType"
            defaultValue={typeFilter ?? ""}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">All types</option>
            {VEHICLE_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex gap-2">
          <Button type="submit" variant="outline">
            Apply
          </Button>
          {typeFilter ? (
            <Link href="/vehicles" className="inline-flex">
              <Button type="button" variant="ghost">
                Clear
              </Button>
            </Link>
          ) : null}
        </div>
      </form>

      {vehicles.length === 0 ? (
        <EmptyState
          title={typeFilter ? "No vehicles of this type" : "No vehicles registered"}
          description={
            typeFilter
              ? "Try another type, or add a vehicle using the form above."
              : "Fleet vehicles will appear here."
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
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
                  <td>{vehicleTypeLabel(v.vehicleType, v.customType)}</td>
                  <td>{labelize(v.usedFor)}{v.otherDetail ? ` (${v.otherDetail})` : ""}</td>
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
