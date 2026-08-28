import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { formatCalendarPeriod, getSocietyLetterhead } from "@/lib/print";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { PrintDocument, PrintPageShell, PrintRow, PrintSection } from "@/components/print/print-document";

export const dynamic = "force-dynamic";

export default async function OfficeRentReceiptPrintPage({
  params,
}: {
  params: Promise<{ id: string; chargeId: string }>;
}) {
  const { id, chargeId } = await params;
  const [charge, letterhead] = await Promise.all([
    prisma.officeRentCharge.findUnique({
      where: { id: chargeId },
      include: {
        registeredOffice: {
          include: { plot: { select: { sector: true, block: true, plotNumber: true } } },
        },
      },
    }),
    getSocietyLetterhead(),
  ]);

  if (!charge || charge.registeredOfficeId !== id) notFound();

  const office = charge.registeredOffice;

  return (
    <PrintPageShell backHref={`/offices/${office.id}`} backLabel="Back to office">
      <PrintDocument
        letterhead={letterhead}
        title="Office Rent Receipt"
        subtitle={`${office.officeName} · ${labelize(charge.status)}`}
        serialLabel="Period"
        serial={formatCalendarPeriod(charge.year, charge.month)}
        date={charge.paidAt ?? charge.dueDate ?? charge.createdAt}
        plot={office.plot ? `${office.plot.sector}/${office.plot.block}-${office.plot.plotNumber}` : null}
        parties={[
          { label: "Office", value: office.officeName },
          { label: "Owner / dealer", value: `${office.ownerName} · ${office.phone}` },
        ]}
        preparedBy="Accounts"
        receivedBy={office.ownerName}
      >
        <PrintSection title="Charge">
          <dl>
            <PrintRow label="Period" value={formatCalendarPeriod(charge.year, charge.month)} />
            <PrintRow label="Amount (PKR)" value={formatCurrency(charge.amount)} />
            <PrintRow label="Rate snapshot" value={formatCurrency(charge.amountSnapshot)} />
            <PrintRow label="Due date" value={formatDate(charge.dueDate)} />
            <PrintRow label="Status" value={labelize(charge.status)} />
            <PrintRow label="Paid on" value={formatDate(charge.paidAt)} />
          </dl>
        </PrintSection>
        {charge.remarks ? (
          <PrintSection title="Remarks">
            <p className="text-sm text-slate-800">{charge.remarks}</p>
          </PrintSection>
        ) : null}
      </PrintDocument>
    </PrintPageShell>
  );
}
