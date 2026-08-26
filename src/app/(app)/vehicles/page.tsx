import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { labelize } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function VehiclesPage() {
  const vehicles = await prisma.vehicle.findMany({
    include: { driver: true },
    orderBy: { vehicleCode: "asc" },
  });

  return (
    <div>
      <PageHeader title="Vehicles" description="Tractors, loaders, and society fleet vehicles." />

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
                  <td className="font-medium">{v.vehicleCode}</td>
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
