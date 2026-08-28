import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSocietyLetterhead } from "@/lib/print";
import { plotLabel, plotTypeLabel } from "@/lib/plots";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { plotSizeDisplay } from "@/lib/property-sizes";
import { PrintDocument, PrintPageShell, PrintRow, PrintSection } from "@/components/print/print-document";

export const dynamic = "force-dynamic";

export default async function PossessionPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [possession, letterhead] = await Promise.all([
    prisma.possession.findUnique({
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

  if (!possession) notFound();

  const issued = possession.approvalStatus === "ISSUED";

  return (
    <PrintPageShell backHref={`/possession/${possession.id}`} backLabel="Back to possession">
      <PrintDocument
        letterhead={letterhead}
        title={issued ? "Possession Letter" : "Possession Application"}
        subtitle={
          issued ? "Physical possession recorded by the society" : `Status: ${labelize(possession.approvalStatus)} — not yet issued`
        }
        serialLabel={issued ? "Letter no." : "Application no."}
        serial={possession.letterNumber || possession.applicationNumber}
        date={possession.issueDate ?? possession.applicationDate}
        plot={plotLabel(possession.plot)}
        parties={[
          { label: "Applicant", value: possession.applicantName },
          { label: "Membership", value: possession.ownership?.membershipNumber || "—" },
        ]}
        preparedBy={possession.approvedBy?.name || "Records"}
        receivedBy={possession.applicantName}
      >
        <PrintSection title="Letter">
          <dl>
            <PrintRow label="Application" value={possession.applicationNumber} />
            <PrintRow label="Applied on" value={formatDate(possession.applicationDate)} />
            <PrintRow label="Issued on" value={formatDate(possession.issueDate)} />
            <PrintRow label="Status" value={labelize(possession.approvalStatus)} />
          </dl>
        </PrintSection>
        <PrintSection title="Plot">
          <dl>
            <PrintRow label="Property type" value={plotTypeLabel(possession.plot.plotType)} />
            <PrintRow label="Size" value={plotSizeDisplay(possession.plot)} />
            <PrintRow
              label="Owner"
              value={possession.ownership ? `${possession.ownership.ownerName} · ${possession.ownership.cnic}` : "—"}
            />
          </dl>
        </PrintSection>
        <PrintSection title="Fee">
          <dl>
            <PrintRow
              label="Fee (PKR)"
              value={possession.possessionFee ? formatCurrency(possession.possessionFee) : "—"}
            />
            <PrintRow label="Payment" value={labelize(possession.paymentStatus)} />
          </dl>
        </PrintSection>
        {possession.powerOfAttorney ? (
          <PrintSection title="Attorney">
            <dl>
              <PrintRow
                label="PoA"
                value={`${possession.powerOfAttorney.poaNumber} · ${possession.powerOfAttorney.attorneyName}`}
              />
            </dl>
          </PrintSection>
        ) : null}
        {issued ? (
          <p className="mt-4 text-sm text-slate-800">
            The society records that possession of the named plot has been processed in favour of the
            applicant, subject to outstanding dues, development status, and society bye-laws.
          </p>
        ) : (
          <p className="mt-4 text-sm text-amber-900">
            This print is an application copy only. It is not a possession letter until issued and
            stamped.
          </p>
        )}
        {possession.remarks ? (
          <PrintSection title="Remarks">
            <p className="text-sm text-slate-800">{possession.remarks}</p>
          </PrintSection>
        ) : null}
      </PrintDocument>
    </PrintPageShell>
  );
}
