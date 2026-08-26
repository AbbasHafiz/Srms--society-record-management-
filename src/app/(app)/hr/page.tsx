import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, StatCard } from "@/components/ui/page";
import { RoleBadge } from "@/components/employees/designation-badge";
import { EmploymentTypeBadge } from "@/components/employees/employment-type-badge";
import { ORG_ROLE_CATEGORIES, isManagementCategory } from "@/lib/hr";
import { labelize } from "@/lib/utils";
import { startOfDay } from "date-fns";

export const dynamic = "force-dynamic";

export default async function HrPage() {
  const today = startOfDay(new Date());

  const [roleCounts, orgRoles, presentToday, absentToday, onLeaveToday, lateToday, activeCount, contractors, hierarchyRoots] =
    await Promise.all([
      prisma.employee.groupBy({
        by: ["orgRoleId"],
        where: { status: "ACTIVE", orgRoleId: { not: null } },
        _count: { _all: true },
      }),
      prisma.orgRole.findMany({
        where: { isActive: true },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
      }),
      prisma.attendance.count({ where: { date: today, status: "PRESENT" } }),
      prisma.attendance.count({ where: { date: today, status: "ABSENT" } }),
      prisma.attendance.count({ where: { date: today, status: "LEAVE" } }),
      prisma.attendance.count({ where: { date: today, status: "LATE" } }),
      prisma.employee.count({ where: { status: "ACTIVE" } }),
      prisma.employee.count({ where: { status: "ACTIVE", employmentType: "CONTRACTOR" } }),
      prisma.employee.findMany({
        where: { status: "ACTIVE", supervisorId: null },
        include: {
          orgRole: true,
          directReports: {
            where: { status: "ACTIVE" },
            include: { orgRole: true },
            orderBy: { name: "asc" },
          },
        },
        orderBy: { name: "asc" },
        take: 20,
      }),
    ]);

  const countByRoleId = new Map(roleCounts.map((r) => [r.orgRoleId, r._count._all]));

  const headcountByCategory = ORG_ROLE_CATEGORIES.map((cat) => {
    const roles = orgRoles.filter((r) => r.category === cat);
    const count = roles.reduce((n, r) => n + (countByRoleId.get(r.id) ?? 0), 0);
    return { category: cat, count, roles };
  }).filter((c) => c.count > 0);

  return (
    <div>
      <PageHeader
        title="HR Overview"
        description="Staff headcount by role, reporting hierarchy, and today&apos;s attendance snapshot."
        actions={
          <>
            <Link href="/employees/new" className="text-sm text-teal-800 hover:underline">
              Add staff
            </Link>
            <Link href="/employees" className="text-sm text-teal-800 hover:underline">
              Full register
            </Link>
            <Link href="/hr/payroll" className="text-sm text-teal-800 hover:underline">
              Payroll
            </Link>
            <Link href="/settings/roles" className="text-sm text-teal-800 hover:underline">
              Manage roles
            </Link>
            <Link href="/attendance" className="text-sm text-teal-800 hover:underline">
              Mark attendance
            </Link>
          </>
        }
      />

      <div className="mb-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <StatCard label="Active Staff" value={activeCount} />
        <StatCard label="Contractors" value={contractors} />
        <StatCard label="Present Today" value={presentToday} tone="success" />
        <StatCard label="Absent" value={absentToday} tone={absentToday ? "warn" : "default"} />
        <StatCard label="On Leave" value={onLeaveToday} />
        <StatCard label="Late" value={lateToday} tone={lateToday ? "warn" : "default"} />
      </div>

      {headcountByCategory.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 font-display text-lg font-semibold">Headcount by Category</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {headcountByCategory.map((c) => (
              <Link
                key={c.category}
                href={`/employees?category=${c.category}`}
                className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-teal-300"
              >
                <p className="text-sm font-medium text-slate-700">{labelize(c.category)}</p>
                <p className="mt-1 font-display text-2xl font-semibold text-slate-900">{c.count}</p>
                <p className="text-xs text-slate-500">{c.roles.length} role types</p>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Reporting Hierarchy (top level)</h2>
          <p className="mt-1 text-sm text-slate-600">Staff without a supervisor — expand via employee detail pages.</p>
        </div>
        <ul className="divide-y divide-slate-100 px-5 py-2">
          {hierarchyRoots.length === 0 ? (
            <li className="py-4 text-sm text-slate-500">No active staff.</li>
          ) : (
            hierarchyRoots.map((root) => (
              <li key={root.id} className="py-3">
                <Link href={`/employees/${root.id}`} className="font-medium text-teal-900 hover:underline">
                  {root.name}
                  <span className="ml-2 font-mono text-xs text-slate-500">{root.employeeCode}</span>
                </Link>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <RoleBadge orgRole={root.orgRole} designation={root.designation} />
                  {root.directReports.length > 0 ? (
                    <span className="text-xs text-slate-500">{root.directReports.length} direct report(s)</span>
                  ) : null}
                </div>
                {root.directReports.length > 0 ? (
                  <ul className="ml-4 mt-2 space-y-1 border-l border-slate-200 pl-3">
                    {root.directReports.map((rep) => (
                      <li key={rep.id}>
                        <Link href={`/employees/${rep.id}`} className="text-sm text-slate-700 hover:text-teal-900 hover:underline">
                          {rep.name}
                          {rep.orgRole ? (
                            <span className="ml-1 text-xs text-slate-400">· {rep.orgRole.name}</span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Headcount by Role</h2>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>Role</th>
              <th>Category</th>
              <th>Active count</th>
              <th>Filter</th>
            </tr>
          </thead>
          <tbody>
            {orgRoles
              .filter((r) => (countByRoleId.get(r.id) ?? 0) > 0)
              .map((role) => (
                <tr key={role.id}>
                  <td className="font-medium">{role.name}</td>
                  <td>{labelize(role.category)}</td>
                  <td>{countByRoleId.get(role.id) ?? 0}</td>
                  <td>
                    <Link href={`/employees?orgRoleId=${role.id}`} className="text-sm text-teal-800 hover:underline">
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
