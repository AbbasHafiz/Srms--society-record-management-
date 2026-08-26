"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/rbac";
import { isSecurityGuardEmployee } from "@/lib/hr";
import type { AttendanceStatus, ShiftType } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { startOfDay } from "date-fns";

const ATTENDANCE_STATUSES: AttendanceStatus[] = ["PRESENT", "ABSENT", "LEAVE", "HALF_DAY", "LATE"];

function todayDate() {
  return startOfDay(new Date());
}

export async function markAttendance(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "mark_attendance")) throw new Error("Forbidden");

  const employeeId = String(formData.get("employeeId") || "");
  const status = String(formData.get("status") || "PRESENT") as AttendanceStatus;
  if (!ATTENDANCE_STATUSES.includes(status)) throw new Error("Invalid status");

  const shift = (String(formData.get("shift") || "GENERAL") as ShiftType) || "GENERAL";
  const notes = String(formData.get("notes") || "").trim() || null;
  const date = todayDate();

  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
    include: { orgRole: { select: { code: true } } },
  });
  if (!employee) throw new Error("Employee not found");

  const defaultShift: ShiftType = isSecurityGuardEmployee(employee)
    ? shift === "GENERAL"
      ? "DAY"
      : shift
    : "GENERAL";

  const existing = await prisma.attendance.findUnique({
    where: { employeeId_date: { employeeId, date } },
  });

  const checkIn =
    status === "PRESENT" || status === "LATE" || status === "HALF_DAY"
      ? (existing?.checkIn ?? new Date())
      : null;

  const attendance = await prisma.attendance.upsert({
    where: { employeeId_date: { employeeId, date } },
    create: {
      employeeId,
      date,
      status,
      shift: defaultShift,
      checkIn,
      notes,
      markedById: session.user.id,
    },
    update: {
      status,
      shift: defaultShift,
      checkIn,
      notes,
      markedById: session.user.id,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: existing ? "ATTENDANCE_UPDATED" : "ATTENDANCE_MARKED",
    module: "attendance",
    recordId: attendance.id,
    oldValue: existing ? { status: existing.status } : undefined,
    newValue: { employeeId, employeeCode: employee.employeeCode, status },
  });

  revalidatePath("/attendance");
  revalidatePath("/hr");
  revalidatePath("/employees");
}

export async function bulkMarkAttendance(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "mark_attendance")) throw new Error("Forbidden");

  const status = String(formData.get("status") || "PRESENT") as AttendanceStatus;
  if (!ATTENDANCE_STATUSES.includes(status)) throw new Error("Invalid status");

  const orgRoleId = String(formData.get("orgRoleId") || "").trim() || undefined;
  const department = String(formData.get("department") || "").trim();
  const date = todayDate();
  const now = new Date();

  const employees = await prisma.employee.findMany({
    where: {
      status: "ACTIVE",
      ...(orgRoleId ? { orgRoleId } : {}),
      ...(department ? { department: { equals: department, mode: "insensitive" } } : {}),
    },
    include: { orgRole: { select: { code: true } } },
  });

  if (employees.length === 0) throw new Error("No matching active employees");

  await prisma.$transaction(
    employees.map((emp) =>
      prisma.attendance.upsert({
        where: { employeeId_date: { employeeId: emp.id, date } },
        create: {
          employeeId: emp.id,
          date,
          status,
          shift: isSecurityGuardEmployee(emp) ? "DAY" : "GENERAL",
          checkIn: status === "PRESENT" || status === "LATE" || status === "HALF_DAY" ? now : null,
          markedById: session.user.id,
        },
        update: {
          status,
          checkIn: status === "PRESENT" || status === "LATE" || status === "HALF_DAY" ? now : null,
          markedById: session.user.id,
        },
      })
    )
  );

  await writeAuditLog({
    userId: session.user.id,
    action: "ATTENDANCE_BULK_MARKED",
    module: "attendance",
    newValue: {
      status,
      orgRoleId: orgRoleId ?? "all",
      department: department || "all",
      count: employees.length,
    },
  });

  revalidatePath("/attendance");
  revalidatePath("/hr");
  revalidatePath("/employees");
}

export async function createGuardShift(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "mark_attendance")) throw new Error("Forbidden");

  const employeeId = String(formData.get("employeeId") || "");
  const shift = String(formData.get("shift") || "DAY") as ShiftType;
  const post = String(formData.get("post") || "").trim() || null;
  const replacementId = String(formData.get("replacementId") || "").trim() || null;
  const isLeave = formData.get("isLeave") === "on";
  const notes = String(formData.get("notes") || "").trim() || null;
  const date = todayDate();

  if (!employeeId) throw new Error("Guard is required");

  const guard = await prisma.guardShift.upsert({
    where: {
      employeeId_date_shift: { employeeId, date, shift },
    },
    create: {
      employeeId,
      date,
      shift,
      post,
      replacementId,
      isLeave,
      notes,
    },
    update: { post, replacementId, isLeave, notes },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "GUARD_SHIFT_SCHEDULED",
    module: "attendance",
    recordId: guard.id,
    newValue: { employeeId, shift, post, isLeave },
  });

  revalidatePath("/attendance");
}

export async function deleteGuardShift(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "mark_attendance")) throw new Error("Forbidden");

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Shift ID required");

  await prisma.guardShift.delete({ where: { id } });

  await writeAuditLog({
    userId: session.user.id,
    action: "GUARD_SHIFT_REMOVED",
    module: "attendance",
    recordId: id,
  });

  revalidatePath("/attendance");
}
