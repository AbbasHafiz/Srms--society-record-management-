import Link from "next/link";
import { auth } from "@/lib/auth";
import {
  canManageElectricity,
  canViewElectricity,
  getElectricitySummary,
  getMonthlyElectricitySpend,
  periodLabel,
  refreshOverdueElectricityBills,
  UTILITY_BILL_STATUSES,
} from "@/lib/electricity";
import { PageHeader, StatCard, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import type { UtilityBillStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function ElectricityPage({
  searchParams,
}: {
  searchParams: Promise<{
    periodMonth?: string;
    periodYear?: string;
    status?: string;
    vendor?: string;
  }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user || !canViewElectricity(session.user.role)) {
    return (
      <div>
        <PageHeader title="Electricity" description="You do not have access to utility bills." />
      </div>
    );
  }

  await refreshOverdueElectricityBills();

  const now = new Date();
  const periodMonth = sp.periodMonth ? Number(sp.periodMonth) : undefined;
  const periodYear = sp.periodYear ? Number(sp.periodYear) : undefined;
  const status = UTILITY_BILL_STATUSES.includes(sp.status as UtilityBillStatus)
    ? (sp.status as UtilityBillStatus)
    : undefined;
  const vendor = sp.vendor?.trim() || undefined;

  const filters = { periodMonth, periodYear, status, vendor };
  const [summary, monthlySpend] = await Promise.all([
    getElectricitySummary(filters),
    getMonthlyElectricitySpend(periodMonth ?? now.getMonth() + 1, periodYear ?? now.getFullYear()),
  ]);

  const canManage = canManageElectricity(session.user.role);

  return (
    <div>
      <PageHeader
        title="Electricity"
        description="Society electricity bills — monthly consumption, payments, and vendor records."
        actions={
          canManage ? (
            <Link href="/electricity/new">
              <Button>Add bill</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Monthly billed"
          value={formatCurrency(monthlySpend.billedAmount)}
          hint={
            monthlySpend.billedUnits > 0
              ? `${monthlySpend.billedUnits.toLocaleString()} units`
              : periodLabel(periodMonth ?? now.getMonth() + 1, periodYear ?? now.getFullYear())
          }
        />
        <StatCard
          label="Monthly paid"
          value={formatCurrency(monthlySpend.paidAmount)}
          tone="success"
        />
        <StatCard label="Filtered total" value={formatCurrency(summary.totalAmount)} />
        <StatCard label="Paid (filtered)" value={formatCurrency(summary.paidAmount)} tone="success" />
      </div>

      <form className="mb-4 flex flex-wrap gap-2">
        <select
          name="periodMonth"
          defaultValue={periodMonth ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All months</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {new Date(2000, i, 1).toLocaleDateString("en-GB", { month: "long" })}
            </option>
          ))}
        </select>
        <input
          type="number"
          name="periodYear"
          placeholder="Year"
          defaultValue={periodYear ?? ""}
          className="h-10 w-28 rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {UTILITY_BILL_STATUSES.map((s) => (
            <option key={s} value={s}>
              {labelize(s)}
            </option>
          ))}
        </select>
        <input
          name="vendor"
          placeholder="Vendor"
          defaultValue={vendor ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {summary.bills.length === 0 ? (
        <EmptyState title="No electricity bills" description="Add a bill or adjust filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Period</th>
                <th>Vendor</th>
                <th>Units</th>
                <th>Amount</th>
                <th>Due</th>
                <th>Paid</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.bills.map((bill) => (
                <tr key={bill.id}>
                  <td>
                    <Link href={`/electricity/${bill.id}`} className="font-medium text-teal-900 hover:underline">
                      {periodLabel(bill.periodMonth, bill.periodYear)}
                    </Link>
                    {bill.accountNo ? (
                      <div className="text-xs text-slate-500">Acct {bill.accountNo}</div>
                    ) : null}
                  </td>
                  <td>{bill.vendor ?? "—"}</td>
                  <td>{bill.units != null ? Number(bill.units).toLocaleString() : "—"}</td>
                  <td>{formatCurrency(bill.amount)}</td>
                  <td>{formatDate(bill.dueDate)}</td>
                  <td>{bill.paidAt ? formatDate(bill.paidAt) : "—"}</td>
                  <td>
                    <Badge status={bill.status} />
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
