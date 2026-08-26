import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { PageHeader, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RoleBadge } from "@/components/employees/designation-badge";
import { markAttendance, bulkMarkAttendance, createGuardShift, deleteGuardShift } from "./actions";
import { formatDateTime, labelize } from "@/lib/utils";
import { WhatsAppNotifyAction } from "@/components/whatsapp/whatsapp-notify-action";
import { startOfDay } from "date-fns";

export const dynamic = "force-dynamic";

const MARK_STATUSES = ["PRESENT", "ABSENT", "LEAVE", "LATE", "HALF_DAY"] as const;

export default async function AttendancePage() {
  const today = startOfDay(new Date());
  const session = await auth();
  const canMark = session?.user && hasPermission(session.user.role, "mark_attendance");

  const [activeEmployees, todayAttendance, guardShifts, presentCount, absentCount, onLeaveCount, departments, orgRoles, securityGuards] =
    await Promise.all([
      prisma.employee.findMany({
        where: { status: "ACTIVE" },
        include: { orgRole: true },
        orderBy: [{ orgRole: { sortOrder: "asc" } }, { name: "asc" }],
      }),
      prisma.attendance.findMany({
        where: { date: today },
        include: { markedBy: { select: { name: true } } },
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
      prisma.employee.findMany({
        where: { status: "ACTIVE", department: { not: null } },
        select: { department: true },
        distinct: ["department"],
        orderBy: { department: "asc" },
      }),
      prisma.orgRole.findMany({
        where: { isActive: true },
        orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
      }),
      prisma.employee.findMany({
        where: {
          status: "ACTIVE",
          OR: [
            { designation: "SECURITY_GUARD" },
            { orgRole: { code: "SECURITY_GUARD" } },
          ],
        },
        orderBy: { name: "asc" },
      }),
    ]);

  const attendanceMap = new Map(todayAttendance.map((a) => [a.employeeId, a]));

  return (
    <div>
      <PageHeader
        title="Attendance"
        description={`Daily attendance roster and guard shifts for ${today.toLocaleDateString("en-GB")}`}
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {session?.user && securityGuards.length ? (
              <WhatsAppNotifyAction
                userRole={session.user.role}
                relatedModule="attendance"
                defaultTemplateKey="guard_shift_reminder"
                templateVars={{
                  date: today.toLocaleDateString("en-GB"),
                  shift: "Day/Night",
                  post: "Security post",
                }}
                guardEmployees={securityGuards.map((g) => ({
                  id: g.id,
                  name: g.name,
                  phone: g.contact,
                }))}
                allowedModes={["all_guards", "multi_guards", "preset", "custom"]}
                presets={securityGuards
                  .filter((g) => g.contact)
                  .map((g) => ({
                    key: g.id,
                    label: g.name,
                    name: g.name,
                    phone: g.contact!,
                    type: "GUARD" as const,
                    employeeId: g.id,
                  }))}
                label="Notify guards"
              />
            ) : null}
            <Link href="/employees" className="text-sm text-teal-800 hover:underline">
              Staff register
            </Link>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Present Today" value={presentCount} tone="success" />
        <StatCard label="Absent" value={absentCount} tone={absentCount ? "warn" : "default"} />
        <StatCard label="On Leave" value={onLeaveCount} />
      </div>

      {canMark ? (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Bulk mark attendance</h2>
          <p className="mt-1 text-sm text-slate-600">
            Mark all active staff present (or another status) by role or department.
          </p>
          <form action={bulkMarkAttendance} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Role</span>
              <select name="orgRoleId" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 sm:w-48">
                <option value="">All active staff</option>
                {orgRoles.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Department</span>
              <select name="department" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 sm:w-48">
                <option value="">Any department</option>
                {departments.map((d) =>
                  d.department ? (
                    <option key={d.department} value={d.department}>{d.department}</option>
                  ) : null
                )}
              </select>
            </label>
            <label className="text-sm">
              <span className="mb-1 block font-medium text-slate-700">Status</span>
              <select name="status" defaultValue="PRESENT" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 sm:w-40">
                {MARK_STATUSES.map((s) => (
                  <option key={s} value={s}>{labelize(s)}</option>
                ))}
              </select>
            </label>
            <Button type="submit">Apply bulk mark</Button>
          </form>
          <div className="mt-3 flex flex-wrap gap-2">
            {orgRoles
              .filter((r) => ["COOK", "DRIVER", "MALI", "SWEEPER", "SECURITY_GUARD", "COMPUTER_OPERATOR"].includes(r.code))
              .map((r) => (
              <form key={r.id} action={bulkMarkAttendance} className="inline">
                <input type="hidden" name="orgRoleId" value={r.id} />
                <input type="hidden" name="status" value="PRESENT" />
                <Button type="submit" variant="outline" size="sm">
                  All {r.name} present
                </Button>
              </form>
            ))}
          </div>
        </section>
      ) : null}

      <section className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Today&apos;s Attendance Roster</h2>
          <p className="text-sm text-slate-500">
            All active staff — cooks, drivers, operators, guards, mali, sweepers, and management.
          </p>
        </div>
        {activeEmployees.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No active employees on record.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Employee</th>
                <th>Role</th>
                <th>Today&apos;s status</th>
                {canMark ? <th>Mark</th> : null}
              </tr>
            </thead>
            <tbody>
              {activeEmployees.map((emp) => {
                const record = attendanceMap.get(emp.id);
                return (
                  <tr key={emp.id}>
                    <td>
                      <div className="font-medium">{emp.name}</div>
                      <div className="text-xs text-slate-500">{emp.employeeCode}</div>
                    </td>
                    <td>
                      <RoleBadge orgRole={emp.orgRole} designation={emp.designation} />
                    </td>
                    <td>
                      {record ? (
                        <div className="space-y-1">
                          <Badge status={record.status} />
                          {record.checkIn ? (
                            <div className="text-xs text-slate-500">In: {formatDateTime(record.checkIn)}</div>
                          ) : null}
                          {record.markedBy ? (
                            <div className="text-xs text-slate-400">By {record.markedBy.name}</div>
                          ) : null}
                          {record.notes ? (
                            <div className="text-xs text-slate-600">{record.notes}</div>
                          ) : null}
                        </div>
                      ) : (
                        <Badge className="bg-slate-50 text-slate-500 border-slate-200">Not marked</Badge>
                      )}
                    </td>
                    {canMark ? (
                      <td>
                        <form action={markAttendance} className="space-y-2">
                          <input type="hidden" name="employeeId" value={emp.id} />
                          <div className="flex flex-wrap items-center gap-1">
                            {MARK_STATUSES.map((s) => (
                              <Button
                                key={s}
                                type="submit"
                                name="status"
                                value={s}
                                size="sm"
                                variant={record?.status === s ? "default" : "outline"}
                              >
                                {labelize(s)}
                              </Button>
                            ))}
                          </div>
                          <input
                            name="notes"
                            defaultValue={record?.notes ?? ""}
                            placeholder="Notes (optional)"
                            className="h-8 w-full min-w-[10rem] rounded-md border border-slate-300 px-2 text-xs"
                          />
                        </form>
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Marked Attendance Log</h2>
          </div>
          {todayAttendance.length === 0 ? (
            <p className="px-5 py-8 text-sm text-slate-500">No attendance marked yet today.</p>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Shift</th>
                  <th>Check In</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {todayAttendance.map((a) => {
                  const emp = activeEmployees.find((e) => e.id === a.employeeId);
                  return (
                    <tr key={a.id}>
                      <td>
                        <div className="font-medium">{emp?.name ?? a.employeeId}</div>
                        <div className="text-xs text-slate-500">{emp?.employeeCode}</div>
                      </td>
                      <td>{labelize(a.shift)}</td>
                      <td>{formatDateTime(a.checkIn)}</td>
                      <td>
                        <Badge status={a.status} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </section>

        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Guard Shifts</h2>
            <p className="text-sm text-slate-500">Security guard roster — day/night posts and replacements.</p>
          </div>

          {canMark ? (
            <form action={createGuardShift} className="border-b border-slate-100 bg-slate-50/50 px-5 py-4">
              <p className="mb-3 text-sm font-medium text-slate-700">Schedule guard shift (today)</p>
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-slate-600">Guard</span>
                  <select name="employeeId" required className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
                    <option value="">Select guard</option>
                    {securityGuards.map((g) => (
                      <option key={g.id} value={g.id}>{g.name} ({g.employeeCode})</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-slate-600">Shift</span>
                  <select name="shift" defaultValue="DAY" className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
                    <option value="DAY">Day</option>
                    <option value="NIGHT">Night</option>
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-slate-600">Post</span>
                  <input name="post" placeholder="e.g. Main Gate" className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm" />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block text-xs text-slate-600">Replacement</span>
                  <select name="replacementId" className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm">
                    <option value="">None</option>
                    {securityGuards.map((g) => (
                      <option key={g.id} value={g.id}>{g.name}</option>
                    ))}
                  </select>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="isLeave" />
                  On leave
                </label>
                <Button type="submit" size="sm">Add / update shift</Button>
              </div>
            </form>
          ) : null}

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
                  {canMark ? <th></th> : null}
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
                    {canMark ? (
                      <td>
                        <form action={deleteGuardShift}>
                          <input type="hidden" name="id" value={g.id} />
                          <Button type="submit" size="sm" variant="outline">Remove</Button>
                        </form>
                      </td>
                    ) : null}
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
