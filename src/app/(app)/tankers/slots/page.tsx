import Link from "next/link";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createTankerTimeSlot, updateTankerTimeSlot } from "../actions";
import { TankerNav } from "@/components/tankers/tanker-nav";
import { formatTimeSlotLabel, listAllTimeSlots } from "@/lib/tankers";

export const dynamic = "force-dynamic";

export default async function TankerSlotsPage() {
  const session = await auth();
  const canManage = session?.user && hasPermission(session.user.role, "edit");

  const slots = await listAllTimeSlots();

  return (
    <div>
      <PageHeader
        title="Water Tankers"
        description="Configure daily delivery windows, per-slot capacity, and per-tanker limits."
      />

      <TankerNav active="slots" />

      {canManage ? (
        <form
          action={createTankerTimeSlot}
          className="mb-6 grid gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-7"
        >
          <div>
            <Label htmlFor="label">Label *</Label>
            <Input id="label" name="label" required className="mt-1" placeholder="Morning" />
          </div>
          <div>
            <Label htmlFor="startTime">Start *</Label>
            <Input id="startTime" name="startTime" type="time" required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="endTime">End *</Label>
            <Input id="endTime" name="endTime" type="time" required className="mt-1" />
          </div>
          <div>
            <Label htmlFor="maxBookingsPerDay">Max / day</Label>
            <Input id="maxBookingsPerDay" name="maxBookingsPerDay" type="number" min={1} defaultValue={8} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="maxPerTanker">Max / tanker</Label>
            <Input id="maxPerTanker" name="maxPerTanker" type="number" min={1} defaultValue={2} className="mt-1" />
          </div>
          <div>
            <Label htmlFor="sortOrder">Sort order</Label>
            <Input id="sortOrder" name="sortOrder" type="number" defaultValue={slots.length} className="mt-1" />
          </div>
          <div className="flex items-end">
            <Button type="submit" className="w-full">
              Add slot
            </Button>
          </div>
        </form>
      ) : null}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Configured slots</h2>
        </div>
        {slots.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No delivery time slots configured.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {slots.map((slot) => (
              <div key={slot.id} className="px-5 py-4">
                {canManage ? (
                  <form action={updateTankerTimeSlot} className="grid gap-3 lg:grid-cols-8">
                    <input type="hidden" name="id" value={slot.id} />
                    <div className="lg:col-span-2">
                      <Label>Label</Label>
                      <Input name="label" defaultValue={slot.label} required className="mt-1" />
                    </div>
                    <div>
                      <Label>Start</Label>
                      <Input name="startTime" type="time" defaultValue={slot.startTime} required className="mt-1" />
                    </div>
                    <div>
                      <Label>End</Label>
                      <Input name="endTime" type="time" defaultValue={slot.endTime} required className="mt-1" />
                    </div>
                    <div>
                      <Label>Max / day</Label>
                      <Input
                        name="maxBookingsPerDay"
                        type="number"
                        min={1}
                        defaultValue={slot.maxBookingsPerDay}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Max / tanker</Label>
                      <Input
                        name="maxPerTanker"
                        type="number"
                        min={1}
                        defaultValue={slot.maxPerTanker}
                        required
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label>Sort</Label>
                      <Input name="sortOrder" type="number" defaultValue={slot.sortOrder} className="mt-1" />
                    </div>
                    <div className="flex items-end justify-between gap-3">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          name="isActive"
                          defaultChecked={slot.isActive}
                          className="rounded border-slate-300"
                        />
                        Active
                      </label>
                      <Button type="submit" variant="outline">
                        Save
                      </Button>
                    </div>
                  </form>
                ) : (
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-900">{formatTimeSlotLabel(slot)}</p>
                      <p className="text-sm text-slate-600">
                        Max {slot.maxBookingsPerDay}/day · {slot.maxPerTanker} per tanker
                      </p>
                    </div>
                    <Badge status={slot.isActive ? "ACTIVE" : "INACTIVE"} />
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
