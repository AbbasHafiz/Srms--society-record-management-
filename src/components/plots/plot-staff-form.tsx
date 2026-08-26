"use client";

import { Button } from "@/components/ui/button";
import { assignPlotStaff } from "@/app/(app)/plots/actions";
import { employeeRoleLabel } from "@/lib/hr";

import type { Designation } from "@/generated/prisma/client";

type EmployeeOption = {
  id: string;
  name: string;
  employeeCode: string;
  orgRole?: { name: string } | null;
  designation?: Designation | null;
};

export function PlotStaffAssignForm({
  plotId,
  employees,
}: {
  plotId: string;
  employees: EmployeeOption[];
}) {
  return (
    <form action={assignPlotStaff} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
      <h3 className="font-display mb-3 text-base font-semibold">Assign Staff</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Employee
          </label>
          <select
            name="employeeId"
            required
            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">Select employee…</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} ({e.employeeCode}) — {employeeRoleLabel(e)}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Role label
          </label>
          <input
            name="roleLabel"
            placeholder="e.g. Park Mali, Caretaker"
            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        </div>
        <div className="sm:col-span-2">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
            Remarks
          </label>
          <input
            name="remarks"
            placeholder="Optional notes"
            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        </div>
      </div>
      <input type="hidden" name="plotId" value={plotId} />
      <div className="mt-3">
        <Button type="submit">Assign to plot</Button>
      </div>
    </form>
  );
}
