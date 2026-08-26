import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSocietyName } from "@/lib/system-settings";
import { PrintSlipActions } from "@/components/tankers/print-slip-actions";
import { TankerBookingSlip } from "@/components/tankers/tanker-booking-slip";

export const dynamic = "force-dynamic";

export default async function TankerBookingSlipPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const autoPrint = sp.new === "1";

  const [booking, societyName] = await Promise.all([
    prisma.tankerDelivery.findUnique({
      where: { id },
      include: {
        plot: { select: { sector: true, block: true, plotNumber: true, street: true } },
        tanker: { select: { tankerCode: true, capacityLiters: true } },
        driver: { select: { name: true, contact: true, employeeCode: true } },
        timeSlot: { select: { label: true, startTime: true, endTime: true } },
      },
    }),
    getSocietyName(),
  ]);

  if (!booking) notFound();

  return (
    <div className="tanker-slip-page">
      <PrintSlipActions
        autoPrint={autoPrint}
        backHref={`/tankers/${booking.id}`}
        backLabel={autoPrint ? "View booking details" : "Back to booking"}
      />
      <TankerBookingSlip societyName={societyName} booking={booking} />
    </div>
  );
}
