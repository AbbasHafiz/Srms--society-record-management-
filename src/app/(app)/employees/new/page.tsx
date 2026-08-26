import Link from "next/link";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page";
import { EmployeeForm } from "@/components/employees/employee-form";
import { createEmployee } from "../actions";

export const dynamic = "force-dynamic";

export default async function NewEmployeePage() {
  const session = await auth();
  const canManage = session?.user && hasPermission(session.user.role, "manage_employees");

  if (!canManage) {
    return (
      <div>
        <PageHeader title="Add Staff" description="You do not have permission to create employees." />
        <Link href="/employees" className="text-sm text-teal-800 hover:underline">Back to employees</Link>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Add Staff"
        description="Register operational or management staff — cook, driver, guard, mali, sweeper, computer operator, etc."
        actions={
          <Link href="/employees" className="text-sm text-teal-800 hover:underline">
            Back to employees
          </Link>
        }
      />
      <EmployeeForm action={createEmployee} submitLabel="Create staff member" />
    </div>
  );
}
