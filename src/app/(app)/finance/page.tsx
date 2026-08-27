import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canAccessModule, hasPermission } from "@/lib/rbac";
import { getFinanceSummary } from "@/lib/finance";
import { PageHeader, StatCard, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { postFinanceTxnAction, voidFinanceTxnAction } from "./actions";
import { ConfirmOnSubmitForm, QueryErrorBanner } from "@/components/ui/confirm-on-submit-form";
import type { FinanceCategoryType, FinanceTransactionStatus } from "@/generated/prisma/client";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const TABS = [
  { id: "all", label: "All Ledger" },
  { id: "revenue", label: "Revenue" },
  { id: "expenses", label: "Expenses" },
] as const;

const STATUSES: FinanceTransactionStatus[] = ["DRAFT", "POSTED", "VOID"];

function tabHref(tab: string, filters: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  if (tab !== "all") params.set("tab", tab);
  if (filters.status) params.set("status", filters.status);
  if (filters.categoryId) params.set("categoryId", filters.categoryId);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  const q = params.toString();
  return q ? `/finance?${q}` : "/finance";
}

export default async function FinancePage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string;
    status?: string;
    categoryId?: string;
    from?: string;
    to?: string;
    error?: string;
  }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user || !canAccessModule(session.user.role, "finance")) {
    return (
      <div>
        <PageHeader title="Finance" description="You do not have access to finance records." />
      </div>
    );
  }

  const canManage = hasPermission(session.user.role, "manage_finance");
  const tab = sp.tab === "revenue" || sp.tab === "expenses" ? sp.tab : "all";
  const status = STATUSES.includes(sp.status as FinanceTransactionStatus)
    ? (sp.status as FinanceTransactionStatus)
    : undefined;

  const typeFilter: FinanceCategoryType | undefined =
    tab === "revenue" ? "REVENUE" : tab === "expenses" ? "EXPENSE" : undefined;

  const dateFilter =
    sp.from || sp.to
      ? {
          gte: sp.from ? new Date(sp.from) : undefined,
          lte: sp.to ? new Date(sp.to + "T23:59:59") : undefined,
        }
      : undefined;

  const [summary, categories, transactions] = await Promise.all([
    getFinanceSummary(),
    prisma.financeCategory.findMany({
      where: { isActive: true },
      orderBy: [{ type: "asc" }, { sortOrder: "asc" }],
    }),
    prisma.financeTransaction.findMany({
      where: {
        ...(typeFilter ? { type: typeFilter } : {}),
        ...(status ? { status } : {}),
        ...(sp.categoryId ? { categoryId: sp.categoryId } : {}),
        ...(dateFilter ? { txnDate: dateFilter } : {}),
      },
      include: {
        category: true,
        plot: true,
        employee: { select: { name: true, employeeCode: true } },
        payment: { select: { receiptNumber: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: [{ txnDate: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Revenue & Expenses"
        description="Society income and expenditure ledger. Posted entries are immutable — void and re-enter to correct."
        actions={
          <>
            {canManage ? (
              <Link href="/finance/new">
                <Button>Record entry</Button>
              </Link>
            ) : null}
            {canManage ? (
              <Link href="/finance/categories">
                <Button variant="outline">Categories</Button>
              </Link>
            ) : null}
            <Link href="/payments" className="text-sm text-teal-800 hover:underline self-center">
              Payment receipts
            </Link>
          </>
        }
      />

      <QueryErrorBanner error={sp.error} />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Today's revenue" value={formatCurrency(summary.todayRevenue)} tone="success" />
        <StatCard label="Today's expenses" value={formatCurrency(summary.todayExpenses)} tone="warn" />
        <StatCard label="MTD revenue" value={formatCurrency(summary.mtdRevenue)} />
        <StatCard label="MTD expenses" value={formatCurrency(summary.mtdExpenses)} />
        <StatCard
          label="MTD net"
          value={formatCurrency(summary.mtdNet)}
          tone={summary.mtdNet >= 0 ? "success" : "danger"}
          hint={`Today net: ${formatCurrency(summary.todayNet)}`}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {TABS.map((t) => (
          <Link
            key={t.id}
            href={tabHref(t.id, sp)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === t.id
                ? "bg-teal-800 text-white"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            )}
          >
            {t.label}
          </Link>
        ))}
      </div>

      <form className="mb-4 flex flex-wrap gap-2">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {labelize(s)}
            </option>
          ))}
        </select>
        <select
          name="categoryId"
          defaultValue={sp.categoryId ?? ""}
          className="h-10 min-w-[200px] rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All categories</option>
          {categories
            .filter((c) => !typeFilter || c.type === typeFilter)
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
        <input
          type="date"
          name="from"
          defaultValue={sp.from ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <input
          type="date"
          name="to"
          defaultValue={sp.to ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <input type="hidden" name="tab" value={tab === "all" ? "" : tab} />
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {transactions.length === 0 ? (
        <EmptyState title="No ledger entries" description="Adjust filters or record a new revenue/expense entry." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Txn #</th>
                <th>Date</th>
                <th>Category</th>
                <th>Type</th>
                <th>Amount</th>
                <th>Method / Ref</th>
                <th>Plot / Staff</th>
                <th>Status</th>
                {canManage ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {transactions.map((txn) => (
                <tr key={txn.id}>
                  <td className="font-medium">{txn.txnNumber}</td>
                  <td>{formatDate(txn.txnDate)}</td>
                  <td>{txn.category.name}</td>
                  <td>
                    <Badge className={txn.type === "REVENUE" ? "bg-emerald-50 text-emerald-800" : undefined}>
                      {labelize(txn.type)}
                    </Badge>
                  </td>
                  <td className={txn.type === "REVENUE" ? "text-emerald-800" : "text-rose-800"}>
                    {txn.type === "REVENUE" ? "+" : "−"}
                    {formatCurrency(txn.amount)}
                  </td>
                  <td>
                    <div>{labelize(txn.paymentMethod)}</div>
                    {txn.reference ? (
                      <div className="text-xs text-slate-500">{txn.reference}</div>
                    ) : txn.payment ? (
                      <div className="text-xs text-slate-500">{txn.payment.receiptNumber}</div>
                    ) : null}
                  </td>
                  <td>
                    {txn.plot ? (
                      <Link href={`/plots/${txn.plotId}`} className="text-teal-900 hover:underline">
                        {txn.plot.sector}/{txn.plot.block}-{txn.plot.plotNumber}
                      </Link>
                    ) : txn.employee ? (
                      <span>
                        {txn.employee.name}
                        <div className="text-xs text-slate-500">{txn.employee.employeeCode}</div>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    <Badge status={txn.status} />
                    {txn.voidReason ? (
                      <div className="mt-1 max-w-[140px] truncate text-xs text-slate-500" title={txn.voidReason}>
                        {txn.voidReason}
                      </div>
                    ) : null}
                  </td>
                  {canManage ? (
                    <td>
                      <div className="flex flex-col gap-1">
                        {txn.status === "DRAFT" ? (
                          <form action={postFinanceTxnAction}>
                            <input type="hidden" name="txnId" value={txn.id} />
                            <Button type="submit" size="sm" variant="outline">
                              Post
                            </Button>
                          </form>
                        ) : null}
                        {txn.status !== "VOID" ? (
                          <ConfirmOnSubmitForm
                            action={voidFinanceTxnAction}
                            confirmMessage={`Void ledger entry ${txn.txnNumber}? Posted amounts are never changed — only status is set to VOID.`}
                            className="flex flex-col gap-1"
                          >
                            <input type="hidden" name="txnId" value={txn.id} />
                            <input
                              name="reason"
                              placeholder="Void reason"
                              className="h-8 w-28 rounded border border-slate-300 px-2 text-xs"
                              required
                            />
                            <Button type="submit" size="sm" variant="outline" className="text-rose-800">
                              Void
                            </Button>
                          </ConfirmOnSubmitForm>
                        ) : (
                          "—"
                        )}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {canManage ? (
        <p className="mt-4 text-xs text-slate-500">
          Verified transfer and open-file payments auto-post to revenue on verification. Other fee types can be posted
          manually from the Payments page.
        </p>
      ) : null}
    </div>
  );
}
