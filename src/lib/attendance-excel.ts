import { prisma } from "@/lib/db";
import { formatDate, labelize } from "@/lib/utils";
import { startOfDay, startOfMonth, endOfMonth } from "date-fns";
import type { ExcelColumn } from "@/lib/excel";

export const ATTENDANCE_EXCEL_COLUMNS: ExcelColumn[] = [
  { header: "Employee Code", key: "employeeCode", width: 16 },
  { header: "Name", key: "name", width: 22 },
  { header: "Role", key: "role", width: 20 },
  { header: "Department", key: "department", width: 16 },
  { header: "Date", key: "date", width: 14 },
  { header: "Status", key: "status", width: 12 },
  { header: "Shift", key: "shift", width: 12 },
  { header: "Check In", key: "checkIn", width: 12 },
  { header: "Check Out", key: "checkOut", width: 12 },
  { header: "Notes", key: "notes", width: 22 },
];

export const ATTENDANCE_SUMMARY_COLUMNS: ExcelColumn[] = [
  { header: "Employee Code", key: "code", width: 16 },
  { header: "Name", key: "name", width: 22 },
  { header: "Present", key: "present", width: 12 },
  { header: "Absent", key: "absent", width: 12 },
  { header: "Leave", key: "leave", width: 12 },
];

function formatTime(date: Date | null | undefined) {
  if (!date) return "";
  return date.toISOString().slice(11, 16);
}

export async function loadAttendanceExcelRows() {
  const today = startOfDay(new Date());
  const [employees, records] = await Promise.all([
    prisma.employee.findMany({
      where: { status: "ACTIVE" },
      include: { orgRole: true },
      orderBy: { name: "asc" },
    }),
    prisma.attendance.findMany({
      where: { date: today },
    }),
  ]);
  const byEmployee = new Map(records.map((r) => [r.employeeId, r]));
  return employees.map((e) => {
    const rec = byEmployee.get(e.id);
    return {
      employeeCode: e.employeeCode,
      name: e.name,
      role: e.orgRole?.name ?? e.designation ?? "",
      department: e.department ?? "",
      date: formatDate(today),
      status: rec ? labelize(rec.status) : "Not marked",
      shift: rec ? labelize(rec.shift) : "",
      checkIn: formatTime(rec?.checkIn),
      checkOut: formatTime(rec?.checkOut),
      notes: rec?.notes ?? "",
    };
  });
}

export async function loadAttendanceSummaryRows(monthStr: string) {
  const [year, month] = monthStr.split("-").map(Number);
  const from = startOfMonth(new Date(year, month - 1));
  const to = endOfMonth(new Date(year, month - 1));
  const records = await prisma.attendance.findMany({
    where: { date: { gte: from, lte: to } },
    include: { employee: true },
  });
  const byEmployee = new Map<
    string,
    { code: string; name: string; present: number; absent: number; leave: number }
  >();
  for (const r of records) {
    const entry = byEmployee.get(r.employeeId) ?? {
      name: r.employee.name,
      code: r.employee.employeeCode,
      present: 0,
      absent: 0,
      leave: 0,
    };
    if (r.status === "PRESENT" || r.status === "LATE" || r.status === "HALF_DAY") entry.present++;
    else if (r.status === "ABSENT") entry.absent++;
    else if (r.status === "LEAVE") entry.leave++;
    byEmployee.set(r.employeeId, entry);
  }
  return [...byEmployee.values()];
}
