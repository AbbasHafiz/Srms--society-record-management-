import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard } from "@/components/ui/page";
import { DesignationBadge } from "@/components/employees/designation-badge";
import { QUICK_FILTER_DESIGNATIONS } from "@/lib/hr";
import { labelize } from "@/lib/utils";
import { startOfDay } from "date-fns";

export const dynamic = "force-dynamic";

export default async function HrPage() {
  const today = startOfDay(new Date());

  const [designationCounts, presentToday, absentToday, onLeaveToday, lateToday, activeCount] =
    await Promise.all([
      prisma.employee.groupBy({
        by: ["designation"],
        where: { status: "ACTIVE" },
        _count: { _all: true },
        orderBy: { designation: "asc" },
      }),
      prisma.attendance.count({ where: { date: today, status: "PRESENT" } }),
      prisma.attendance.count({ where: { date: today, status: "ABSENT" } }),
      prisma.attendance.count({ where: { date: today, status: "LEAVE" } }),
      prisma.attendance.count({ where: { date: today, status: "LATE" } }),
      prisma.employee.count({ where: { status: "ACTIVE" } }),
    ]);

  const operationalHighlights = QUICK_FILTER_DESIGNATIONS.map((d) => {
    const row = designationCounts.find((c) => c.designation === d);
    return { designation: d, count: row?._count._all ?? 0 };
  }).filter((r) => r.count > 0);

  return (
    <div>
      <PageHeader
        title="HR Overview"
        description="Staff headcount by role and today&apos;s attendance snapshot."
        actions={
          <>
            <Link href="/employees/new" className="text-sm text-teal-800 hover:underline">
              Add staff
            </Link>
            <Link href="/employees" className="text-sm text-teal-800 hover:underline">
              Full register
            </Link>
            <Link href="/attendance" className="text-sm text-teal-800 hover:underline">
              Mark attendance
            </Link>
          </>
        }
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Active Staff" value={activeCount} />
        <StatCard label="Present Today" value={presentToday} tone="success" />
        <StatCard label="Absent" value={absentToday} tone={absentToday ? "warn" : "default"} />
        <StatCard label="On Leave" value={onLeaveToday} />
        <StatCard label="Late" value={lateToday} tone={lateToday ? "warn" : "default"} />
      </div>

      {operationalHighlights.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg font-semibold">Operational Staff</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {operationalHighlights.map((r) => (
              <Link
                key={r.designation}
                href={`/employees?designation=${r.designation}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-300"
              >
                <DesignationBadge designation={r.designation} />
                <p className="mt-2 font-display text-2xl font-semibold text-slate-900">{r.count}</p>
                <p className="text-xs text-slate-500">active {labelize(r.designation).toLowerCase()} staff</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Headcount by Designation</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Designation</th>
              <th>Active count</th>
              <th>Filter</th>
            </tr>
          </thead>
          <tbody>
            {designationCounts.map((row) => (
              <tr key={row.designation}>
                <td>
                  <DesignationBadge designation={row.designation} />
                </td>
                <td className="font-medium">{row._count._all}</td>
                <td>
                  <Link
                    href={`/employees?designation=${row.designation}`}
                    className="text-sm text-teal-800 hover:underline"
                  >
                    View list
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
