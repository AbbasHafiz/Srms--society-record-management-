import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/employees/designation-badge";
import { EmploymentTypeBadge } from "@/components/employees/employment-type-badge";
import {
  EMPLOYMENT_TYPES,
  ORG_ROLE_CATEGORIES,
  isManagementCategory,
} from "@/lib/hr";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import type { EmployeeStatus, EmploymentType, OrgRoleCategory } from "@/generated/prisma/client";
import { startOfDay } from "date-fns";
import { excelExportHref } from "@/lib/excel";
import { ExcelToolbar } from "@/components/excel/excel-toolbar";
import { previewEmployeesExcelAction, commitEmployeesExcelAction } from "./excel-actions";

export const dynamic = "force-dynamic";

const STATUSES: EmployeeStatus[] = ["ACTIVE", "ON_LEAVE", "SUSPENDED", "RESIGNED", "TERMINATED"];

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    orgRoleId?: string;
    employmentType?: string;
    category?: string;
    group?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const status = sp.status?.trim() as EmployeeStatus | undefined;
  const orgRoleId = sp.orgRoleId?.trim();
  const employmentType = sp.employmentType?.trim() as EmploymentType | undefined;
  const category = sp.category?.trim() as OrgRoleCategory | undefined;
  const group = sp.group?.trim();
  const q = sp.q?.trim();
  const today = startOfDay(new Date());

  const session = await auth();
  const canManage = session?.user && hasPermission(session.user.role, "manage_employees");

  const categoryFilter =
    category && ORG_ROLE_CATEGORIES.includes(category)
      ? { orgRole: { category } }
      : group === "management"
        ? { orgRole: { category: { in: ["PANEL", "MANAGEMENT"] as OrgRoleCategory[] } } }
        : group === "operational"
          ? { orgRole: { category: { in: ["OPERATIONAL", "TECHNICAL"] as OrgRoleCategory[] } } }
          : group === "contractors"
            ? { employmentType: "CONTRACTOR" as EmploymentType }
            : group === "panel"
              ? { employmentType: "PANEL_MEMBER" as EmploymentType }
              : {};

  const employees = await prisma.employee.findMany({
    where: {
      ...(status && STATUSES.includes(status) ? { status } : {}),
      ...(orgRoleId ? { orgRoleId } : {}),
      ...(employmentType && EMPLOYMENT_TYPES.includes(employmentType) ? { employmentType } : {}),
      ...categoryFilter,
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { employeeCode: { contains: q, mode: "insensitive" } },
              { cnic: { contains: q } },
              { department: { contains: q, mode: "insensitive" } },
              { companyName: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      orgRole: true,
      supervisor: { select: { name: true, employeeCode: true } },
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    take: 200,
  });

  const [orgRoles, roleCounts, presentToday, absentToday, onLeaveToday, contractorCount] = await Promise.all([
    prisma.orgRole.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    prisma.employee.groupBy({
      by: ["orgRoleId"],
      where: { status: "ACTIVE", orgRoleId: { not: null } },
      _count: { _all: true },
    }),
    prisma.attendance.count({ where: { date: today, status: "PRESENT" } }),
    prisma.attendance.count({ where: { date: today, status: "ABSENT" } }),
    prisma.attendance.count({ where: { date: today, status: "LEAVE" } }),
    prisma.employee.count({ where: { status: "ACTIVE", employmentType: "CONTRACTOR" } }),
  ]);

  const countMap = new Map(roleCounts.map((d) => [d.orgRoleId, d._count._all]));
  const activeStaff = roleCounts.reduce((n, d) => n + d._count._all, 0);

  return (
    <div>
      <PageHeader
        title="Employees"
        description="Society staff register — panel, management, operational staff, and contractors."
        actions={
          <>
            <ExcelToolbar
              exportHref={excelExportHref("employees", {
                q,
                status,
                orgRoleId,
                employmentType,
                category,
                group,
              })}
              templateHref={excelExportHref("employees", {}, { template: true })}
              canImport={Boolean(canManage)}
              importTitle="Import staff"
              importDescription="Bulk-add panel, staff, or contractors. An existing CNIC is rejected — current staff records are not overwritten."
              previewAction={previewEmployeesExcelAction}
              commitAction={commitEmployeesExcelAction}
            />
            <Link href="/hr" className="text-sm text-teal-800 hover:underline">
              HR summary
            </Link>
            <Link href="/hr/payroll" className="text-sm text-teal-800 hover:underline">
              Payroll
            </Link>
            <Link href="/settings/roles" className="text-sm text-teal-800 hover:underline">
              Roles
            </Link>
            {canManage ? (
              <Link href="/employees/new">
                <Button type="button">Add Staff</Button>
              </Link>
            ) : null}
          </>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard label="Present Today" value={presentToday} tone="success" />
        <StatCard label="Absent Today" value={absentToday} tone={absentToday ? "warn" : "default"} />
        <StatCard label="On Leave Today" value={onLeaveToday} />
        <StatCard label="Active Staff" value={activeStaff} />
        <StatCard label="Contractors" value={contractorCount} tone={contractorCount ? "warn" : "default"} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href="/employees"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            !group && !orgRoleId && !employmentType ? "border-teal-800 bg-teal-800 text-white" : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          All
        </Link>
        <Link
          href="/employees?group=panel"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            group === "panel" ? "border-purple-700 bg-purple-700 text-white" : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          Panel
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
        <Link
          href="/employees?group=contractors"
          className={`rounded-full border px-3 py-1 text-xs font-medium ${
            group === "contractors" ? "border-orange-700 bg-orange-700 text-white" : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          Contractors
        </Link>
        {orgRoles
          .filter((r) => (countMap.get(r.id) ?? 0) > 0 && !isManagementCategory(r.category))
          .slice(0, 8)
          .map((r) => (
            <Link
              key={r.id}
              href={`/employees?orgRoleId=${r.id}`}
              className={`rounded-full border px-3 py-1 text-xs font-medium ${
                orgRoleId === r.id ? "border-teal-800 bg-teal-800 text-white" : "border-slate-300 bg-white text-slate-700"
              }`}
            >
              {r.name}
              {countMap.get(r.id) ? ` (${countMap.get(r.id)})` : ""}
            </Link>
          ))}
      </div>

      <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <input
          name="q"
          placeholder="Search name, code, CNIC, company…"
          defaultValue={q}
          className="flex h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <select
          name="orgRoleId"
          defaultValue={orgRoleId ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All roles</option>
          {orgRoles.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
        <select
          name="employmentType"
          defaultValue={employmentType ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All types</option>
          {EMPLOYMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {labelize(t)}
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
                <th>Role</th>
                <th>Type</th>
                <th>Supervisor</th>
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
                  <td>
                    <RoleBadge orgRole={e.orgRole} designation={e.designation} />
                  </td>
                  <td>
                    <EmploymentTypeBadge type={e.employmentType} />
                  </td>
                  <td className="text-sm text-slate-600">
                    {e.supervisor ? `${e.supervisor.name}` : "—"}
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
