"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { labelize } from "@/lib/utils";
import type { MaintenanceWorkStatus, PaymentStatus } from "@/generated/prisma/client";
import { updateMaintenanceWork } from "@/app/(app)/maintenance/actions";

type MaintenanceEditFormProps = {
  work: {
    id: string;
    workDate: string;
    workType: string;
    description: string;
    location: string | null;
    contractorName: string | null;
    employeeId: string | null;
    cost: number;
    status: MaintenanceWorkStatus;
    paymentStatus: PaymentStatus;
    remarks: string | null;
  };
  employees: Array<{ id: string; name: string; employeeCode: string }>;
  typeSuggestions: string[];
  statuses: MaintenanceWorkStatus[];
  paymentStatuses: PaymentStatus[];
};

export function MaintenanceEditForm({
  work,
  employees,
  typeSuggestions,
  statuses,
  paymentStatuses,
}: MaintenanceEditFormProps) {
  const presetValues = useMemo(() => new Set(typeSuggestions), [typeSuggestions]);
  const initialPreset = presetValues.has(work.workType) ? work.workType : "CUSTOM";
  const [workType, setWorkType] = useState(initialPreset);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-display text-lg font-semibold">Edit job</h2>
      <form action={updateMaintenanceWork} encType="multipart/form-data" className="mt-4 space-y-3">
        <input type="hidden" name="id" value={work.id} />
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <Label>Date</Label>
            <Input name="workDate" type="date" defaultValue={work.workDate} required className="mt-1" />
          </label>
          <label className="text-sm">
            <Label>Type</Label>
            <select
              name="workType"
              value={workType}
              onChange={(e) => setWorkType(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              {typeSuggestions.map((t) => (
                <option key={t} value={t}>
                  {labelize(t)}
                </option>
              ))}
              <option value="CUSTOM">Custom type…</option>
            </select>
          </label>
          {workType === "CUSTOM" ? (
            <label className="text-sm sm:col-span-2">
              <Label>Custom type</Label>
              <Input
                name="customWorkType"
                defaultValue={presetValues.has(work.workType) ? "" : work.workType}
                required
                className="mt-1"
              />
            </label>
          ) : null}
          <label className="text-sm sm:col-span-2">
            <Label>Description</Label>
            <Input name="description" defaultValue={work.description} required className="mt-1" />
          </label>
          <label className="text-sm">
            <Label>Location</Label>
            <Input name="location" defaultValue={work.location ?? ""} className="mt-1" />
          </label>
          <label className="text-sm">
            <Label>Cost</Label>
            <Input name="cost" type="number" defaultValue={work.cost} required className="mt-1" />
          </label>
          <label className="text-sm">
            <Label>Contractor</Label>
            <Input name="contractorName" defaultValue={work.contractorName ?? ""} className="mt-1" />
          </label>
          <label className="text-sm">
            <Label>Employee</Label>
            <select
              name="employeeId"
              defaultValue={work.employeeId ?? ""}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="">None</option>
              {employees.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name} ({e.employeeCode})
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <Label>Work status</Label>
            <select name="status" defaultValue={work.status} className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {labelize(s)}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            <Label>Payment status</Label>
            <select
              name="paymentStatus"
              defaultValue={work.paymentStatus}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              {paymentStatuses.map((s) => (
                <option key={s} value={s}>
                  {labelize(s)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="block text-sm">
          <Label>Remarks</Label>
          <Input name="remarks" defaultValue={work.remarks ?? ""} className="mt-1" />
        </label>
        <label className="block text-sm">
          <Label>Replace scan (optional)</Label>
          <Input name="scan" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*" className="mt-1" />
        </label>
        <Button type="submit">Save changes</Button>
      </form>
    </section>
  );
}
