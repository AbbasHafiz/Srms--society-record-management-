"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { OfficePremisesType, RegisteredOfficeStatus } from "@/generated/prisma/client";

export type OfficeFormValues = {
  officeName: string;
  ownerName: string;
  phone: string;
  email?: string | null;
  address?: string | null;
  premisesType: OfficePremisesType;
  plotId?: string | null;
  plotLabel?: string | null;
  rentAmount?: string | number | null;
  rentStartDate?: string | Date | null;
  licenseNumber?: string | null;
  registrationDate?: string | Date | null;
  expiryDate?: string | Date | null;
  status?: RegisteredOfficeStatus;
  remarks?: string | null;
};

function dateInputValue(value?: string | Date | null) {
  if (!value) return "";
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

export function OfficeForm({
  action,
  initial,
  officeId,
  submitLabel,
  allowPremisesTypeChange = true,
  showLetterheadUpload = false,
}: {
  action: (formData: FormData) => void | Promise<void>;
  initial?: OfficeFormValues;
  officeId?: string;
  submitLabel: string;
  allowPremisesTypeChange?: boolean;
  showLetterheadUpload?: boolean;
}) {
  const [premisesType, setPremisesType] = useState<OfficePremisesType>(
    initial?.premisesType ?? "PRIVATE"
  );
  const [plotQuery, setPlotQuery] = useState("");
  const [plotId, setPlotId] = useState(initial?.plotId ?? "");
  const [plotLabel, setPlotLabel] = useState(initial?.plotLabel ?? "");
  const societyLand = premisesType === "SOCIETY_LAND";

  async function searchPlots() {
    const q = plotQuery.trim();
    if (!q) return;
    const res = await fetch(`/api/plots/search?q=${encodeURIComponent(q)}&limit=10`);
    if (!res.ok) return;
    const data = await res.json();
    const first = data.plots?.[0];
    if (first) {
      setPlotId(first.id);
      setPlotLabel(first.label);
    }
  }

  return (
    <form action={action} className="max-w-2xl space-y-4 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      {officeId ? <input type="hidden" name="id" value={officeId} /> : null}
      <input type="hidden" name="plotId" value={plotId} />

      {allowPremisesTypeChange ? (
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Premises type</label>
          <select
            name="premisesType"
            value={premisesType}
            onChange={(e) => setPremisesType(e.target.value as OfficePremisesType)}
            className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="PRIVATE">Private (dealer office — no society rent)</option>
            <option value="SOCIETY_LAND">Society land (monthly rent applies)</option>
          </select>
        </div>
      ) : (
        <input type="hidden" name="premisesType" value={premisesType} />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Office name</label>
          <Input name="officeName" required defaultValue={initial?.officeName ?? ""} placeholder="e.g. ABC Properties" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Owner name</label>
          <Input name="ownerName" required defaultValue={initial?.ownerName ?? ""} />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Phone</label>
          <Input name="phone" required defaultValue={initial?.phone ?? ""} placeholder="03xx-xxxxxxx" />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Email</label>
          <Input name="email" type="email" defaultValue={initial?.email ?? ""} />
        </div>
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Address</label>
        <textarea
          name="address"
          rows={2}
          defaultValue={initial?.address ?? ""}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      {societyLand ? (
        <div className="space-y-4 rounded-lg border border-teal-100 bg-teal-50/40 p-4">
          <p className="text-sm font-medium text-teal-950">Society land — monthly rent</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Monthly rent (PKR)</label>
              <Input
                name="rentAmount"
                type="number"
                min="0"
                step="1"
                required={allowPremisesTypeChange || societyLand}
                defaultValue={initial?.rentAmount?.toString() ?? ""}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Rent start date</label>
              <Input name="rentStartDate" type="date" defaultValue={dateInputValue(initial?.rentStartDate)} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Linked plot (optional)</label>
            <div className="flex gap-2">
              <Input
                value={plotQuery}
                onChange={(e) => setPlotQuery(e.target.value)}
                placeholder="Search plot to link…"
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={searchPlots}>Search</Button>
            </div>
            {plotLabel ? <p className="mt-1 text-xs text-slate-600">Linked: {plotLabel}</p> : null}
          </div>
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border border-slate-200 bg-slate-50/60 p-4">
          <p className="text-sm font-medium text-slate-800">Private dealer office — license & registration</p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">License number</label>
              <Input name="licenseNumber" defaultValue={initial?.licenseNumber ?? ""} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Registration status</label>
              <select
                name="status"
                defaultValue={initial?.status ?? "ACTIVE"}
                className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="ACTIVE">Active</option>
                <option value="EXPIRED">Expired</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Registration date</label>
              <Input name="registrationDate" type="date" defaultValue={dateInputValue(initial?.registrationDate)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">License expiry</label>
              <Input name="expiryDate" type="date" defaultValue={dateInputValue(initial?.expiryDate)} />
            </div>
          </div>
        </div>
      )}

      <div>
        <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Remarks</label>
        <textarea
          name="remarks"
          rows={2}
          defaultValue={initial?.remarks ?? ""}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
        />
      </div>

      {showLetterheadUpload ? (
        <div>
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Letterhead scan (optional)</label>
          <Input name="letterhead" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
        </div>
      ) : null}

      <Button type="submit">{submitLabel}</Button>
    </form>
  );
}
