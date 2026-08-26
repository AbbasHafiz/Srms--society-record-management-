import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PageHeader, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function OpenFilesReportPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const canExport = session?.user && hasPermission(session.user.role, "export_reports");

  const days = sp.days ? Number(sp.days) : 30;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() + days);

  const [expiring, expired, active] = await Promise.all([
    prisma.openFile.findMany({
      where: { status: "ACTIVE", expiryDate: { lte: cutoff } },
      include: { plot: true },
      orderBy: { expiryDate: "asc" },
      take: 200,
    }),
    prisma.openFile.count({ where: { status: "EXPIRED" } }),
    prisma.openFile.count({ where: { status: "ACTIVE" } }),
  ]);

  const exportParams = new URLSearchParams({
    report: "open-files",
    days: String(days),
  });

  return (
    <div>
      <PageHeader
        title="Open Files Expiring Report"
        description="Dealer open files nearing expiry — action required before transfer window closes."
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

      <form className="mb-4 flex items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-600">Expiring within (days)</span>
          <input
            type="number"
            name="days"
            defaultValue={days}
            min={1}
            className="h-10 w-24 rounded-md border border-slate-300 px-3 text-sm"
          />
        </label>
        <Button type="submit">Apply</Button>
      </form>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Active Open Files" value={active} />
        <StatCard label={`Expiring ≤${days}d`} value={expiring.length} tone="warn" />
        <StatCard label="Already Expired" value={expired} tone="danger" />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="data-table">
          <thead>
            <tr>
              <th>Open File</th>
              <th>Plot</th>
              <th>Dealer</th>
              <th>Seller</th>
              <th>Expiry</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {expiring.map((f) => (
              <tr key={f.id}>
                <td>
                  <Link href={`/open-files/${f.id}`} className="font-medium text-teal-900 hover:underline">
                    {f.openFileNumber}
                  </Link>
                </td>
                <td>{f.plot.sector}/{f.plot.block}-{f.plot.plotNumber}</td>
                <td>{f.dealerName}</td>
                <td>{f.sellerName}</td>
                <td>{formatDate(f.expiryDate)}</td>
                <td><Badge status={f.status} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
