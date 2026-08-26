"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { nextEmployeeCode } from "@/lib/numbering";
import { hasPermission } from "@/lib/rbac";
import { EMPLOYMENT_TYPES, CONTRACTOR_TRADES } from "@/lib/hr";
import { requireOtherDetail } from "@/lib/other-specify";
import type {
  EmployeeStatus,
  EmploymentType,
  ContractorTrade,
} from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const EMPLOYEE_STATUSES: EmployeeStatus[] = ["ACTIVE", "ON_LEAVE", "SUSPENDED", "RESIGNED", "TERMINATED"];

function parseEmployeeForm(formData: FormData) {
  const orgRoleId = String(formData.get("orgRoleId") || "").trim() || null;

  const status = String(formData.get("status") || "ACTIVE");
  if (!EMPLOYEE_STATUSES.includes(status as EmployeeStatus)) {
    throw new Error("Invalid status");
  }

  const employmentType = String(formData.get("employmentType") || "STAFF") as EmploymentType;
  if (!EMPLOYMENT_TYPES.includes(employmentType)) {
    throw new Error("Invalid employment type");
  }

  const contractorTradeRaw = String(formData.get("contractorTrade") || "").trim();
  const contractorTrade =
    contractorTradeRaw && CONTRACTOR_TRADES.includes(contractorTradeRaw as ContractorTrade)
      ? (contractorTradeRaw as ContractorTrade)
      : null;

  const joiningDateRaw = String(formData.get("joiningDate") || "");
  const joiningDate = joiningDateRaw ? new Date(joiningDateRaw) : new Date();
  const salaryRaw = String(formData.get("salary") || "").trim();
  const salary = salaryRaw ? Number(salaryRaw) : null;

  const supervisorId = String(formData.get("supervisorId") || "").trim() || null;
  const contractStartRaw = String(formData.get("contractStart") || "").trim();
  const contractEndRaw = String(formData.get("contractEnd") || "").trim();

  return {
    name: String(formData.get("name") || "").trim(),
    cnic: String(formData.get("cnic") || "").trim(),
    contact: String(formData.get("contact") || "").trim() || null,
    email: String(formData.get("email") || "").trim() || null,
    orgRoleId,
    supervisorId,
    employmentType,
    companyName: String(formData.get("companyName") || "").trim() || null,
    contractStart: contractStartRaw ? new Date(contractStartRaw) : null,
    contractEnd: contractEndRaw ? new Date(contractEndRaw) : null,
    contractorTrade: employmentType === "CONTRACTOR" ? contractorTrade : null,
    department: String(formData.get("department") || "").trim() || null,
    joiningDate,
    salary,
    status: status as EmployeeStatus,
    remarks: String(formData.get("remarks") || "").trim() || null,
    photoPath: String(formData.get("photoPath") || "").trim() || null,
  };
}

async function validateSupervisor(employeeId: string | null, supervisorId: string | null) {
  if (!supervisorId) return;
  if (employeeId && supervisorId === employeeId) {
    throw new Error("Employee cannot be their own supervisor");
  }
  const supervisor = await prisma.employee.findUnique({ where: { id: supervisorId } });
  if (!supervisor) throw new Error("Supervisor not found");
  if (supervisor.status !== "ACTIVE") throw new Error("Supervisor must be an active employee");
}

