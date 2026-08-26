import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page";
import { EmployeeForm } from "@/components/employees/employee-form";
import { createEmployee } from "../actions";

export const dynamic = "force-dynamic";

async function loadFormData() {
  const [orgRoles, supervisors] = await Promise.all([
    prisma.orgRole.findMany({
      where: { isActive: true },
      orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, category: true, code: true },
    }),
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      orderBy: { name: "asc" },
      select: { id: true, name: true, employeeCode: true },
    }),
  ]);
  return { orgRoles, supervisors };
}

export default async function NewEmployeePage() {
  const session = await auth();
  const canManage = session?.user && hasPermission(session.user.role, "manage_employees");

  if (!canManage) {
    return (
      <div>
        <PageHeader title="Add Staff" description="You do not have permission to create employees." />
        <Link href="/employees" className="text-sm text-teal-800 hover:underline">
          Back to employees
        </Link>
      </div>
    );
  }

  const { orgRoles, supervisors } = await loadFormData();

  return (
    <div>
      <PageHeader
        title="Add Staff"
        description="Register panel members, staff, or contractors with organization role and reporting hierarchy."
        actions={
          <Link href="/employees" className="text-sm text-teal-800 hover:underline">
            Back to employees
          </Link>
        }
      />
      {orgRoles.length === 0 ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          No organization roles found. Run{" "}
          <code className="rounded bg-amber-100 px-1">npx tsx prisma/seed-org-roles.ts</code> or seed the database.
        </p>
      ) : (
        <EmployeeForm
          action={createEmployee}
          orgRoles={orgRoles}
          supervisors={supervisors}
          submitLabel="Create staff member"
        />
      )}
    </div>
  );
}
