import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSocietyLetterhead } from "@/lib/print";
import { plotLabel } from "@/lib/plots";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { PrintDocument, PrintPageShell, PrintRow, PrintSection } from "@/components/print/print-document";

export const dynamic = "force-dynamic";

export default async function PaymentReceiptPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [payment, letterhead] = await Promise.all([
    prisma.payment.findUnique({
      where: { id },
      include: {
        plot: { select: { sector: true, block: true, plotNumber: true } },
        ownership: { select: { ownerName: true, membershipNumber: true, cnic: true } },
        transfer: { select: { transferNumber: true, sellerName: true, purchaserName: true } },
        openFile: { select: { openFileNumber: true, sellerName: true, dealerName: true } },
        feeConfig: { select: { name: true } },
        verifiedBy: { select: { name: true } },
        financeTransaction: { select: { txnNumber: true } },
      },
    }),
    getSocietyLetterhead(),
  ]);

  if (!payment) notFound();

  const payer =
    payment.ownership?.ownerName ||
    payment.transfer?.purchaserName ||
    payment.transfer?.sellerName ||
    payment.openFile?.sellerName ||
    "—";

  return (
    <PrintPageShell backHref="/payments" backLabel="Back to payments">
      <PrintDocument
        letterhead={letterhead}
        title="Payment Receipt"
        subtitle={`${labelize(payment.feeType)} · ${labelize(payment.status)}`}
        serialLabel="Receipt no."
        serial={payment.receiptNumber}
        date={payment.paymentDate ?? payment.verifiedAt ?? payment.createdAt}
        plot={payment.plot ? plotLabel(payment.plot) : null}
        parties={[
          { label: "Received from", value: payer },
          payment.ownership?.membershipNumber
            ? { label: "Membership", value: payment.ownership.membershipNumber }
            : { label: "Fee", value: payment.feeConfig?.name || labelize(payment.feeType) },
        ]}
        preparedBy={payment.verifiedBy?.name ?? "Accounts"}
        receivedBy={payer !== "—" ? payer : "Payee"}
      >
        <PrintSection title="Amount">
          <dl>
            <PrintRow label="Amount (PKR)" value={formatCurrency(payment.amount)} />
            {payment.poAmount != null ? (
              <PrintRow label="P.O. amount" value={formatCurrency(payment.poAmount)} />
            ) : null}
            <PrintRow label="Method" value={labelize(payment.paymentMethod)} />
            <PrintRow label="Status" value={labelize(payment.status)} />
          </dl>
        </PrintSection>
        <PrintSection title="Pay order / bank">
          <dl>
            <PrintRow label="P.O. number" value={payment.poNumber} />
            <PrintRow label="Bank" value={payment.bankName} />
            <PrintRow label="P.O. date" value={formatDate(payment.poDate)} />
          </dl>
        </PrintSection>
        {(payment.transfer || payment.openFile || payment.financeTransaction) && (
          <PrintSection title="Linked records">
            <dl>
              {payment.transfer ? (
                <PrintRow label="Transfer" value={payment.transfer.transferNumber} />
              ) : null}
              {payment.openFile ? (
                <PrintRow label="Open file" value={payment.openFile.openFileNumber} />
              ) : null}
              {payment.financeTransaction ? (
                <PrintRow label="Ledger" value={payment.financeTransaction.txnNumber} />
              ) : null}
            </dl>
          </PrintSection>
        )}
        {payment.remarks ? (
          <PrintSection title="Remarks">
            <p className="text-sm text-slate-800">{payment.remarks}</p>
          </PrintSection>
        ) : null}
      </PrintDocument>
    </PrintPageShell>
  );
}
