import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import type { EmployeeStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: EmployeeStatus[] = ["ACTIVE", "ON_LEAVE", "SUSPENDED", "RESIGNED", "TERMINATED"];

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status?.trim() as EmployeeStatus | undefined;
  const q = sp.q?.trim();

  const employees = await prisma.employee.findMany({
    where: {
      ...(status && STATUSES.includes(status) ? { status } : {}),
      ...(q
        ? {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { employeeCode: { contains: q, mode: "insensitive" } },
              { cnic: { contains: q } },
              { department: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    orderBy: [{ status: "asc" }, { name: "asc" }],
    take: 100,
  });

  return (
    <div>
      <PageHeader title="Employees" description="Society staff register with designations and status." />

      <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <input
          name="q"
          placeholder="Search name, code, CNIC…"
          defaultValue={q}
          className="flex h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {labelize(s)}
            </option>
          ))}
        </select>
        <Button type="submit">Filter</Button>
      </form>

      {employees.length === 0 ? (
        <EmptyState title="No employees found" description="Try adjusting your filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>CNIC</th>
                <th>Designation</th>
                <th>Department</th>
                <th>Joined</th>
                <th>Salary</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id}>
                  <td className="font-mono text-sm">{e.employeeCode}</td>
                  <td className="font-medium">{e.name}</td>
                  <td>{e.cnic}</td>
                  <td>{labelize(e.designation)}</td>
                  <td>{e.department ?? "—"}</td>
                  <td>{formatDate(e.joiningDate)}</td>
                  <td>{e.salary ? formatCurrency(e.salary) : "—"}</td>
                  <td>
                    <Badge status={e.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
