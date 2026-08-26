import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DesignationBadge } from "@/components/employees/designation-badge";
import {
  ALL_DESIGNATIONS,
  QUICK_FILTER_DESIGNATIONS,
  isManagementDesignation,
} from "@/lib/hr";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import type { Designation, EmployeeStatus } from "@/generated/prisma/client";
import { startOfDay } from "date-fns";

export const dynamic = "force-dynamic";

const STATUSES: EmployeeStatus[] = ["ACTIVE", "ON_LEAVE", "SUSPENDED", "RESIGNED", "TERMINATED"];

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; designation?: string; group?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status?.trim() as EmployeeStatus | undefined;
  const designation = sp.designation?.trim() as Designation | undefined;
  const group = sp.group?.trim();
  const q = sp.q?.trim();
  const today = startOfDay(new Date());

  const session = await auth();
  const canManage = session?.user && hasPermission(session.user.role, "manage_employees");

  const designationFilter =
    designation && ALL_DESIGNATIONS.includes(designation) ? designation : undefined;

  const groupFilter =
    group === "management"
      ? { designation: { in: ALL_DESIGNATIONS.filter((d) => isManagementDesignation(d)) } }
      : group === "operational"
        ? { designation: { in: ALL_DESIGNATIONS.filter((d) => !isManagementDesignation(d)) } }
        : {};

  const employees = await prisma.employee.findMany({
    where: {
      ...(status && STATUSES.includes(status) ? { status } : {}),
      ...(designationFilter ? { designation: designationFilter } : {}),
      ...groupFilter,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { employeeCode: { contains: q, mode: "insensitive" } },
              { cnic: { contains: q } },
              { department: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    take: 200,
  });

  const [designationCounts, presentToday, absentToday, onLeaveToday] = await Promise.all([
    prisma.employee.groupBy({
      by: ["designation"],
      where: { status: "ACTIVE" },
      _count: { _all: true },
    }),
    prisma.attendance.count({ where: { date: today, status: "PRESENT" } }),
    prisma.attendance.count({ where: { date: today, status: "ABSENT" } }),
    prisma.attendance.count({ where: { date: today, status: "LEAVE" } }),
  ]);

  const countMap = new Map(designationCounts.map((d) => [d.designation, d._count._all]));

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Society staff register — management and operational roles including cooks, drivers, guards, and support staff."
        actions={
          <>
            <Link href="/hr" className="text-sm text-teal-800 hover:underline">
              HR summary
            </Link>
            {canManage ? (
              <Link href="/employees/new">
                <Button type="button">Add Staff</Button>
              </Link>
            ) : null}
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Present Today" value={presentToday} tone="success" />
        <StatCard label="Absent Today" value={absentToday} tone={absentToday ? "warn" : "default"} />
        <StatCard label="On Leave Today" value={onLeaveToday} />
        <StatCard
          label="Active Staff"
          value={designationCounts.reduce((n, d) => n + d._count._all, 0)}
        />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/employees"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            !group && !designationFilter ? "border-teal-800 bg-teal-800 text-white" : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          All
        </Link>
        <Link
          href="/employees?group=management"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            group === "management" ? "border-indigo-700 bg-indigo-700 text-white" : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          Management
        </Link>
        <Link
          href="/employees?group=operational"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            group === "operational" ? "border-lime-700 bg-lime-700 text-white" : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          Operational
        </Link>
        {QUICK_FILTER_DESIGNATIONS.map((d) => (
          <Link
            key={d}
            href={`/employees?designation=${d}`}
            className={`rounded-full border px-3 py-1 text-xs font-medium ${
              designationFilter === d ? "border-teal-800 bg-teal-800 text-white" : "border-slate-300 bg-white text-slate-700"
            }`}
          >
            {labelize(d)}
            {countMap.get(d) ? ` (${countMap.get(d)})` : ""}
          </Link>
        ))}
      </div>

      <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <input
          name="q"
          placeholder="Search name, code, CNIC…"
          defaultValue={q}
          className="flex h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <select
          name="designation"
          defaultValue={designationFilter ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All designations</option>
          {ALL_DESIGNATIONS.map((d) => (
            <option key={d} value={d}>
              {labelize(d)}
            </option>
          ))}
        </select>
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
        {group ? <input type="hidden" name="group" value={group} /> : null}
        <Button type="submit">Filter</Button>
      </form>

      {employees.length === 0 ? (
        <EmptyState title="No employees found" description="Try adjusting your filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>CNIC</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Joined</th>
                <th>Salary</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="font-mono text-sm">
                    <Link href={`/employees/${e.id}`} className="text-teal-900 hover:underline">
                      {e.employeeCode}
                    </Link>
                  </td>
                  <td className="font-medium">
                    <Link href={`/employees/${e.id}`} className="hover:text-teal-900 hover:underline">
                      {e.name}
                    </Link>
                  </td>
                  <td>{e.cnic}</td>
                  <td>
                    <DesignationBadge designation={e.designation} />
                  </td>
                  <td>{e.department ?? "—"}</td>
                  <td>{formatDate(e.joiningDate)}</td>
                  <td>{e.salary ? formatCurrency(e.salary) : "—"}</td>
                  <td>
                    <Badge status={e.status} />
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
