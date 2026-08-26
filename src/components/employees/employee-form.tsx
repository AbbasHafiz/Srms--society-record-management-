import { ALL_DESIGNATIONS } from "@/lib/hr";
import { labelize } from "@/lib/utils";
import type { Designation, EmployeeStatus } from "@/generated/prisma/client";

const STATUSES: EmployeeStatus[] = ["ACTIVE", "ON_LEAVE", "SUSPENDED", "RESIGNED", "TERMINATED"];

type EmployeeFormProps = {
  action: (formData: FormData) => Promise<void>;
  employee?: {
    id: string;
    name: string;
    cnic: string;
    contact: string | null;
    email: string | null;
    designation: Designation;
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

export function EmployeeForm({ action, employee, submitLabel }: EmployeeFormProps) {
  const joiningValue = employee?.joiningDate
    ? new Date(employee.joiningDate).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10);

  return (
    <form action={action} className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {employee?.id ? <input type="hidden" name="id" value={employee.id} /> : null}
      {employee?.employeeCode ? (
        <p className="text-sm text-slate-600">
          Employee code: <span className="font-mono font-medium text-slate-900">{employee.employeeCode}</span>
        </p>
      ) : null}

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
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-700">Designation *</span>
          <select
            name="designation"
            required
            defaultValue={employee?.designation ?? "OTHER"}
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3"
          >
            {ALL_DESIGNATIONS.map((d) => (
              <option key={d} value={d}>
                {labelize(d)}
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
          <span className="mb-1 block font-medium text-slate-700">Monthly salary (PKR)</span>
          <input
            name="salary"
            type="number"
            min="0"
            step="1"
            defaultValue={employee?.salary?.toString() ?? ""}
            className="h-10 w-full rounded-md border border-slate-300 px-3"
          />
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

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-slate-700">Remarks</span>
        <textarea
          name="remarks"
          rows={3}
          defaultValue={employee?.remarks ?? ""}
          className="w-full rounded-md border border-slate-300 px-3 py-2"
        />
      </label>

      <button type="submit" className="inline-flex h-10 items-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900">
        {submitLabel}
      </button>
    </form>
  );
}
