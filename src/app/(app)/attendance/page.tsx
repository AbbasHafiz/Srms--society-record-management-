import { prisma } from "@/lib/db";
import { PageHeader, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { formatDateTime, labelize } from "@/lib/utils";
import { startOfDay } from "date-fns";

export const dynamic = "force-dynamic";

export default async function AttendancePage() {
  const today = startOfDay(new Date());

  const [attendance, guardShifts, presentCount, absentCount, onLeaveCount] = await Promise.all([
    prisma.attendance.findMany({
      where: { date: today },
      include: { employee: true, markedBy: { select: { name: true } } },
      orderBy: { employee: { name: "asc" } },
    }),
    prisma.guardShift.findMany({
      where: { date: today },
      include: {
        employee: true,
        replacement: { select: { name: true, employeeCode: true } },
      },
      orderBy: [{ shift: "asc" }, { employee: { name: "asc" } }],
    }),
    prisma.attendance.count({ where: { date: today, status: "PRESENT" } }),
    prisma.attendance.count({ where: { date: today, status: "ABSENT" } }),
    prisma.attendance.count({ where: { date: today, status: "LEAVE" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={`Daily attendance and guard shifts for ${today.toLocaleDateString("en-GB")}`}
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Present Today" value={presentCount} tone="success" />
        <StatCard label="Absent" value={absentCount} tone={absentCount ? "warn" : "default"} />
        <StatCard label="On Leave" value={onLeaveCount} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Today&apos;s Attendance</h2>
          </div>
          {attendance.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">No attendance marked yet today.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Shift</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <div className="font-medium">{a.employee.name}</div>
                      <div className="text-xs text-slate-500">{a.employee.employeeCode}</div>
                    </td>
                    <td>{labelize(a.shift)}</td>
                    <td>{formatDateTime(a.checkIn)}</td>
                    <td>{formatDateTime(a.checkOut)}</td>
                    <td>
                      <Badge status={a.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Guard Shifts</h2>
          </div>
          {guardShifts.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">No guard shifts scheduled today.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Guard</th>
                  <th>Shift</th>
                  <th>Post</th>
                  <th>Replacement</th>
                  <th>Leave</th>
                </tr>
              </thead>
              <tbody>
                {guardShifts.map((g) => (
                  <tr key={g.id}>
                    <td>
                      <div className="font-medium">{g.employee.name}</div>
                      <div className="text-xs text-slate-500">{g.employee.employeeCode}</div>
                    </td>
                    <td>{labelize(g.shift)}</td>
                    <td>{g.post ?? "—"}</td>
                    <td>
                      {g.replacement ? (
                        <span>
                          {g.replacement.name}
                          <div className="text-xs text-slate-500">{g.replacement.employeeCode}</div>
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{g.isLeave ? <Badge status="LEAVE">On Leave</Badge> : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </div>
  );
}
