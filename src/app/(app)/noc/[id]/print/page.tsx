import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSocietyLetterhead } from "@/lib/print";
import { plotLabel, plotTypeLabel } from "@/lib/plots";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { CONSTRUCTION_TYPE_LABELS, NOC_PURPOSE_LABELS, plotSizeDisplay } from "@/lib/property-sizes";
import { PrintDocument, PrintPageShell, PrintRow, PrintSection } from "@/components/print/print-document";

export const dynamic = "force-dynamic";

export default async function NocPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [noc, letterhead] = await Promise.all([
    prisma.noc.findUnique({
      where: { id },
      include: {
        plot: true,
        ownership: true,
        approvedBy: { select: { name: true } },
        powerOfAttorney: true,
      },
    }),
    getSocietyLetterhead(),
  ]);

  if (!noc) notFound();

  const issued = noc.status === "ISSUED";
  const purpose = NOC_PURPOSE_LABELS[noc.purpose] ?? labelize(noc.purpose);

  return (
    <PrintPageShell backHref={`/noc/${noc.id}`} backLabel="Back to NOC">
      <PrintDocument
        letterhead={letterhead}
        title={issued ? "No Objection Certificate" : "NOC Application"}
        subtitle={issued ? "Issued by the society" : `Status: ${labelize(noc.status)} — not yet issued`}
        serialLabel={issued ? "NOC no." : "Application no."}
        serial={noc.nocNumber || noc.applicationNumber}
        date={noc.issueDate ?? noc.applicationDate}
        plot={plotLabel(noc.plot)}
        parties={[
          { label: "Applicant", value: noc.applicantName },
          { label: "Membership", value: noc.ownership?.membershipNumber || "—" },
        ]}
        preparedBy={noc.approvedBy?.name || "Records"}
        receivedBy={noc.applicantName}
      >
        <PrintSection title="Certificate">
          <dl>
            <PrintRow label="Application" value={noc.applicationNumber} />
            <PrintRow label="Purpose" value={purpose} />
            {noc.constructionType ? (
              <PrintRow
                label="Construction"
                value={CONSTRUCTION_TYPE_LABELS[noc.constructionType] ?? labelize(noc.constructionType)}
              />
            ) : null}
            {noc.customType ? <PrintRow label="Other type" value={noc.customType} /> : null}
            <PrintRow label="Applied on" value={formatDate(noc.applicationDate)} />
            <PrintRow label="Issued on" value={formatDate(noc.issueDate)} />
            <PrintRow label="Valid until" value={formatDate(noc.expiryDate)} />
            <PrintRow label="Status" value={labelize(noc.status)} />
          </dl>
        </PrintSection>
        <PrintSection title="Plot">
          <dl>
            <PrintRow label="Property type" value={plotTypeLabel(noc.plot.plotType)} />
            <PrintRow label="Size" value={plotSizeDisplay(noc.plot)} />
            <PrintRow
              label="Owner"
              value={noc.ownership ? `${noc.ownership.ownerName} · ${noc.ownership.cnic}` : "—"}
            />
          </dl>
        </PrintSection>
        <PrintSection title="Fee">
          <dl>
            <PrintRow label="Fee (PKR)" value={noc.fee ? formatCurrency(noc.fee) : "—"} />
            <PrintRow label="Payment" value={labelize(noc.paymentStatus)} />
          </dl>
        </PrintSection>
        {noc.powerOfAttorney ? (
          <PrintSection title="Attorney">
            <dl>
              <PrintRow
                label="PoA"
                value={`${noc.powerOfAttorney.poaNumber} · ${noc.powerOfAttorney.attorneyName}`}
              />
            </dl>
          </PrintSection>
        ) : null}
        {issued ? (
          <p className="mt-4 text-sm text-slate-800">
            This society hereby certifies that it has no objection to the purpose stated above in
            respect of the named plot, subject to society bye-laws, building regulations, and any
            bank mortgage or other encumbrance recorded on the file.
          </p>
        ) : (
          <p className="mt-4 text-sm text-amber-900">
            This print is an application copy only. It is not a valid NOC until issued and stamped.
          </p>
        )}
        {noc.remarks ? (
          <PrintSection title="Remarks">
            <p className="text-sm text-slate-800">{noc.remarks}</p>
          </PrintSection>
        ) : null}
      </PrintDocument>
    </PrintPageShell>
  );
}
