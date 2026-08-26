import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createVehicle } from "./actions";
import { hasPermission } from "@/lib/rbac";
import { labelize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  const session = await auth();
  const canManage =
    session?.user &&
    (hasPermission(session.user.role, "manage_employees") || hasPermission(session.user.role, "edit"));

  const vehicles = await prisma.vehicle.findMany({
    include: { driver: true },
    orderBy: { vehicleCode: "asc" },
  });

  return (
    <div>
      <PageHeader title="Vehicles" description="Tractors, loaders, and society fleet vehicles." />

      {canManage ? (
        <form action={createVehicle} className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
          <Input name="vehicleCode" placeholder="Code (auto if blank)" />
          <Input name="registrationNo" placeholder="Registration no." />
          <select name="vehicleType" defaultValue="TRACTOR" className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
            <option value="TRACTOR">Tractor</option>
            <option value="LOADER">Loader</option>
            <option value="WATER_TANKER_VEHICLE">Water tanker</option>
            <option value="OTHER">Other</option>
          </select>
          <Input name="remarks" placeholder="Remarks" />
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
