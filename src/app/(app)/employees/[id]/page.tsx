import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page";
import { DesignationBadge } from "@/components/employees/designation-badge";
import { Badge } from "@/components/ui/badge";
import { EmployeeForm } from "@/components/employees/employee-form";
import { formatCurrency, formatDate } from "@/lib/utils";
import { updateEmployee } from "../actions";

export const dynamic = "force-dynamic";

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const canManage = session?.user && hasPermission(session.user.role, "manage_employees");

  const employee = await prisma.employee.findUnique({ where: { id } });
  if (!employee) notFound();

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
        <DesignationBadge designation={employee.designation} />
        <Badge status={employee.status} />
        {employee.department ? (
          <span className="text-sm text-slate-600">{employee.department}</span>
        ) : null}
        {employee.salary ? (
          <span className="text-sm text-slate-600">{formatCurrency(employee.salary)} / month</span>
        ) : null}
      </div>

      {canManage ? (
        <EmployeeForm action={updateEmployee} employee={employee} submitLabel="Save changes" />
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
    </div>
  );
}
