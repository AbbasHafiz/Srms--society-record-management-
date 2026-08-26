import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TankerDestinationFields } from "@/components/tankers/tanker-destination-fields";
import { TankerScheduleFields } from "@/components/tankers/tanker-schedule-fields";
import { updateTankerBooking } from "../actions";
import {
  formatTimeSlotLabel,
  formatTimeSlotWindow,
  listActiveTankers,
  listTankerDrivers,
  TANKER_TYPE_LABELS,
  tankerTypeBadgeClass,
} from "@/lib/tankers";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { plotLabel } from "@/lib/plots";
import { WhatsAppNotifyAction } from "@/components/whatsapp/whatsapp-notify-action";
import { format } from "date-fns";

export const dynamic = "force-dynamic";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-slate-900 sm:text-right">{value}</dd>
    </div>
  );
}

export default async function TankerBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const canEdit = session?.user && hasPermission(session.user.role, "edit");

  const [booking, tankers, drivers] = await Promise.all([
    prisma.tankerDelivery.findUnique({
      where: { id },
      include: {
        plot: true,
        tanker: true,
        driver: true,
        timeSlot: true,
        bookedBy: { select: { name: true } },
        feeConfig: { select: { name: true } },
      },
    }),
    listActiveTankers(),
    listTankerDrivers(),
  ]);

  if (!booking) notFound();

  const slotDisplay =
    booking.timeSlot
      ? formatTimeSlotLabel(booking.timeSlot)
      : booking.slotLabel && booking.slotStartTime && booking.slotEndTime
        ? `${booking.slotLabel} (${formatTimeSlotWindow(booking.slotStartTime, booking.slotEndTime)})`
        : "—";

  const distributionDateValue = format(booking.distributionDate, "yyyy-MM-dd");
  const plotLabelText = booking.plot ? plotLabel(booking.plot) : null;

  return (
    <div>
      <div className="mb-4">
        <Link href={`/tankers?date=${booking.distributionDate.toISOString().slice(0, 10)}`} className="text-sm text-teal-800 hover:underline">
          ← Daily schedule
        </Link>
      </div>

      <PageHeader
        title={booking.bookingNumber}
        description={`${TANKER_TYPE_LABELS[booking.tankerType]} delivery`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/tankers/${booking.id}/slip`}>
              <Button type="button" variant="outline">
                Print slip
              </Button>
            </Link>
            {session?.user ? (
              <WhatsAppNotifyAction
                userRole={session.user.role}
                relatedModule="tankers"
                relatedRecordId={booking.id}
                plotId={booking.plotId ?? undefined}
                defaultTemplateKey={
                  booking.status === "IN_PROGRESS"
                    ? "tanker_out_for_delivery"
                    : booking.driverId
                      ? "tanker_assigned_driver"
                      : "tanker_confirmed"
                }
                templateVars={{
                  bookingNumber: booking.bookingNumber,
                  distributionDate: formatDate(booking.distributionDate),
                  slotLabel: slotDisplay,
                  amount: formatCurrency(booking.charges),
                  driverName: booking.driver?.name ?? "",
                }}
                presets={[
                  ...(booking.bookerContact && booking.bookerName
                    ? [
                        {
                          key: "booker",
                          label: "Booker",
                          name: booking.bookerName,
                          phone: booking.bookerContact,
                          type: "BOOKER" as const,
                        },
                      ]
                    : []),
                  ...(booking.driver?.contact
                    ? [
                        {
                          key: "driver",
                          label: "Driver",
                          name: booking.driver.name,
                          phone: booking.driver.contact,
                          type: "EMPLOYEE" as const,
                          employeeId: booking.driver.id,
                        },
                      ]
                    : []),
                ]}
                allowedModes={["preset", "custom"]}
              />
            ) : null}
            <Badge status={booking.status} />
            <Badge status={booking.paymentStatus} />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display mb-4 text-lg font-semibold">Booking details</h2>
          <dl className="space-y-3 text-sm">
            <Row label="Booker" value={booking.bookerName ?? booking.customerName ?? "—"} />
            <Row label="Contact" value={booking.bookerContact ?? "—"} />
            <Row
              label="Address"
              value={[booking.houseNo, booking.streetNo, booking.streetArea].filter(Boolean).join(", ") || "—"}
            />
            <Row label="Delivery date" value={formatDate(booking.distributionDate)} />
            <Row label="Time slot" value={slotDisplay} />
            <Row
              label="Type"
              value={
                <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${tankerTypeBadgeClass(booking.tankerType)}`}>
                  {TANKER_TYPE_LABELS[booking.tankerType]}
                </span>
              }
            />
            <Row label="Charges (snapshot)" value={formatCurrency(booking.charges)} />
            <Row label="Receipt" value={booking.receiptNumber ?? "—"} />
            <Row label="Booked by" value={booking.bookedBy?.name ?? "—"} />
            {booking.remarks ? <Row label="Remarks" value={booking.remarks} /> : null}
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display mb-4 text-lg font-semibold">Plot & assignment</h2>
          <dl className="space-y-3 text-sm">
            <Row
              label="Plot"
              value={
                booking.plot ? (
                  <Link href={`/plots/${booking.plotId}`} className="text-teal-900 hover:underline">
                    {plotLabel(booking.plot)}
                  </Link>
                ) : (
                  "Walk-in / no plot linked"
                )
              }
            />
            <Row
              label="Tanker"
              value={
                booking.tanker
                  ? `${booking.tanker.tankerCode} (${booking.tanker.capacityLiters}L)`
                  : "Not assigned"
              }
            />
            <Row label="Driver" value={booking.driver?.name ?? "Not assigned"} />
            <Row label="Fee config" value={booking.feeConfig?.name ?? "—"} />
          </dl>
        </section>

        {canEdit ? (
          <>
            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="font-display mb-4 text-lg font-semibold">Edit booking details</h2>
              <form action={updateTankerBooking} className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="id" value={booking.id} />
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Booker name *</span>
                  <input
                    name="bookerName"
                    required
                    defaultValue={booking.bookerName ?? booking.customerName ?? ""}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Contact</span>
                  <input
                    name="bookerContact"
                    defaultValue={booking.bookerContact ?? ""}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  />
                </label>

                <TankerDestinationFields
                  initialMode={booking.plotId ? "plot" : "house"}
                  initialPlotId={booking.plotId}
                  initialPlotLabel={plotLabelText}
                  initialHouseNo={booking.houseNo}
                  initialStreetNo={booking.streetNo}
                  initialStreetArea={booking.streetArea}
                />

                <TankerScheduleFields
                  initialDate={distributionDateValue}
                  initialTimeSlotId={booking.timeSlotId}
                  excludeBookingId={booking.id}
                />

                <div className="sm:col-span-2">
                  <Button type="submit">Save booking details</Button>
                </div>
              </form>
            </section>

            <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
              <h2 className="font-display mb-4 text-lg font-semibold">Update assignment & status</h2>
              <form action={updateTankerBooking} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <input type="hidden" name="id" value={booking.id} />
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Status</span>
                  <select name="status" defaultValue={booking.status} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                    {["SCHEDULED", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"].map((s) => (
                      <option key={s} value={s}>{labelize(s)}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Payment</span>
                  <select name="paymentStatus" defaultValue={booking.paymentStatus} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                    {["UNPAID", "PENDING", "PAID", "VERIFIED", "PARTIAL"].map((s) => (
                      <option key={s} value={s}>{labelize(s)}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Receipt no.</span>
                  <input
                    name="receiptNumber"
                    defaultValue={booking.receiptNumber ?? ""}
                    className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  />
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Tanker</span>
                  <select name="tankerId" defaultValue={booking.tankerId ?? ""} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                    <option value="">Unassigned</option>
                    {tankers.map((t) => (
                      <option key={t.id} value={t.id}>{t.tankerCode}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm">
                  <span className="mb-1 block font-medium text-slate-700">Driver</span>
                  <select name="driverId" defaultValue={booking.driverId ?? ""} className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm">
                    <option value="">Unassigned</option>
                    {drivers.map((d) => (
                      <option key={d.id} value={d.id}>{d.name}</option>
                    ))}
                  </select>
                </label>
                <label className="text-sm sm:col-span-2 lg:col-span-3">
                  <span className="mb-1 block font-medium text-slate-700">Remarks</span>
                  <textarea
                    name="remarks"
                    defaultValue={booking.remarks ?? ""}
                    rows={2}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </label>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Button type="submit">Save changes</Button>
                </div>
              </form>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
