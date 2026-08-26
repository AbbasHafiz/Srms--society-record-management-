import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { PageHeader, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import {
  formatTimeSlotLabel,
  formatTimeSlotWindow,
  getDailySchedule,
  TANKER_TYPE_LABELS,
  tankerTypeBadgeClass,
} from "@/lib/tankers";
import { format, parseISO, startOfDay } from "date-fns";

export const dynamic = "force-dynamic";

function parseScheduleDate(value?: string) {
  if (!value) return startOfDay(new Date());
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? startOfDay(new Date()) : startOfDay(parsed);
}

export default async function TankersPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const scheduleDate = parseScheduleDate(sp.date);
  const dateParam = format(scheduleDate, "yyyy-MM-dd");
  const session = await auth();
  const canCreate = session?.user && hasPermission(session.user.role, "create");

  const [schedule, scheduled, completed, collection] = await Promise.all([
    getDailySchedule(scheduleDate),
    prisma.tankerDelivery.count({
      where: {
        distributionDate: scheduleDate,
        status: { in: ["SCHEDULED", "ASSIGNED"] },
      },
    }),
    prisma.tankerDelivery.count({
      where: { distributionDate: scheduleDate, status: "COMPLETED" },
    }),
    prisma.tankerDelivery.aggregate({
      where: {
        distributionDate: scheduleDate,
        paymentStatus: { in: ["PAID", "VERIFIED"] },
      },
      _sum: { charges: true },
    }),
  ]);

  const isToday = scheduleDate.getTime() === startOfDay(new Date()).getTime();

  return (
    <div>
      <PageHeader
        title="Water Tankers"
        description={`Daily delivery schedule${isToday ? " — today" : ""} (${scheduleDate.toLocaleDateString("en-GB")})`}
        actions={
          canCreate ? (
            <Link href="/tankers/new">
              <Button>New booking</Button>
            </Link>
          ) : null
        }
      />

      <form action="/tankers" method="get" className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-slate-700">Schedule date</span>
          <input
            type="date"
            name="date"
            defaultValue={dateParam}
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          />
        </label>
        <Button type="submit">View schedule</Button>
        {!isToday ? (
          <Link href="/tankers" className="text-sm text-teal-800 hover:underline">
            Jump to today
          </Link>
        ) : null}
      </form>

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Scheduled / Assigned" value={scheduled} />
        <StatCard label="Completed" value={completed} tone="success" />
        <StatCard
          label="Collection"
          value={formatCurrency(collection._sum.charges ?? 0)}
          tone="success"
        />
      </div>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="font-display text-lg font-semibold">Delivery time slots</h2>
          <p className="text-sm text-slate-500">
            Bookings grouped by configured delivery window — tanker and driver assignments shown per slot.
          </p>
        </div>

        {schedule.slots.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No delivery time slots configured.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {schedule.slots.map(({ slot, deliveries, booked, remaining }) => (
              <div key={slot.id} className="px-5 py-4">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="font-medium text-slate-900">{formatTimeSlotLabel(slot)}</h3>
                    <p className="text-xs text-slate-500">
                      Capacity: {booked}/{slot.maxBookingsPerDay} bookings
                      {slot.maxPerTanker ? ` · max ${slot.maxPerTanker} per tanker` : null}
                    </p>
                  </div>
                  <Badge className={remaining > 0 ? "bg-emerald-50 text-emerald-800 border-emerald-200" : "bg-rose-50 text-rose-800 border-rose-200"}>
                    {remaining > 0 ? `${remaining} slot${remaining === 1 ? "" : "s"} left` : "Full"}
                  </Badge>
                </div>

                {deliveries.length === 0 ? (
                  <p className="text-sm text-slate-500">No bookings in this window.</p>
                ) : (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Booking</th>
                        <th>Customer / Plot</th>
                        <th>Tanker</th>
                        <th>Driver</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deliveries.map((d) => (
                        <tr key={d.id}>
                          <td>
                            <Link href={`/tankers/${d.id}`} className="font-medium text-teal-900 hover:underline">
                              {d.bookingNumber}
                            </Link>
                            <div className="mt-0.5">
                              <span className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${tankerTypeBadgeClass(d.tankerType)}`}>
                                {TANKER_TYPE_LABELS[d.tankerType]}
                              </span>
                            </div>
                          </td>
                          <td>
                            {d.plot ? (
                              <Link href={`/plots/${d.plotId}`} className="text-teal-900 hover:underline">
                                {d.plot.sector}/{d.plot.block}-{d.plot.plotNumber}
                              </Link>
                            ) : (
                              <div>
                                <div className="font-medium">{d.bookerName ?? d.customerName ?? "—"}</div>
                                {(d.houseNo || d.streetNo || d.streetArea) ? (
                                  <div className="text-xs text-slate-500">
                                    {[d.houseNo, d.streetNo, d.streetArea].filter(Boolean).join(", ")}
                                  </div>
                                ) : null}
                              </div>
                            )}
                          </td>
                          <td>
                            {d.tanker ? (
                              <>
                                <div className="font-medium">{d.tanker.tankerCode}</div>
                                <div className="text-xs text-slate-500">{d.tanker.capacityLiters}L</div>
                              </>
                            ) : (
                              <span className="text-slate-400">Unassigned</span>
                            )}
                          </td>
                          <td>
                            {d.driver ? (
                              <>
                                <div className="font-medium">{d.driver.name}</div>
                                <div className="text-xs text-slate-500">{d.driver.employeeCode}</div>
                              </>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td>
                            <Badge status={d.status} />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {schedule.unslotted.length > 0 ? (
        <section className="mt-6 overflow-hidden rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm">
          <div className="border-b border-amber-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold text-amber-950">Without time slot</h2>
            <p className="text-sm text-amber-900/80">Legacy or unassigned bookings for this date.</p>
          </div>
          <table className="data-table">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Customer</th>
                <th>Window</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {schedule.unslotted.map((d) => (
                <tr key={d.id}>
                  <td>
                    <Link href={`/tankers/${d.id}`} className="text-teal-900 hover:underline">
                      {d.bookingNumber}
                    </Link>
                  </td>
                  <td>{d.bookerName ?? d.customerName ?? "—"}</td>
                  <td>
                    {d.slotLabel && d.slotStartTime && d.slotEndTime
                      ? `${d.slotLabel} (${formatTimeSlotWindow(d.slotStartTime, d.slotEndTime)})`
                      : "—"}
                  </td>
                  <td>
                    <Badge status={d.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
