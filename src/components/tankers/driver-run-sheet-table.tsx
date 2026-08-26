import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { DriverStatusActions } from "@/components/tankers/driver-status-actions";
import {
  formatTimeSlotLabel,
  TANKER_TYPE_LABELS,
  tankerTypeBadgeClass,
  type DriverRunSheetSlotGroup,
  type DriverRunSheetTankerGroup,
} from "@/lib/tankers";
import { formatCurrency } from "@/lib/utils";

function TankerGroupTable({
  group,
  slotLabel,
  returnTo,
  canEdit,
  showDriver,
}: {
  group: DriverRunSheetTankerGroup;
  slotLabel: string;
  returnTo: string;
  canEdit: boolean;
  showDriver: boolean;
}) {
  if (group.deliveries.length === 0) return null;

  return (
    <div className="mb-4 last:mb-0">
      <h4 className="mb-2 text-sm font-medium text-slate-700">
        {group.tanker ? (
          <>
            Tanker {group.tanker.tankerCode}
            <span className="ml-1 font-normal text-slate-500">({group.tanker.capacityLiters}L)</span>
          </>
        ) : (
          <span className="text-amber-800">Unassigned tanker</span>
        )}
      </h4>
      <div className="overflow-x-auto">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time slot</th>
              <th>Booking</th>
              <th>Booker</th>
              <th>Contact</th>
              <th>Plot / House</th>
              <th>Street</th>
              <th>Block</th>
              <th>Type</th>
              {showDriver ? <th>Driver</th> : null}
              <th>Status</th>
              <th>Charges</th>
              {canEdit ? <th>Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {group.deliveries.map((d) => (
              <tr key={d.id}>
                <td className="whitespace-nowrap text-sm">{slotLabel}</td>
                <td>
                  <Link href={`/tankers/${d.id}`} className="font-medium text-teal-900 hover:underline">
                    {d.bookingNumber}
                  </Link>
                </td>
                <td>{d.bookerName ?? "—"}</td>
                <td className="whitespace-nowrap">{d.bookerContact ?? "—"}</td>
                <td>{d.plotHouse}</td>
                <td>{d.street}</td>
                <td>{d.block}</td>
                <td>
                  <span
                    className={`inline-flex rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${tankerTypeBadgeClass(d.tankerType)}`}
                  >
                    {TANKER_TYPE_LABELS[d.tankerType]}
                  </span>
                </td>
                {showDriver ? <td>{d.driver?.name ?? "—"}</td> : null}
                <td>
                  <Badge status={d.status} />
                </td>
                <td className="whitespace-nowrap">{formatCurrency(d.charges)}</td>
                {canEdit ? (
                  <td>
                    <DriverStatusActions
                      bookingId={d.id}
                      status={d.status}
                      returnTo={returnTo}
                      canEdit={canEdit}
                    />
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function DriverRunSheetContent({
  slots,
  unslotted,
  returnTo,
  canEdit,
  showDriver,
  compact = false,
}: {
  slots: DriverRunSheetSlotGroup[];
  unslotted: DriverRunSheetTankerGroup[];
  returnTo: string;
  canEdit: boolean;
  showDriver: boolean;
  compact?: boolean;
}) {
  const slotsWithBookings = slots.filter((s) => s.deliveryCount > 0);
  const unslottedCount = unslotted.reduce((sum, g) => sum + g.deliveries.length, 0);
  const totalCount =
    slotsWithBookings.reduce((sum, s) => sum + s.deliveryCount, 0) + unslottedCount;

  if (totalCount === 0) {
    return <p className="text-sm text-slate-500">No deliveries scheduled for this date.</p>;
  }

  return (
    <div className={compact ? "space-y-4" : "space-y-6"}>
      {slotsWithBookings.map(({ slot, tankerGroups }) => {
        const slotLabel = formatTimeSlotLabel(slot);
        return (
          <section
            key={slot.id}
            className={compact ? "" : "overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"}
          >
            {!compact ? (
              <div className="border-b border-slate-100 px-5 py-4">
                <h3 className="font-display text-lg font-semibold">{slotLabel}</h3>
              </div>
            ) : (
              <h3 className="mb-2 font-display text-base font-semibold">{slotLabel}</h3>
            )}
            <div className={compact ? "" : "px-5 py-4"}>
              {tankerGroups.map((group) => (
                <TankerGroupTable
                  key={group.tanker?.id ?? "unassigned"}
                  group={group}
                  slotLabel={slotLabel}
                  returnTo={returnTo}
                  canEdit={canEdit}
                  showDriver={showDriver}
                />
              ))}
            </div>
          </section>
        );
      })}

      {unslottedCount > 0 ? (
        <section
          className={
            compact
              ? ""
              : "overflow-hidden rounded-xl border border-amber-200 bg-amber-50/40 shadow-sm"
          }
        >
          {!compact ? (
            <div className="border-b border-amber-100 px-5 py-4">
              <h3 className="font-display text-lg font-semibold text-amber-950">Without time slot</h3>
            </div>
          ) : (
            <h3 className="mb-2 font-display text-base font-semibold">Without time slot</h3>
          )}
          <div className={compact ? "" : "px-5 py-4"}>
            {unslotted.map((group) => (
              <TankerGroupTable
                key={group.tanker?.id ?? "unassigned-unslotted"}
                group={group}
                slotLabel="—"
                returnTo={returnTo}
                canEdit={canEdit}
                showDriver={showDriver}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
