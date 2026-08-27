import Link from "next/link";
import { auth } from "@/lib/auth";
import { PageHeader, StatCard, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { canManageMess } from "@/lib/rbac";
import { getMessSpendingSummary } from "@/lib/mess";
import { MEAL_TYPE_OPTIONS } from "@/lib/mess-shared";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { endOfMonth, startOfMonth } from "date-fns";
import type { MealType } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function MessPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; mealType?: string }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  const canManage = session?.user && canManageMess(session.user.role);

  const now = new Date();
  const from = sp.from ? new Date(sp.from) : startOfMonth(now);
  const to = sp.to ? new Date(sp.to) : endOfMonth(now);
  const mealType = sp.mealType as MealType | undefined;

  const summary = await getMessSpendingSummary({ from, to, mealType });

  return (
    <div>
      <PageHeader
        title="Staff Mess"
        description="Daily meal records, headcount, and mess spending."
        actions={
          canManage ? (
            <Link href="/mess/new">
              <Button size="sm">Add meal record</Button>
            </Link>
          ) : null
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Total spend" value={formatCurrency(summary.totalAmount)} />
        <StatCard label="Total headcount" value={summary.totalHeadcount.toLocaleString("en-PK")} />
        <StatCard label="Meal records" value={summary.mealCount} />
      </div>

      <form className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">From</span>
          <Input type="date" name="from" defaultValue={from.toISOString().slice(0, 10)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">To</span>
          <Input type="date" name="to" defaultValue={to.toISOString().slice(0, 10)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Meal type</span>
          <select name="mealType" defaultValue={mealType ?? ""} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
            <option value="">All meals</option>
            {MEAL_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-end">
          <Button type="submit" variant="outline">
            Apply filters
          </Button>
        </div>
      </form>

      {summary.byType.length > 0 ? (
        <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold">By meal type</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Meal</th>
                <th>Headcount</th>
                <th>Amount</th>
                <th>Records</th>
              </tr>
            </thead>
            <tbody>
              {summary.byType.map((row) => (
                <tr key={row.mealType}>
                  <td className="font-medium">{labelize(row.mealType)}</td>
                  <td>{row.headcount.toLocaleString("en-PK")}</td>
                  <td>{formatCurrency(row.amount)}</td>
                  <td>{row.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}

      {summary.meals.length === 0 ? (
        <EmptyState title="No mess records" description="Meal entries for this period will appear here." />
      ) : (
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Meal records</h2>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Meal</th>
                <th>Headcount</th>
                <th>Amount</th>
                <th>Vendor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.meals.map((meal) => (
                <tr key={meal.id}>
                  <td>
                    <Link href={`/mess/${meal.id}`} className="font-medium text-teal-900 hover:underline">
                      {formatDate(meal.mealDate)}
                    </Link>
                  </td>
                  <td>{labelize(meal.mealType)}</td>
                  <td>{meal.headcount}</td>
                  <td>{formatCurrency(meal.amount)}</td>
                  <td>{meal.vendor ?? "—"}</td>
                  <td>
                    <Badge status={meal.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
