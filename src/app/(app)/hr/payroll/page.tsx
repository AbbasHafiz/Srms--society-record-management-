import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { PageHeader, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, labelize } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const sp = await searchParams;
  const now = new Date();
  const year = sp.year ? Number(sp.year) : now.getFullYear();
  const month = sp.month ? Number(sp.month) : now.getMonth() + 1;

  const session = await auth();
  const canManage = session?.user && hasPermission(session.user.role, "manage_employees");

  const payments = await prisma.salaryPayment.findMany({
    where: { periodYear: year, periodMonth: month },
    include: {
      employee: {
        select: {
          id: true,
          name: true,
          employeeCode: true,
          orgRole: { select: { name: true } },
        },
      },
    },
    orderBy: [{ status: "asc" }, { employee: { name: "asc" } }],
  });

  const paidTotal = payments
    .filter((p) => p.status === "PAID")
    .reduce((sum, p) => sum + Number(p.amount), 0);
  const pendingCount = payments.filter((p) => p.status === "PENDING").length;

  return (
    <div>
      <PageHeader
        title="Payroll"
        description={`Salary payments for ${MONTHS[month - 1]} ${year}`}
        actions={
          <>
            <Link href="/hr" className="text-sm text-teal-800 hover:underline">
              HR overview
            </Link>
            <Link href="/employees" className="text-sm text-teal-800 hover:underline">
              Employees
            </Link>
          </>
        }
      />

      <form className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Year</span>
          <input
            name="year"
            type="number"
            min={2020}
            max={2100}
            defaultValue={year}
            className="h-10 w-28 rounded-md border border-slate-300 px-3"
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Month</span>
          <select
            name="month"
            defaultValue={month}
            className="h-10 rounded-md border border-slate-300 bg-white px-3"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="inline-flex h-10 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900"
        >
          View period
        </button>
      </form>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Payments recorded" value={payments.length} />
        <StatCard label="Pending" value={pendingCount} tone={pendingCount ? "warn" : "default"} />
        <StatCard label="Paid total" value={formatCurrency(paidTotal)} tone="success" />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Role</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Paid at</th>
              <th>Remarks</th>
            </tr>
          </thead>
          <tbody>
            {payments.length === 0 ? (
              <tr>
                <td colSpan={6} className="text-slate-500">
                  No salary payments for this period. Record payments on individual employee pages.
                </td>
              </tr>
            ) : (
              payments.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/employees/${p.employee.id}`} className="font-medium text-teal-900 hover:underline">
                      {p.employee.name}
                    </Link>
                    <div className="font-mono text-xs text-slate-500">{p.employee.employeeCode}</div>
                  </td>
                  <td>{p.employee.orgRole?.name ?? "—"}</td>
                  <td className="font-medium">{formatCurrency(p.amount)}</td>
                  <td>
                    <Badge status={p.status} />
                  </td>
                  <td>{p.paidAt ? p.paidAt.toLocaleDateString("en-GB") : "—"}</td>
                  <td>{p.remarks ?? "—"}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      {!canManage ? (
        <p className="mt-4 text-sm text-slate-600">Contact HR or GM to record or update salary payments.</p>
      ) : null}
    </div>
  );
}
