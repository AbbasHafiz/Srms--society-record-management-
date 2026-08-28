import Link from "next/link";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { startOfMonth, endOfMonth } from "date-fns";
import { PrintButton } from "@/components/print/print-button";

export const dynamic = "force-dynamic";

export default async function FinanceReportPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const canExport = session?.user && hasPermission(session.user.role, "export_reports");

  const monthStr = sp.month ?? new Date().toISOString().slice(0, 7);
  const [year, month] = monthStr.split("-").map(Number);
  const from = startOfMonth(new Date(year, month - 1));
  const to = endOfMonth(new Date(year, month - 1));

  const [revenueAgg, expenseAgg, transactions, byCategory] = await Promise.all([
    prisma.financeTransaction.aggregate({
      where: { type: "REVENUE", status: "POSTED", txnDate: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    prisma.financeTransaction.aggregate({
      where: { type: "EXPENSE", status: "POSTED", txnDate: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    prisma.financeTransaction.findMany({
      where: { txnDate: { gte: from, lte: to }, status: "POSTED" },
      include: { category: true },
      orderBy: { txnDate: "desc" },
      take: 100,
    }),
    prisma.financeTransaction.groupBy({
      by: ["categoryId", "type"],
      where: { txnDate: { gte: from, lte: to }, status: "POSTED" },
      _sum: { amount: true },
    }),
  ]);

  const categories = await prisma.financeCategory.findMany({
    where: { id: { in: byCategory.map((c) => c.categoryId) } },
  });
  const catMap = new Map(categories.map((c) => [c.id, c]));

  const revenue = Number(revenueAgg._sum.amount ?? 0);
  const expenses = Number(expenseAgg._sum.amount ?? 0);

  const exportParams = new URLSearchParams({ report: "finance", month: monthStr });

  return (
    <div>
      <PageHeader
        title="Finance MTD Report"
        description={`Posted revenue and expenses for ${monthStr}.`}
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
            <PrintButton href={`/reports/finance/print?month=${monthStr}`} label="Print summary" />
          </div>
        }
      />

      <form className="mb-4 flex items-end gap-2">
        <label className="text-sm">
          <span className="mb-1 block text-xs text-slate-600">Month</span>
          <input
            type="month"
            name="month"
            defaultValue={monthStr}
            className="h-10 rounded-md border border-slate-300 px-3 text-sm"
          />
        </label>
        <Button type="submit">Apply</Button>
      </form>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <StatCard label="Revenue (posted)" value={formatCurrency(revenue)} tone="success" />
        <StatCard label="Expenses (posted)" value={formatCurrency(expenses)} tone="warn" />
        <StatCard
          label="Net"
          value={formatCurrency(revenue - expenses)}
          tone={revenue >= expenses ? "success" : "danger"}
        />
        <StatCard label="Transactions" value={transactions.length} />
      </div>

      <div className="mb-6 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">By Category</h2>
          <table className="data-table mt-3">
            <thead>
              <tr>
                <th>Category</th>
                <th>Type</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {byCategory.map((row) => {
                const cat = catMap.get(row.categoryId);
                return (
                  <tr key={`${row.categoryId}-${row.type}`}>
                    <td>{cat?.name ?? row.categoryId}</td>
                    <td><Badge>{labelize(row.type)}</Badge></td>
                    <td>{formatCurrency(row._sum.amount ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Recent Posted</h2>
          <table className="data-table mt-3">
            <thead>
              <tr>
                <th>Txn</th>
                <th>Category</th>
                <th>Amount</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {transactions.slice(0, 15).map((t) => (
                <tr key={t.id}>
                  <td className="font-medium">{t.txnNumber}</td>
                  <td>{t.category.name}</td>
                  <td>{formatCurrency(t.amount)}</td>
                  <td>{formatDate(t.txnDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
