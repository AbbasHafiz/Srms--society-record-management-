import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PageHeader, StatCard } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { labelize } from "@/lib/utils";
import { startOfMonth, endOfMonth } from "date-fns";

export const dynamic = "force-dynamic";

export default async function AttendanceReportPage({
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

  const [records, activeStaff] = await Promise.all([
    prisma.attendance.findMany({
      where: { date: { gte: from, lte: to } },
      include: { employee: { include: { orgRole: true } } },
    }),
    prisma.employee.count({ where: { status: "ACTIVE" } }),
  ]);

  const byEmployee = new Map<
    string,
    { name: string; code: string; role: string; present: number; absent: number; leave: number }
  >();

  for (const r of records) {
    const key = r.employeeId;
    const entry = byEmployee.get(key) ?? {
      name: r.employee.name,
      code: r.employee.employeeCode,
      role: r.employee.orgRole?.name ?? r.employee.designation ?? "—",
      present: 0,
      absent: 0,
      leave: 0,
    };
    if (r.status === "PRESENT" || r.status === "LATE" || r.status === "HALF_DAY") entry.present++;
    else if (r.status === "ABSENT") entry.absent++;
    else if (r.status === "LEAVE") entry.leave++;
    byEmployee.set(key, entry);
  }

  const rows = [...byEmployee.values()].sort((a, b) => a.name.localeCompare(b.name));
  const totalPresent = rows.reduce((s, r) => s + r.present, 0);
  const totalAbsent = rows.reduce((s, r) => s + r.absent, 0);

  const exportParams = new URLSearchParams({ report: "attendance", month: monthStr });

  return (
    <div>
      <PageHeader
        title="Attendance Summary"
        description={`Monthly attendance rollup for ${monthStr}.`}
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
        <StatCard label="Active Staff" value={activeStaff} />
        <StatCard label="Staff with records" value={rows.length} />
        <StatCard label="Total present days" value={totalPresent} tone="success" />
        <StatCard label="Total absent days" value={totalAbsent} tone={totalAbsent ? "warn" : "default"} />
      </div>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="data-table">
          <thead>
            <tr>
              <th>Employee</th>
              <th>Role</th>
              <th>Present</th>
              <th>Absent</th>
              <th>Leave</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-slate-500">No attendance records for this month.</td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.code}>
                  <td>
                    <div className="font-medium">{r.name}</div>
                    <div className="text-xs text-slate-500">{r.code}</div>
                  </td>
                  <td>{labelize(r.role)}</td>
                  <td>{r.present}</td>
                  <td>{r.absent}</td>
                  <td>{r.leave}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
