import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSocietyLetterhead } from "@/lib/print";
import { plotLabel } from "@/lib/plots";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  filerStatusLabel,
  formatPercent,
  taxPartyRoleLabel,
  taxSectionLabel,
} from "@/lib/fbr-tax-shared";
import { PrintDocument, PrintPageShell, PrintRow, PrintSection } from "@/components/print/print-document";

export const dynamic = "force-dynamic";

export default async function FbrTaxPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [assessment, letterhead] = await Promise.all([
    prisma.transferTaxAssessment.findUnique({
      where: { id },
      include: {
        plot: { select: { sector: true, block: true, plotNumber: true, dcValue: true } },
        transfer: { select: { id: true, transferNumber: true } },
        openFile: { select: { id: true, openFileNumber: true } },
        recordedBy: { select: { name: true } },
        paymentRecordedBy: { select: { name: true } },
      },
    }),
    getSocietyLetterhead(),
  ]);

  if (!assessment) notFound();

  const backHref = assessment.transferId
    ? `/transfers/${assessment.transferId}`
    : assessment.openFileId
      ? `/open-files/${assessment.openFileId}`
      : `/plots/${assessment.plotId}`;

  return (
    <PrintPageShell backHref={backHref} backLabel="Back to record">
      <PrintDocument
        letterhead={letterhead}
        title={`FBR Tax Assessment — ${taxSectionLabel(assessment.taxSection)}`}
        subtitle={`${assessment.paymentStatus} · ${taxPartyRoleLabel(assessment.partyRole)}`}
        serialLabel="Assessment no."
        serial={assessment.assessmentNumber}
        date={assessment.paidAt ?? assessment.createdAt}
        plot={plotLabel(assessment.plot)}
        parties={[
          {
            label: taxPartyRoleLabel(assessment.partyRole),
            value: `${assessment.partyName}${assessment.partyCnic ? ` · ${assessment.partyCnic}` : ""}`,
          },
          {
            label: "Linked to",
            value:
              assessment.transfer?.transferNumber ||
              assessment.openFile?.openFileNumber ||
              "Plot only",
          },
        ]}
        preparedBy={assessment.recordedBy?.name || "Transfer desk"}
        receivedBy={assessment.partyName}
      >
        <PrintSection title="Snapshot (not overwritten)">
          <dl>
            <PrintRow label="DC value (PKR)" value={formatCurrency(assessment.dcValueSnapshot)} />
            <PrintRow label="Filer status" value={filerStatusLabel(assessment.filerStatus)} />
            <PrintRow label="Rate" value={formatPercent(assessment.ratePercent)} />
            <PrintRow label="Tax amount" value={formatCurrency(assessment.amount)} />
            <PrintRow label="Payment" value={assessment.paymentStatus} />
          </dl>
        </PrintSection>
        <PrintSection title="Challan / CPR">
          <dl>
            <PrintRow label="PSID / challan" value={assessment.challanNumber || "—"} />
            <PrintRow label="CPR" value={assessment.cprNumber || "—"} />
            <PrintRow label="Paid on" value={formatDate(assessment.paidAt)} />
            <PrintRow
              label="Payment recorded by"
              value={assessment.paymentRecordedBy?.name || (assessment.paymentStatus === "PAID" ? "—" : "Unpaid")}
            />
          </dl>
        </PrintSection>
        {assessment.remarks ? (
          <PrintSection title="Remarks">
            <p className="text-sm text-slate-800">{assessment.remarks}</p>
          </PrintSection>
        ) : null}
        <p className="mt-4 text-xs text-slate-600">
          FBR withholding on immovable property under the Income Tax Ordinance. Society records the
          assessment against DC value; payment to FBR is the party&apos;s responsibility. This slip is
          an office snapshot, not an FBR challan.
        </p>
      </PrintDocument>
    </PrintPageShell>
  );
}
