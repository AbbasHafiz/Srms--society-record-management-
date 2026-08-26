"use client";

import Link from "next/link";
import { useState } from "react";
import { PageHeader } from "@/components/ui/page";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  MAINTENANCE_PAYMENT_STATUSES,
  MAINTENANCE_STATUSES,
  MAINTENANCE_TYPE_SUGGESTIONS,
} from "@/lib/maintenance";
import { labelize } from "@/lib/utils";
import { createMaintenanceWork } from "@/app/(app)/maintenance/actions";

export function MaintenanceNewForm() {
  const [workType, setWorkType] = useState("ELECTRICAL");
  const now = new Date();

  return (
    <>
      <PageHeader
        title="New maintenance job"
        description="Record society-wide maintenance. Choose a suggested type or enter any custom type."
        actions={
          <Link href="/maintenance">
            <Button variant="outline">Back to list</Button>
          </Link>
        }
      />

      <form
        action={createMaintenanceWork}
        encType="multipart/form-data"
        className="max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm">
            <Label>Date *</Label>
            <Input name="workDate" type="date" required defaultValue={now.toISOString().slice(0, 10)} className="mt-1" />
          </label>
          <label className="text-sm">
            <Label>Type *</Label>
            <select
              name="workType"
              value={workType}
              onChange={(e) => setWorkType(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              {MAINTENANCE_TYPE_SUGGESTIONS.map((t) => (
                <option key={t} value={t}>
                  {labelize(t)}
                </option>
              ))}
              <option value="CUSTOM">Custom type…</option>
            </select>
          </label>
          {workType === "CUSTOM" ? (
            <label className="text-sm sm:col-span-2">
              <Label>Custom type *</Label>
              <Input name="customWorkType" required placeholder="e.g. Boundary wall repair" className="mt-1" />
            </label>
          ) : null}
          <label className="text-sm sm:col-span-2">
            <Label>Description *</Label>
            <Input name="description" required placeholder="Brief description of work" className="mt-1" />
          </label>
          <label className="text-sm">
            <Label>Location / area</Label>
            <Input name="location" placeholder="Block, street, building" className="mt-1" />
          </label>
          <label className="text-sm">
            <Label>Cost (PKR) *</Label>
            <Input name="cost" type="number" min="0" step="1" required className="mt-1" />
          </label>
          <label className="text-sm">
            <Label>Contractor</Label>
            <Input name="contractorName" className="mt-1" />
          </label>
          <label className="text-sm">
            <Label>Work status</Label>
            <select name="status" defaultValue="REPORTED" className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
              {MAINTENANCE_STATUSES.map((s) => (
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
              defaultValue="PENDING"
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              {MAINTENANCE_PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {labelize(s)}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="block text-sm">
          <Label>Remarks</Label>
          <Input name="remarks" className="mt-1" />
        </label>

        <label className="block text-sm">
          <Label>Document scan (optional)</Label>
          <Input name="scan" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*" className="mt-1" />
        </label>

        <div className="rounded-md border border-slate-100 bg-slate-50 p-3 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="postToFinance" />
            Post to finance ledger when payment status is Paid (Repair &amp; maintenance)
          </label>
          <label className="mt-2 block">
            <Label>Payment method (if posting)</Label>
            <select name="paymentMethod" defaultValue="CASH" className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
              <option value="CASH">Cash</option>
              <option value="CHEQUE">Cheque</option>
              <option value="BANK_TRANSFER">Bank transfer</option>
              <option value="PO">PO</option>
              <option value="OTHER">Other</option>
            </select>
          </label>
        </div>

        <Button type="submit">Save job</Button>
      </form>
    </>
  );
}
