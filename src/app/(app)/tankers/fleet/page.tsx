import Link from "next/link";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TankerNav } from "@/components/tankers/tanker-nav";
import { createWaterTanker, updateWaterTanker } from "../actions";
import { listAllTankers, listTankerDrivers } from "@/lib/tankers";

export const dynamic = "force-dynamic";

export default async function TankerFleetPage() {
  const session = await auth();
  const canManage = session?.user && hasPermission(session.user.role, "edit");

  const [tankers, drivers] = await Promise.all([listAllTankers(), listTankerDrivers()]);

  return (
    <div>
      <PageHeader
        title="Water Tankers"
        description="Register society water tankers and assign default drivers."
      />

      <TankerNav active="fleet" />

      {canManage ? (
        <form
          action={createWaterTanker}
          className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5"
        >
          <div>
            <Label htmlFor="tankerCode">Tanker code *</Label>
            <Input id="tankerCode" name="tankerCode" required className="mt-1" placeholder="WT-03" />
          </div>
          <div>
            <Label htmlFor="capacityLiters">Capacity (L) *</Label>
            <Input id="capacityLiters" name="capacityLiters" type="number" min={1} required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="driverId">Default driver</Label>
            <select
              id="driverId"
              name="driverId"
              className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
            >
              <option value="">None</option>
              {drivers.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name} ({d.employeeCode})
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="remarks">Remarks</Label>
            <Input id="remarks" name="remarks" className="mt-1" />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Add tanker
            </Button>
          </div>
        </form>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Fleet</h2>
        </div>
        {tankers.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No water tankers registered yet.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {tankers.map((tanker) => (
              <div key={tanker.id} className="px-5 py-4">
                {canManage ? (
                  <form action={updateWaterTanker} className="grid gap-3 lg:grid-cols-6">
                    <input type="hidden" name="id" value={tanker.id} />
                    <div>
                      <Label>Code</Label>
                      <Input name="tankerCode" defaultValue={tanker.tankerCode} required className="mt-1" />
                    </div>
                    <div>
                      <Label>Capacity (L)</Label>
                      <Input
                        name="capacityLiters"
                        type="number"
                        min={1}
                        defaultValue={tanker.capacityLiters}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Driver</Label>
                      <select
                        name="driverId"
                        defaultValue={tanker.driverId ?? ""}
                        className="mt-1 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                      >
                        <option value="">None</option>
                        {drivers.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Remarks</Label>
                      <Input name="remarks" defaultValue={tanker.remarks ?? ""} className="mt-1" />
                    </div>
                    <div className="flex items-end gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="isActive"
                          defaultChecked={tanker.isActive}
                          className="rounded border-slate-300"
                        />
                        Active
                      </label>
                    </div>
                    <div className="flex items-end">
                      <Button type="submit" variant="outline" className="w-full">
                        Save
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{tanker.tankerCode}</p>
                      <p className="text-sm text-slate-600">
                        {tanker.capacityLiters}L
                        {tanker.driver ? ` · ${tanker.driver.name}` : ""}
                      </p>
                    </div>
                    <Badge status={tanker.isActive ? "ACTIVE" : "INACTIVE"} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