export async function createEmployee(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "manage_employees")) throw new Error("Forbidden");

  const data = parseEmployeeForm(formData);
  if (!data.name || !data.cnic) throw new Error("Name and CNIC are required");
  if (!data.orgRoleId) throw new Error("Organization role is required");

  await validateSupervisor(null, data.supervisorId);

  const orgRole = await prisma.orgRole.findFirst({
    where: { id: data.orgRoleId, isActive: true },
  });
  if (!orgRole) throw new Error("Invalid organization role");

  const otherDetail =
    orgRole.code === "OTHER"
      ? requireOtherDetail(formData, "OTHER", {
          message: "Please specify the job title when role is Other",
        })
      : null;

  const employeeCode = await nextEmployeeCode();

  const employee = await prisma.employee.create({
    data: {
      employeeCode,
      ...data,
      otherDetail,
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
      orgRoleId: employee.orgRoleId,
      employmentType: employee.employmentType,
      supervisorId: employee.supervisorId,
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
  if (!data.orgRoleId) throw new Error("Organization role is required");

  await validateSupervisor(id, data.supervisorId);

  const orgRole = await prisma.orgRole.findFirst({
    where: { id: data.orgRoleId, isActive: true },
  });
  if (!orgRole) throw new Error("Invalid organization role");

  const otherDetail =
    orgRole.code === "OTHER"
      ? requireOtherDetail(formData, "OTHER", {
          message: "Please specify the job title when role is Other",
        })
      : null;

  const employee = await prisma.employee.update({
    where: { id },
    data: { ...data, otherDetail },
  });

  const salaryChanged =
    existing.salary?.toString() !== employee.salary?.toString() &&
    (existing.salary !== null || employee.salary !== null);

  await writeAuditLog({
    userId: session.user.id,
    action: salaryChanged ? "EMPLOYEE_SALARY_CHANGED" : "EMPLOYEE_UPDATED",
    module: "employees",
    recordId: employee.id,
    oldValue: {
      name: existing.name,
      orgRoleId: existing.orgRoleId,
      status: existing.status,
      department: existing.department,
      supervisorId: existing.supervisorId,
      employmentType: existing.employmentType,
      salary: existing.salary?.toString() ?? null,
    },
    newValue: {
      name: employee.name,
      orgRoleId: employee.orgRoleId,
      status: employee.status,
      department: employee.department,
      supervisorId: employee.supervisorId,
      employmentType: employee.employmentType,
      salary: employee.salary?.toString() ?? null,
    },
  });

  revalidatePath("/employees");
  revalidatePath(`/employees/${id}`);
  revalidatePath("/hr");
  revalidatePath("/attendance");
  redirect(`/employees/${employee.id}`);
}

export async function recordSalaryPayment(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "manage_employees")) throw new Error("Forbidden");

  const employeeId = String(formData.get("employeeId") || "");
  const periodYear = Number(formData.get("periodYear"));
  const periodMonth = Number(formData.get("periodMonth"));
  const amountRaw = String(formData.get("amount") || "").trim();
  const amount = amountRaw ? Number(amountRaw) : NaN;
  const markPaid = formData.get("markPaid") === "on";
  const remarks = String(formData.get("remarks") || "").trim() || null;

  if (!employeeId || !periodYear || !periodMonth || Number.isNaN(amount)) {
    throw new Error("Invalid payment data");
  }

  const employee = await prisma.employee.findUnique({ where: { id: employeeId } });
  if (!employee) throw new Error("Employee not found");

  const existing = await prisma.salaryPayment.findUnique({
    where: {
      employeeId_periodYear_periodMonth: { employeeId, periodYear, periodMonth },
    },
  });

  if (existing) {
    throw new Error(`Payment for ${periodMonth}/${periodYear} already exists — historical records cannot be overwritten`);
  }

  const payment = await prisma.salaryPayment.create({
    data: {
      employeeId,
      periodYear,
      periodMonth,
      amount,
      status: markPaid ? "PAID" : "PENDING",
      paidAt: markPaid ? new Date() : null,
      remarks,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "SALARY_PAYMENT_RECORDED",
    module: "employees",
    recordId: payment.id,
    newValue: {
      employeeId,
      periodYear,
      periodMonth,
      amount: amount.toString(),
      status: payment.status,
    },
  });

  revalidatePath(`/employees/${employeeId}`);
  revalidatePath("/hr/payroll");
}

export async function markSalaryPaymentPaid(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "manage_employees")) throw new Error("Forbidden");

  const paymentId = String(formData.get("paymentId") || "");
  const payment = await prisma.salaryPayment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("Payment not found");
  if (payment.status === "PAID") throw new Error("Payment already marked paid");

  const updated = await prisma.salaryPayment.update({
    where: { id: paymentId },
    data: { status: "PAID", paidAt: new Date() },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "SALARY_PAYMENT_PAID",
    module: "employees",
    recordId: payment.id,
    oldValue: { status: payment.status },
    newValue: { status: updated.status, paidAt: updated.paidAt?.toISOString() },
  });

  revalidatePath(`/employees/${payment.employeeId}`);
  revalidatePath("/hr/payroll");
}
