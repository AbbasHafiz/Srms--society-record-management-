import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import {
  formatTimeSlotLabel,
  formatTimeSlotWindow,
  tankerBookerLabel,
  tankerDestinationLabel,
  type DailySchedule,
} from "@/lib/tankers";

function whenToDeliver(d: DailySchedule["slots"][number]["deliveries"][number]) {
  if (d.timeSlot) return formatTimeSlotLabel(d.timeSlot);
  if (d.slotLabel && d.slotStartTime && d.slotEndTime) {
    return `${d.slotLabel} (${formatTimeSlotWindow(d.slotStartTime, d.slotEndTime)})`;
  }
  return "—";
}

function BookingTable({
  deliveries,
}: {
  deliveries: DailySchedule["slots"][number]["deliveries"];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="data-table">
        <thead>
          <tr>
            <th>Booking</th>
            <th>Booker</th>
            <th>Destination</th>
            <th>When to deliver</th>
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
              </td>
              <td>
                <div className="font-medium">{tankerBookerLabel(d)}</div>
                {d.bookerContact ? <div className="text-xs text-slate-500">{d.bookerContact}</div> : null}
              </td>
              <td>
                {d.plot ? (
                  <Link href={`/plots/${d.plotId}`} className="text-teal-900 hover:underline">
                    {tankerDestinationLabel(d)}
                  </Link>
                ) : (
                  tankerDestinationLabel(d)
                )}
              </td>
              <td className="whitespace-nowrap">{whenToDeliver(d)}</td>
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
    </div>
  );
}

export function TankerScheduleBookings({
  schedule,
  compact = false,
  emptyMessage = "No bookings of this type for this date.",
}: {
  schedule: DailySchedule;
  compact?: boolean;
  emptyMessage?: string;
}) {
  const slottedCount = schedule.slots.reduce((sum, s) => sum + s.deliveries.length, 0);
  const total = slottedCount + schedule.unslotted.length;

  if (total === 0) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {schedule.slots
        .filter(({ deliveries }) => deliveries.length > 0)
        .map(({ slot, deliveries, remaining }) => (
        <div key={slot.id}>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="font-medium text-slate-900">{formatTimeSlotLabel(slot)}</h3>
              <p className="text-xs text-slate-500">
                {deliveries.length} {deliveries.length === 1 ? "booking" : "bookings"} this type
                {slot.maxPerTanker ? ` · max ${slot.maxPerTanker} per tanker` : null}
              </p>
            </div>
            <Badge
              className={
                remaining > 0
                  ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                  : "bg-rose-50 text-rose-800 border-rose-200"
              }
            >
              {remaining > 0 ? `${remaining} slot${remaining === 1 ? "" : "s"} left overall` : "Slot full"}
            </Badge>
          </div>
          <BookingTable deliveries={deliveries} />
        </div>
      ))}

      {schedule.unslotted.length > 0 ? (
        <div>
          <h3 className="mb-2 font-medium text-amber-950">Without time slot</h3>
          <BookingTable deliveries={schedule.unslotted} />
        </div>
      ) : null}
    </div>
  );
}
