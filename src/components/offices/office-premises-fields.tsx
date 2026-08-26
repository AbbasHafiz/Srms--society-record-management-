"use client";

import { useState } from "react";

type PremisesType = "SOCIETY_LAND" | "PRIVATE";

export function OfficePremisesFields({ defaultType = "SOCIETY_LAND" }: { defaultType?: PremisesType }) {
  const [premisesType, setPremisesType] = useState<PremisesType>(defaultType);
  const societyLand = premisesType === "SOCIETY_LAND";

  return (
    <>
      <label className="text-sm sm:col-span-2">
        <span className="mb-1 block font-medium text-slate-700">Premises type</span>
        <select
          name="premisesType"
          value={premisesType}
          onChange={(e) => setPremisesType(e.target.value as PremisesType)}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="SOCIETY_LAND">Society-provided land (rent applies)</option>
          <option value="PRIVATE">Private premises (registered, no society rent)</option>
        </select>
      </label>

      {societyLand ? (
        <>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Monthly rent (PKR)</span>
            <input
              name="rentAmount"
              type="number"
              min={0}
              step="0.01"
              required
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Rent start date</span>
            <input
              name="rentStartDate"
              type="date"
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
            />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium text-slate-700">Society plot (optional)</span>
            <input
              name="plotId"
              placeholder="Plot ID if office is on a society plot"
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              Link a plot to enable letterhead scans via the document library.
            </p>
          </label>
        </>
      ) : (
        <>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">License / registration no.</span>
            <input
              name="licenseNumber"
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Registration date</span>
            <input
              name="registrationDate"
              type="date"
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Expiry date</span>
            <input
              name="expiryDate"
              type="date"
              className="h-10 w-full rounded-md border border-slate-300 px-3 text-sm"
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium text-slate-700">Status</span>
            <select
              name="status"
              defaultValue="ACTIVE"
              className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </label>
        </>
      )}
    </>
  );
}
