import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createVehicle } from "./actions";
import { canManageFleetRecords, canViewFuelSpending } from "@/lib/rbac";
import { listWaterTankersWithoutVehicle } from "@/lib/vehicles";
import { VehicleCreateForm } from "@/components/vehicles/vehicle-create-form";
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
        <VehicleCreateForm action={createVehicle} unlinkedTankers={unlinkedTankers} />
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
                  <td>{labelize(v.vehicleType)}{v.customType ? ` (${v.customType})` : ""}</td>
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
