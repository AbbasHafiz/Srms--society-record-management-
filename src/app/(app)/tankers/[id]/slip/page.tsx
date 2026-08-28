import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSocietyLetterhead } from "@/lib/print";
import { PrintPageShell } from "@/components/print/print-document";
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

  const [booking, letterhead] = await Promise.all([
    prisma.tankerDelivery.findUnique({
      where: { id },
      include: {
        plot: { select: { sector: true, block: true, plotNumber: true, street: true } },
        tanker: { select: { tankerCode: true, capacityLiters: true } },
        driver: { select: { name: true, contact: true, employeeCode: true } },
        timeSlot: { select: { label: true, startTime: true, endTime: true } },
      },
    }),
    getSocietyLetterhead(),
  ]);

  if (!booking) notFound();

  return (
    <PrintPageShell
      paper="a5"
      autoPrint={autoPrint}
      backHref={`/tankers/${booking.id}`}
      backLabel={autoPrint ? "View booking details" : "Back to booking"}
    >
      <TankerBookingSlip letterhead={letterhead} booking={booking} />
    </PrintPageShell>
  );
}
