import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { startOfDay } from "date-fns";

export const dynamic = "force-dynamic";

export default async function TankersPage() {
  const today = startOfDay(new Date());

  const [deliveries, scheduled, completed, collection] = await Promise.all([
    prisma.tankerDelivery.findMany({
      where: { distributionDate: today },
      include: {
        tanker: true,
        plot: true,
      },
      orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    }),
    prisma.tankerDelivery.count({
      where: { distributionDate: today, status: "SCHEDULED" },
    }),
    prisma.tankerDelivery.count({
      where: { distributionDate: today, status: "COMPLETED" },
    }),
    prisma.tankerDelivery.aggregate({
      where: {
        distributionDate: today,
        paymentStatus: { in: ["PAID", "VERIFIED"] },
      },
      _sum: { charges: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Water Tankers"
        description={`Today's distribution schedule and collection for ${today.toLocaleDateString("en-GB")}`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Scheduled" value={scheduled} />
        <StatCard label="Completed" value={completed} tone="success" />
        <StatCard
          label="Today's Collection"
          value={formatCurrency(collection._sum.charges ?? 0)}
          tone="success"
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Today&apos;s Deliveries</h2>
        </div>
        {deliveries.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No tanker deliveries scheduled today.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Tanker</th>
                <th>Customer / Plot</th>
                <th>Area</th>
                <th>Charges</th>
                <th>Payment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="font-medium">{d.tanker.tankerCode}</div>
                    <div className="text-xs text-slate-500">{d.tanker.capacityLiters}L</div>
                  </td>
                  <td>
                    {d.plot ? (
                      <Link href={`/plots/${d.plotId}`} className="text-teal-900 hover:underline">
                        {d.plot.sector}/{d.plot.block}-{d.plot.plotNumber}
                      </Link>
                    ) : (
                      d.customerName ?? "—"
                    )}
                  </td>
                  <td>{d.streetArea ?? "—"}</td>
                  <td>{formatCurrency(d.charges)}</td>
                  <td>
                    <Badge status={d.paymentStatus} />
                  </td>
                  <td>
                    <Badge status={d.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
