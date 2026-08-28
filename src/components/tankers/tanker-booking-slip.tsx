import type { Plot, TankerTimeSlot, WaterTanker, Employee } from "@/generated/prisma/client";
import type { TankerType } from "@/generated/prisma/client";
import { BookingNumberQr } from "@/components/tankers/booking-number-qr";
import { PrintDisclaimer, PrintLetterhead, PrintSignatures } from "@/components/print/print-document";
import { TANKER_TYPE_LABELS, formatTimeSlotLabel, formatTimeSlotWindow } from "@/lib/tankers";
import { formatCurrency, formatDate } from "@/lib/utils";
import { plotLabel } from "@/lib/plots";
import type { SocietyLetterhead } from "@/lib/print-shared";
import { SOCIETY_LETTERHEAD_DEFAULTS } from "@/lib/print-shared";

type TankerBookingSlipProps = {
  societyName?: string | null;
  letterhead?: SocietyLetterhead | null;
  booking: {
    bookingNumber: string;
    tankerType: TankerType;
    bookerName: string | null;
    bookerContact: string | null;
    customerName: string | null;
    houseNo: string | null;
    streetNo: string | null;
    streetArea: string | null;
    distributionDate: Date;
    slotLabel: string | null;
    slotStartTime: string | null;
    slotEndTime: string | null;
    charges: { toString(): string };
    plot: Pick<Plot, "sector" | "block" | "plotNumber" | "street"> | null;
    tanker: Pick<WaterTanker, "tankerCode" | "capacityLiters"> | null;
    driver: Pick<Employee, "name" | "contact" | "employeeCode"> | null;
    timeSlot: Pick<TankerTimeSlot, "label" | "startTime" | "endTime"> | null;
  };
};

function SlipRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="tanker-slip-row grid grid-cols-[9rem_1fr] gap-2 border-b border-slate-200 py-2 text-sm last:border-b-0">
      <dt className="font-medium text-slate-600">{label}</dt>
      <dd className="font-medium text-slate-900">{value || "—"}</dd>
    </div>
  );
}

function formatDestinationAddress(booking: TankerBookingSlipProps["booking"]) {
  const parts = [booking.houseNo, booking.streetNo, booking.streetArea].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : "—";
}

function formatTimeSlot(booking: TankerBookingSlipProps["booking"]) {
  if (booking.timeSlot) {
    return formatTimeSlotLabel(booking.timeSlot);
  }
  if (booking.slotLabel && booking.slotStartTime && booking.slotEndTime) {
    return `${booking.slotLabel} (${formatTimeSlotWindow(booking.slotStartTime, booking.slotEndTime)})`;
  }
  return "—";
}

export function TankerBookingSlip({ societyName, letterhead, booking }: TankerBookingSlipProps) {
  const header: SocietyLetterhead = letterhead ?? {
    name: societyName?.trim() || SOCIETY_LETTERHEAD_DEFAULTS.name,
    address: SOCIETY_LETTERHEAD_DEFAULTS.address,
    phone: SOCIETY_LETTERHEAD_DEFAULTS.phone,
  };
  const bookerName = booking.bookerName ?? booking.customerName ?? "—";
  const plotNo = booking.plot?.plotNumber ?? booking.houseNo ?? "—";
  const block = booking.plot?.block ?? booking.streetNo ?? "—";
  const sector = booking.plot?.sector ?? "—";
  const tankerAssignment = booking.tanker
    ? `${booking.tanker.tankerCode} (${booking.tanker.capacityLiters}L)`
    : null;
  const driverAssignment = booking.driver
    ? `${booking.driver.name}${booking.driver.contact ? ` · ${booking.driver.contact}` : ""}`
    : null;

  return (
    <article className="tanker-slip mx-auto max-w-[210mm] rounded-lg border border-slate-300 bg-white p-6 shadow-sm print:max-w-none print:rounded-none print:border-0 print:p-0 print:shadow-none">
      <PrintLetterhead
        letterhead={header}
        title="Water Tanker Delivery Slip"
        subtitle="Keep this slip for delivery"
      />

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Booking no.</p>
          <p className="font-mono text-2xl font-bold tracking-wide text-slate-900">{booking.bookingNumber}</p>
          <p className="mt-1 text-sm text-slate-600">{TANKER_TYPE_LABELS[booking.tankerType]}</p>
        </div>
        <BookingNumberQr bookingNumber={booking.bookingNumber} size={96} />
      </div>

      <section className="mt-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Booker</h2>
        <dl>
          <SlipRow label="Name" value={bookerName} />
          <SlipRow label="Contact" value={booking.bookerContact} />
        </dl>
      </section>

      <section className="mt-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Destination</h2>
        <dl>
          <SlipRow label="Address" value={formatDestinationAddress(booking)} />
          <SlipRow label="Plot no." value={plotNo} />
          <SlipRow label="House no." value={booking.houseNo} />
          <SlipRow label="Street no." value={booking.streetNo} />
          <SlipRow label="Block" value={block} />
          <SlipRow label="Sector" value={sector} />
          <SlipRow label="Street / area" value={booking.streetArea} />
          {booking.plot ? (
            <SlipRow label="Society plot" value={plotLabel(booking.plot)} />
          ) : null}
        </dl>
      </section>

      <section className="mt-4">
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Delivery schedule</h2>
        <dl>
          <SlipRow label="Date" value={formatDate(booking.distributionDate)} />
          <SlipRow label="Time slot" value={formatTimeSlot(booking)} />
        </dl>
      </section>

      {(tankerAssignment || driverAssignment) && (
        <section className="mt-4">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Assignment</h2>
          <dl>
            {tankerAssignment ? <SlipRow label="Tanker" value={tankerAssignment} /> : null}
            {driverAssignment ? <SlipRow label="Driver" value={driverAssignment} /> : null}
          </dl>
        </section>
      )}

      <section className="mt-4 border-t border-slate-200 pt-4">
        <dl>
          <SlipRow label="Charges" value={formatCurrency(booking.charges)} />
        </dl>
      </section>

      <PrintSignatures
        preparedBy="Tanker desk"
        receivedBy={bookerName !== "—" ? bookerName : "Booker"}
      />
      <PrintDisclaimer extra="Please keep this slip and present it at delivery." />
    </article>
  );
}
