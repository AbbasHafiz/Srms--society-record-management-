import { prisma } from "@/lib/db";
import { getSocietyLetterhead } from "@/lib/print";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { endOfMonth, format, startOfMonth } from "date-fns";
import { PrintDocument, PrintPageShell, PrintRow, PrintSection } from "@/components/print/print-document";

export const dynamic = "force-dynamic";

export default async function FinancePeriodPrintPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const monthStr = sp.month ?? new Date().toISOString().slice(0, 7);
  const [year, month] = monthStr.split("-").map(Number);
  const from = startOfMonth(new Date(year, month - 1));
  const to = endOfMonth(new Date(year, month - 1));

  const [letterhead, revenueAgg, expenseAgg, byCategory, transactions] = await Promise.all([
    getSocietyLetterhead(),
    prisma.financeTransaction.aggregate({
      where: { type: "REVENUE", status: "POSTED", txnDate: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    prisma.financeTransaction.aggregate({
      where: { type: "EXPENSE", status: "POSTED", txnDate: { gte: from, lte: to } },
      _sum: { amount: true },
    }),
    prisma.financeTransaction.groupBy({
      by: ["categoryId", "type"],
      where: { txnDate: { gte: from, lte: to }, status: "POSTED" },
      _sum: { amount: true },
    }),
    prisma.financeTransaction.findMany({
      where: { txnDate: { gte: from, lte: to }, status: "POSTED" },
      include: { category: true },
      orderBy: { txnDate: "desc" },
      take: 80,
    }),
  ]);

  const categories = await prisma.financeCategory.findMany({
    where: { id: { in: byCategory.map((c) => c.categoryId) } },
  });
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const revenue = Number(revenueAgg._sum.amount ?? 0);
  const expenses = Number(expenseAgg._sum.amount ?? 0);
  const periodLabel = format(from, "MMMM yyyy");

  return (
    <PrintPageShell backHref={`/reports/finance?month=${monthStr}`} backLabel="Back to finance report">
      <PrintDocument
        letterhead={letterhead}
        title="Finance Period Summary"
        subtitle={`Posted ledger · ${periodLabel}`}
        serialLabel="Period"
        serial={monthStr}
        date={new Date()}
        parties={[
          { label: "Revenue", value: formatCurrency(revenue) },
          { label: "Expenses", value: formatCurrency(expenses) },
        ]}
        preparedBy="Finance"
        receivedBy="Management"
      >
        <PrintSection title="Totals">
          <dl>
            <PrintRow label="Revenue (PKR)" value={formatCurrency(revenue)} />
            <PrintRow label="Expenses (PKR)" value={formatCurrency(expenses)} />
            <PrintRow label="Net" value={formatCurrency(revenue - expenses)} />
            <PrintRow label="Posted rows" value={String(transactions.length)} />
          </dl>
        </PrintSection>
        <PrintSection title="By category">
          {byCategory.length === 0 ? (
            <p className="text-sm text-slate-700">No posted transactions in this period.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-1">Category</th>
                  <th className="py-1">Type</th>
                  <th className="py-1">Amount</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((row) => {
                  const cat = catMap.get(row.categoryId);
                  return (
                    <tr key={`${row.categoryId}-${row.type}`} className="border-b border-slate-100">
                      <td className="py-1.5 font-medium">{cat?.name ?? row.categoryId}</td>
                      <td className="py-1.5">{labelize(row.type)}</td>
                      <td className="py-1.5">{formatCurrency(row._sum.amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </PrintSection>
        {transactions.length > 0 ? (
          <PrintSection title="Posted transactions">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-1">No.</th>
                  <th className="py-1">Date</th>
                  <th className="py-1">Category</th>
                  <th className="py-1">Amount</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => (
                  <tr key={t.id} className="border-b border-slate-100">
                    <td className="py-1.5 font-mono text-xs">{t.txnNumber}</td>
                    <td className="py-1.5">{formatDate(t.txnDate)}</td>
                    <td className="py-1.5">{t.category.name}</td>
                    <td className="py-1.5">
                      {labelize(t.type)} {formatCurrency(t.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </PrintSection>
        ) : null}
      </PrintDocument>
    </PrintPageShell>
  );
}
