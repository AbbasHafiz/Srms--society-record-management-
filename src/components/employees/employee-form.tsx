import { EMPLOYMENT_TYPES, CONTRACTOR_TRADES } from "@/lib/hr";
import { labelize } from "@/lib/utils";
import type { EmployeeStatus } from "@/generated/prisma/client";

const STATUSES: EmployeeStatus[] = ["ACTIVE", "ON_LEAVE", "SUSPENDED", "RESIGNED", "TERMINATED"];

type OrgRoleOption = { id: string; name: string; category: string; code: string };
type SupervisorOption = { id: string; name: string; employeeCode: string };

type EmployeeFormProps = {
  action: (formData: FormData) => Promise<void>;
  orgRoles: OrgRoleOption[];
  supervisors: SupervisorOption[];
  employee?: {
    id: string;
    name: string;
    cnic: string;
    contact: string | null;
    email: string | null;
    orgRoleId: string | null;
    supervisorId: string | null;
    employmentType: string;
    companyName: string | null;
    contractStart: Date | null;
    contractEnd: Date | null;
    contractorTrade: string | null;
    department: string | null;
    joiningDate: Date;
    salary: { toString(): string } | null;
    status: EmployeeStatus;
    remarks: string | null;
    photoPath: string | null;
    employeeCode?: string;
  };
  submitLabel: string;
};

function dateInputValue(d: Date | null | undefined): string {
  return d ? new Date(d).toISOString().slice(0, 10) : "";
}

export function EmployeeForm({ action, orgRoles, supervisors, employee, submitLabel }: EmployeeFormProps) {
  const joiningValue = dateInputValue(employee?.joiningDate ?? new Date());
  const defaultEmploymentType = employee?.employmentType ?? "STAFF";

  const rolesByCategory = orgRoles.reduce<Record<string, OrgRoleOption[]>>((acc, role) => {
    (acc[role.category] ??= []).push(role);
    return acc;
  }, {});

  return (
    <form action={action} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {employee?.id ? <input type="hidden" name="id" value={employee.id} /> : null}
      {employee?.employeeCode ? (
        <p className="text-sm text-slate-600">
          Employee code: <span className="font-mono font-medium text-slate-900">{employee.employeeCode}</span>
        </p>
      ) : null}

      <fieldset className="space-y-4">
        <legend className="font-display text-sm font-semibold text-slate-900">Basic Information</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Full name *</span>
            <input
              name="name"
              required
              defaultValue={employee?.name}
              className="h-10 w-full rounded-md border border-slate-300 px-3"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">CNIC *</span>
            <input
              name="cnic"
              required
              placeholder="35202-1234567-1"
              defaultValue={employee?.cnic}
              className="h-10 w-full rounded-md border border-slate-300 px-3 font-mono"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Contact</span>
            <input
              name="contact"
              defaultValue={employee?.contact ?? ""}
              className="h-10 w-full rounded-md border border-slate-300 px-3"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Email</span>
            <input
              name="email"
              type="email"
              defaultValue={employee?.email ?? ""}
              className="h-10 w-full rounded-md border border-slate-300 px-3"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-display text-sm font-semibold text-slate-900">Role & Reporting</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Organization role *</span>
            <select
              name="orgRoleId"
              required
              defaultValue={employee?.orgRoleId ?? ""}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
            >
              <option value="" disabled>
                Select role…
              </option>
              {Object.entries(rolesByCategory).map(([category, roles]) => (
                <optgroup key={category} label={labelize(category)}>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              Manage custom roles under{" "}
              <a href="/settings/roles" className="text-teal-800 hover:underline">
                Settings → Roles
              </a>
            </p>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Supervisor</span>
            <select
              name="supervisorId"
              defaultValue={employee?.supervisorId ?? ""}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
            >
              <option value="">None (top-level)</option>
              {supervisors
                .filter((s) => s.id !== employee?.id)
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.employeeCode})
                  </option>
                ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Employment type</span>
            <select
              name="employmentType"
              defaultValue={defaultEmploymentType}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {labelize(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Department</span>
            <input
              name="department"
              placeholder="e.g. Security, Works, Admin"
              defaultValue={employee?.department ?? ""}
              className="h-10 w-full rounded-md border border-slate-300 px-3"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4 rounded-lg border border-dashed border-orange-200 bg-orange-50/30 p-4">
        <legend className="px-1 font-display text-sm font-semibold text-orange-900">Contractor Details</legend>
        <p className="text-xs text-slate-600">Fill when employment type is Contractor.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Company name</span>
            <input
              name="companyName"
              defaultValue={employee?.companyName ?? ""}
              className="h-10 w-full rounded-md border border-slate-300 px-3"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Trade / specialty</span>
            <select
              name="contractorTrade"
              defaultValue={employee?.contractorTrade ?? ""}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
            >
              <option value="">—</option>
              {CONTRACTOR_TRADES.map((t) => (
                <option key={t} value={t}>
                  {labelize(t)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Contract start</span>
            <input
              name="contractStart"
              type="date"
              defaultValue={dateInputValue(employee?.contractStart)}
              className="h-10 w-full rounded-md border border-slate-300 px-3"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Contract end</span>
            <input
              name="contractEnd"
              type="date"
              defaultValue={dateInputValue(employee?.contractEnd)}
              className="h-10 w-full rounded-md border border-slate-300 px-3"
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="space-y-4">
        <legend className="font-display text-sm font-semibold text-slate-900">Employment & Pay</legend>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Joining date</span>
            <input
              name="joiningDate"
              type="date"
              defaultValue={joiningValue}
              className="h-10 w-full rounded-md border border-slate-300 px-3"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Monthly salary rate (PKR)</span>
            <input
              name="salary"
              type="number"
              min="0"
              step="1"
              defaultValue={employee?.salary?.toString() ?? ""}
              className="h-10 w-full rounded-md border border-slate-300 px-3"
            />
            <p className="mt-1 text-xs text-slate-500">Current rate — payment history is recorded separately.</p>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Status</span>
            <select
              name="status"
              defaultValue={employee?.status ?? "ACTIVE"}
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {labelize(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Photo path (optional)</span>
            <input
              name="photoPath"
              placeholder="/uploads/staff/photo.jpg"
              defaultValue={employee?.photoPath ?? ""}
              className="h-10 w-full rounded-md border border-slate-300 px-3"
            />
          </label>
        </div>
      </fieldset>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Remarks</span>
        <textarea
          name="remarks"
          rows={3}
          defaultValue={employee?.remarks ?? ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <button
        type="submit"
        className="inline-flex h-10 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900"
      >
        {submitLabel}
      </button>
    </form>
  );
}
