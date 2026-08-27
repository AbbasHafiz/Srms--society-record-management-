"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtherSpecify } from "@/components/ui/other-specify";
import { VEHICLE_TYPE_GROUPS, VEHICLE_USED_FOR_OPTIONS } from "@/lib/vehicles-shared";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  unlinkedTankers: Array<{ id: string; tankerCode: string; capacityLiters: number }>;
};

export function VehicleCreateForm({ action, unlinkedTankers }: Props) {
  const [vehicleType, setVehicleType] = useState("CAR");
  const [usedFor, setUsedFor] = useState("STAFF_PICKUP");

  return (
    <form action={action} className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-700">Code</span>
        <Input name="vehicleCode" placeholder="Auto if blank (e.g. VEH-004)" />
      </label>
      <label className="text-sm">
        <span className="mb-1 block font-medium text-slate-700">Registration no.</span>
        <Input name="registrationNo" placeholder="e.g. ICT-4521" />
      </label>
      <div className="text-sm">
        <label className="mb-1 block font-medium text-slate-700" htmlFor="vehicleType">
          Vehicle type
        </label>
        <select
          id="vehicleType"
          name="vehicleType"
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value)}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          {VEHICLE_TYPE_GROUPS.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.options.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        <OtherSpecify
          selectedValue={vehicleType}
          name="customType"
          label="Specify vehicle type"
          placeholder="e.g. Dump truck, sweeper"
          className="mt-2"
        />
      </div>
      <div className="text-sm">
        <label className="mb-1 block font-medium text-slate-700" htmlFor="usedFor">
          Used for
        </label>
        <select
          id="usedFor"
          name="usedFor"
          value={usedFor}
          onChange={(e) => setUsedFor(e.target.value)}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          {VEHICLE_USED_FOR_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <OtherSpecify
          selectedValue={usedFor}
          label="Specify usage"
          placeholder="e.g. Garbage collection, ambulance duty"
          className="mt-2"
        />
      </div>
      {unlinkedTankers.length > 0 ? (
        <label className="text-sm lg:col-span-2">
          <span className="mb-1 block font-medium text-slate-700">Link water tanker</span>
          <select name="waterTankerId" defaultValue="" className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
            <option value="">None (optional)</option>
            {unlinkedTankers.map((t) => (
              <option key={t.id} value={t.id}>
                {t.tankerCode} ({t.capacityLiters.toLocaleString()} L)
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className="text-sm lg:col-span-2">
        <span className="mb-1 block font-medium text-slate-700">Remarks</span>
        <Input name="remarks" placeholder="Route, assigned area, or notes" />
      </label>
      <div className="flex items-end">
        <Button type="submit">Add vehicle</Button>
      </div>
    </form>
  );
}
