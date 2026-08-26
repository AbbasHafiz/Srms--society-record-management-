import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page";
import { RoleBadge } from "@/components/employees/designation-badge";
import { EmploymentTypeBadge } from "@/components/employees/employment-type-badge";
import { Badge } from "@/components/ui/badge";
import { EmployeeForm } from "@/components/employees/employee-form";
import { SalarySection } from "@/components/employees/salary-section";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { updateEmployee } from "../actions";
import type { EmploymentType } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const canManage = session?.user && hasPermission(session.user.role, "manage_employees");

  const employee = await prisma.employee.findUnique({
    where: { id },
    include: {
      orgRole: true,
      supervisor: { select: { id: true, name: true, employeeCode: true, orgRole: { select: { name: true } } } },
      directReports: {
        where: { status: "ACTIVE" },
        orderBy: { name: "asc" },
        select: { id: true, name: true, employeeCode: true, orgRole: { select: { name: true } } },
      },
      salaryPayments: { orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }], take: 24 },
    },
  });
  if (!employee) notFound();

  const [orgRoles, supervisors] = await Promise.all([
    prisma.orgRole.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true, code: true },
    }),
    prisma.employee.findMany({
      where: { status: "ACTIVE", id: { not: id } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, employeeCode: true },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title={employee.name}
        description={`${employee.employeeCode} · joined ${formatDate(employee.joiningDate)}`}
        actions={
          <Link href="/employees" className="text-sm text-teal-800 hover:underline">
            Back to employees
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <RoleBadge orgRole={employee.orgRole} designation={employee.designation} />
        <EmploymentTypeBadge type={employee.employmentType as EmploymentType} />
        <Badge status={employee.status} />
        {employee.department ? <span className="text-sm text-slate-600">{employee.department}</span> : null}
        {employee.salary ? (
          <span className="text-sm text-slate-600">{formatCurrency(employee.salary)} / month (current rate)</span>
        ) : null}
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Reports to</h3>
          {employee.supervisor ? (
            <Link href={`/employees/${employee.supervisor.id}`} className="mt-1 block font-medium text-teal-900 hover:underline">
              {employee.supervisor.name}
              <span className="ml-1 font-mono text-sm text-slate-500">({employee.supervisor.employeeCode})</span>
            </Link>
          ) : (
            <p className="mt-1 text-sm text-slate-600">Top-level — no supervisor assigned</p>
          )}
          {employee.supervisor?.orgRole ? (
            <p className="text-xs text-slate-500">{employee.supervisor.orgRole.name}</p>
          ) : null}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500">Direct reports</h3>
          {employee.directReports.length === 0 ? (
            <p className="mt-1 text-sm text-slate-600">None</p>
          ) : (
            <ul className="mt-2 space-y-1">
              {employee.directReports.map((r) => (
                <li key={r.id}>
                  <Link href={`/employees/${r.id}`} className="text-sm text-teal-900 hover:underline">
                    {r.name}
                    <span className="ml-1 font-mono text-xs text-slate-500">{r.employeeCode}</span>
                    {r.orgRole ? <span className="ml-1 text-xs text-slate-400">· {r.orgRole.name}</span> : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {employee.employmentType === "CONTRACTOR" ? (
        <div className="mb-6 rounded-xl border border-orange-200 bg-orange-50/40 p-4 text-sm">
          <h3 className="font-medium text-orange-900">Contractor details</h3>
          <dl className="mt-2 grid gap-2 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-slate-500">Company</dt>
              <dd>{employee.companyName ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Trade</dt>
              <dd>{employee.contractorTrade ? labelize(employee.contractorTrade) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Contract period</dt>
              <dd>
                {employee.contractStart ? formatDate(employee.contractStart) : "—"}
                {employee.contractEnd ? ` → ${formatDate(employee.contractEnd)}` : ""}
              </dd>
            </div>
          </dl>
        </div>
      ) : null}

      {canManage ? (
        <EmployeeForm
          action={updateEmployee}
          orgRoles={orgRoles}
          supervisors={supervisors}
          employee={employee}
          submitLabel="Save changes"
        />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm">
          <p>Contact HR or GM to update this record.</p>
          <dl className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs uppercase text-slate-500">CNIC</dt>
              <dd className="font-mono">{employee.cnic}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Contact</dt>
              <dd>{employee.contact ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Email</dt>
              <dd>{employee.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs uppercase text-slate-500">Remarks</dt>
              <dd>{employee.remarks ?? "—"}</dd>
            </div>
          </dl>
        </div>
      )}

      <SalarySection
        employeeId={employee.id}
        currentSalary={employee.salary}
        payments={employee.salaryPayments}
        canManage={!!canManage}
      />
    </div>
  );
}
