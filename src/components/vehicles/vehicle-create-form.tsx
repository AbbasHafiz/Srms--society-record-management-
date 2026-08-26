"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OtherSpecify } from "@/components/ui/other-specify";
import { VEHICLE_TYPE_OPTIONS, VEHICLE_USED_FOR_OPTIONS } from "@/lib/vehicles";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  unlinkedTankers: Array<{ id: string; tankerCode: string; capacityLiters: number }>;
};

export function VehicleCreateForm({ action, unlinkedTankers }: Props) {
  const [vehicleType, setVehicleType] = useState("STAFF_PICKUP");
  const [usedFor, setUsedFor] = useState("STAFF_PICKUP");

  return (
    <form action={action} className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-4">
      <Input name="vehicleCode" placeholder="Code (auto if blank)" />
      <Input name="registrationNo" placeholder="Registration no." />
      <div>
        <select
          name="vehicleType"
          value={vehicleType}
          onChange={(e) => setVehicleType(e.target.value)}
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          {VEHICLE_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        <OtherSpecify
          selectedValue={vehicleType}
          name="customType"
          label="Specify vehicle type"
          className="mt-2"
        />
      </div>
      <div>
        <select
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
          placeholder="e.g. Garbage collection runs"
          className="mt-2"
        />
      </div>
      {unlinkedTankers.length > 0 ? (
        <select name="waterTankerId" defaultValue="" className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm lg:col-span-2">
          <option value="">Link water tanker (optional)</option>
          {unlinkedTankers.map((t) => (
            <option key={t.id} value={t.id}>
              {t.tankerCode} ({t.capacityLiters.toLocaleString()} L)
            </option>
          ))}
        </select>
      ) : null}
      <Input name="remarks" placeholder="Remarks" className="lg:col-span-2" />
      <Button type="submit">Add vehicle</Button>
    </form>
  );
}
