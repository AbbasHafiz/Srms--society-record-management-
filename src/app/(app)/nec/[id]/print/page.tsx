import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSocietyLetterhead } from "@/lib/print";
import { plotLabel, plotTypeLabel } from "@/lib/plots";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { plotSizeDisplay } from "@/lib/property-sizes";
import { PrintDocument, PrintPageShell, PrintRow, PrintSection } from "@/components/print/print-document";

export const dynamic = "force-dynamic";

export default async function NecPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [nec, letterhead] = await Promise.all([
    prisma.nec.findUnique({
      where: { id },
      include: {
        plot: true,
        ownership: true,
        approvedBy: { select: { name: true } },
      },
    }),
    getSocietyLetterhead(),
  ]);

  if (!nec) notFound();

  const issued = nec.status === "ISSUED";

  return (
    <PrintPageShell backHref={`/nec/${nec.id}`} backLabel="Back to NEC">
      <PrintDocument
        letterhead={letterhead}
        title={issued ? "No Encumbrance Certificate" : "NEC Application"}
        subtitle={issued ? "Issued by the society" : `Status: ${labelize(nec.status)} — not yet issued`}
        serialLabel={issued ? "NEC no." : "Application no."}
        serial={nec.necNumber || nec.applicationNumber}
        date={nec.issueDate ?? nec.applicationDate}
        plot={plotLabel(nec.plot)}
        parties={[
          { label: "Applicant", value: nec.applicantName },
          { label: "Membership", value: nec.ownership?.membershipNumber || "—" },
        ]}
        preparedBy={nec.approvedBy?.name || "Records"}
        receivedBy={nec.applicantName}
      >
        <PrintSection title="Certificate">
          <dl>
            <PrintRow label="Application" value={nec.applicationNumber} />
            <PrintRow label="Applied on" value={formatDate(nec.applicationDate)} />
            <PrintRow label="Issued on" value={formatDate(nec.issueDate)} />
            <PrintRow label="Valid until" value={formatDate(nec.expiryDate)} />
            <PrintRow label="Status" value={labelize(nec.status)} />
          </dl>
        </PrintSection>
        <PrintSection title="Plot">
          <dl>
            <PrintRow label="Property type" value={plotTypeLabel(nec.plot.plotType)} />
            <PrintRow label="Size" value={plotSizeDisplay(nec.plot)} />
            <PrintRow
              label="Owner"
              value={nec.ownership ? `${nec.ownership.ownerName} · ${nec.ownership.cnic}` : "—"}
            />
            <PrintRow
              label="Active mortgage"
              value={nec.plot.hasActiveMortgage ? "Yes — verify bank charge before relying on this NEC" : "None recorded"}
            />
          </dl>
        </PrintSection>
        <PrintSection title="Fee">
          <dl>
            <PrintRow label="Fee (PKR)" value={nec.fee ? formatCurrency(nec.fee) : "—"} />
            <PrintRow label="Payment" value={labelize(nec.paymentStatus)} />
          </dl>
        </PrintSection>
        {issued ? (
          <p className="mt-4 text-sm text-slate-800">
            Based on society records as at the issue date, no encumbrance other than any mortgage or
            charge noted above is recorded against this plot. This certificate does not replace a
            search at the land revenue office or a bank confirmation.
          </p>
        ) : (
          <p className="mt-4 text-sm text-amber-900">
            This print is an application copy only. It is not a valid NEC until issued and stamped.
          </p>
        )}
        {nec.remarks ? (
          <PrintSection title="Remarks">
            <p className="text-sm text-slate-800">{nec.remarks}</p>
          </PrintSection>
        ) : null}
      </PrintDocument>
    </PrintPageShell>
  );
}
