"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { nextEmployeeCode } from "@/lib/numbering";
import { hasPermission } from "@/lib/rbac";
import { ALL_DESIGNATIONS } from "@/lib/hr";
import type { Designation, EmployeeStatus } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const EMPLOYEE_STATUSES: EmployeeStatus[] = ["ACTIVE", "ON_LEAVE", "SUSPENDED", "RESIGNED", "TERMINATED"];

function parseEmployeeForm(formData: FormData) {
  const designation = String(formData.get("designation") || "");
  if (!ALL_DESIGNATIONS.includes(designation as Designation)) {
    throw new Error("Invalid designation");
  }

  const status = String(formData.get("status") || "ACTIVE");
  if (!EMPLOYEE_STATUSES.includes(status as EmployeeStatus)) {
    throw new Error("Invalid status");
  }

  const joiningDateRaw = String(formData.get("joiningDate") || "");
  const joiningDate = joiningDateRaw ? new Date(joiningDateRaw) : new Date();
  const salaryRaw = String(formData.get("salary") || "").trim();
  const salary = salaryRaw ? Number(salaryRaw) : null;

  return {
    name: String(formData.get("name") || "").trim(),
    cnic: String(formData.get("cnic") || "").trim(),
    contact: String(formData.get("contact") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null,
    designation: designation as Designation,
    department: String(formData.get("department") || "").trim() || null,
    joiningDate,
    salary,
    status: status as EmployeeStatus,
    remarks: String(formData.get("remarks") || "").trim() || null,
    photoPath: String(formData.get("photoPath") || "").trim() || null,
  };
}

export async function createEmployee(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "manage_employees")) throw new Error("Forbidden");

  const data = parseEmployeeForm(formData);
  if (!data.name || !data.cnic) throw new Error("Name and CNIC are required");

  const employeeCode = await nextEmployeeCode();

  const employee = await prisma.employee.create({
    data: {
      employeeCode,
      ...data,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "EMPLOYEE_CREATED",
    module: "employees",
    recordId: employee.id,
    newValue: {
      employeeCode: employee.employeeCode,
      name: employee.name,
      designation: employee.designation,
      department: employee.department,
    },
  });

  revalidatePath("/employees");
  revalidatePath("/hr");
  revalidatePath("/attendance");
  redirect(`/employees/${employee.id}`);
}

export async function updateEmployee(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "manage_employees")) throw new Error("Forbidden");

  const id = String(formData.get("id") || "");
  const existing = await prisma.employee.findUnique({ where: { id } });
  if (!existing) throw new Error("Employee not found");

  const data = parseEmployeeForm(formData);
  if (!data.name || !data.cnic) throw new Error("Name and CNIC are required");

  const employee = await prisma.employee.update({
    where: { id },
    data,
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "EMPLOYEE_UPDATED",
    module: "employees",
    recordId: employee.id,
    oldValue: {
      name: existing.name,
      designation: existing.designation,
      status: existing.status,
      department: existing.department,
    },
    newValue: {
      name: employee.name,
      designation: employee.designation,
      status: employee.status,
      department: employee.department,
    },
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  revalidatePath("/hr");
  revalidatePath("/attendance");
  redirect(`/employees/${employee.id}`);
}
