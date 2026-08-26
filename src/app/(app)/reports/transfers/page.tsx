import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PageHeader, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, labelize } from "@/lib/utils";
import { startOfMonth, endOfMonth } from "date-fns";

export const dynamic = "force-dynamic";

export default async function TransfersReportPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const canExport = session?.user && hasPermission(session.user.role, "export_reports");

  const from = sp.from ? new Date(sp.from) : startOfMonth(new Date());
  const to = sp.to ? new Date(sp.to + "T23:59:59") : endOfMonth(new Date());
  const status = sp.status?.trim();

  const transfers = await prisma.transfer.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      ...(status ? { status: status as never } : {}),
    },
    include: { plot: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const byStatus = transfers.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] ?? 0) + 1;
    return acc;
  }, {});

  const exportParams = new URLSearchParams({
    report: "transfers",
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  });
  if (status) exportParams.set("status", status);

  return (
    <div>
      <PageHeader
        title="Transfer Report"
        description="Transfers created within the selected date range."
        actions={
          <div className="flex gap-2">
            <Link href="/reports" className="text-sm text-teal-800 hover:underline">← Reports</Link>
            {canExport ? (
              <a
                href={`/reports/export?${exportParams}`}
                className="inline-flex h-8 items-center rounded-md border border-slate-300 bg-white px-3 text-xs font-medium hover:bg-slate-50"
              >
                Export CSV
              </a>
            ) : null}
          </div>
        }
      />

      <form className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-600">From</span>
          <input
            type="date"
            name="from"
            defaultValue={from.toISOString().slice(0, 10)}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-600">To</span>
          <input
            type="date"
            name="to"
            defaultValue={to.toISOString().slice(0, 10)}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-600">Status</span>
          <input
            name="status"
            placeholder="e.g. COMPLETED"
            defaultValue={status}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm"
          />
        </label>
        <Button type="submit">Apply</Button>
      </form>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <StatCard label="Total in range" value={transfers.length} />
        {Object.entries(byStatus).slice(0, 3).map(([s, count]) => (
          <StatCard key={s} label={labelize(s)} value={count} />
        ))}
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="data-table">
          <thead>
            <tr>
              <th>Transfer #</th>
              <th>Plot</th>
              <th>Type</th>
              <th>Seller</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {transfers.map((t) => (
              <tr key={t.id}>
                <td>
                  <Link href={`/transfers/${t.id}`} className="font-medium text-teal-900 hover:underline">
                    {t.transferNumber}
                  </Link>
                </td>
                <td>{t.plot.sector}/{t.plot.block}-{t.plot.plotNumber}</td>
                <td>{labelize(t.transferType)}</td>
                <td>{t.sellerName}</td>
                <td><Badge status={t.status} /></td>
                <td>{formatDate(t.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
