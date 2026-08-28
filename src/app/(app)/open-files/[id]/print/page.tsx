import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSocietyLetterhead } from "@/lib/print";
import { plotLabel } from "@/lib/plots";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import {
  holderTypeLabel,
  sellerAppearanceLabel,
} from "@/lib/open-files-shared";
import { openFileStatusLabel } from "@/lib/open-files";
import { filerStatusLabel, formatPercent, taxSectionShort } from "@/lib/fbr-tax-shared";
import { PrintDocument, PrintPageShell, PrintRow, PrintSection } from "@/components/print/print-document";

export const dynamic = "force-dynamic";

export default async function OpenFilePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [openFile, letterhead] = await Promise.all([
    prisma.openFile.findUnique({
      where: { id },
      include: {
        plot: true,
        ownership: true,
        registeredOffice: true,
        powerOfAttorney: true,
        payments: { orderBy: { createdAt: "desc" } },
        considerations: { orderBy: { createdAt: "desc" } },
        taxAssessments: { orderBy: { createdAt: "asc" } },
        documents: {
          where: { documentType: { in: ["DEALER_LETTERHEAD", "ALLOTMENT_LETTER"] } },
          orderBy: { version: "desc" },
        },
      },
    }),
    getSocietyLetterhead(),
  ]);

  if (!openFile) notFound();

  const poPayment = openFile.payments.find((p) => p.feeType === "OPEN_FILE") ?? openFile.payments[0];
  const letterheadDoc =
    openFile.documents.find((d) => d.id === openFile.letterheadDocumentId) ??
    openFile.documents.find((d) => d.documentType === "DEALER_LETTERHEAD");
  const tax236C = openFile.taxAssessments.find((a) => a.taxSection === "SECTION_236C");
  const consideration = openFile.considerations[0];

  return (
    <PrintPageShell backHref={`/open-files/${openFile.id}`} backLabel="Back to open file">
      <PrintDocument
        letterhead={letterhead}
        title="Open File Acknowledgement"
        subtitle="Sold to investor / dealer — end purchaser not yet named"
        serialLabel="Open file no."
        serial={openFile.openFileNumber}
        date={openFile.openingDate}
        plot={plotLabel(openFile.plot)}
        parties={[
          { label: "Seller", value: `${openFile.sellerName}${openFile.sellerCnic ? ` · ${openFile.sellerCnic}` : ""}` },
          {
            label: "XYZ holder",
            value: openFile.holderName
              ? `${openFile.holderName} (${holderTypeLabel(openFile.holderType)})${openFile.holderCnic ? ` · ${openFile.holderCnic}` : ""}`
              : "—",
          },
        ]}
        preparedBy="Transfer desk"
        receivedBy={openFile.dealerName || openFile.holderName || "Dealer / holder"}
      >
        <PrintSection title="File status">
          <dl>
            <PrintRow label="Status" value={openFileStatusLabel(openFile.status)} />
            <PrintRow label="Opened" value={formatDate(openFile.openingDate)} />
            <PrintRow label="Expires" value={formatDate(openFile.expiryDate)} />
            <PrintRow label="Period" value={`${openFile.periodMonths} month(s)`} />
            <PrintRow label="Appearance" value={sellerAppearanceLabel(openFile.sellerAppearance)} />
            {openFile.powerOfAttorney ? (
              <PrintRow
                label="PoA"
                value={`${openFile.powerOfAttorney.poaNumber} · ${openFile.powerOfAttorney.attorneyName}`}
              />
            ) : null}
          </dl>
        </PrintSection>
        <PrintSection title="Purchaser (end buyer)">
          <dl>
            <PrintRow
              label="Name"
              value={openFile.purchaserName || "Empty — purchaser not yet named"}
            />
            <PrintRow label="CNIC" value={openFile.purchaserCnic || "—"} />
          </dl>
        </PrintSection>
        <PrintSection title="Dealer letterhead">
          <dl>
            <PrintRow label="Dealer" value={openFile.dealerName} />
            <PrintRow
              label="Office"
              value={openFile.registeredOffice?.officeName || openFile.dealerOffice}
            />
            <PrintRow
              label="Letterhead ref"
              value={letterheadDoc?.title || letterheadDoc?.documentNumber || "Scan on file / not attached"}
            />
          </dl>
        </PrintSection>
        <PrintSection title="Society fee (pay order)">
          <dl>
            <PrintRow label="Fee (PKR)" value={formatCurrency(openFile.feeAmount)} />
            <PrintRow label="Payment status" value={labelize(openFile.paymentStatus)} />
            {poPayment ? (
              <>
                <PrintRow label="Receipt" value={poPayment.receiptNumber} />
                <PrintRow label="P.O. number" value={poPayment.poNumber} />
                <PrintRow label="Bank" value={poPayment.bankName} />
                <PrintRow label="P.O. date" value={formatDate(poPayment.poDate)} />
                <PrintRow label="P.O. status" value={labelize(poPayment.status)} />
              </>
            ) : (
              <PrintRow label="P.O." value="No pay order recorded" />
            )}
          </dl>
        </PrintSection>
        <PrintSection title="FBR 236C (seller)">
          {tax236C ? (
            <dl>
              <PrintRow label="Assessment" value={tax236C.assessmentNumber} />
              <PrintRow label="Section" value={taxSectionShort(tax236C.taxSection)} />
              <PrintRow label="DC value" value={formatCurrency(tax236C.dcValueSnapshot)} />
              <PrintRow label="Filer" value={filerStatusLabel(tax236C.filerStatus)} />
              <PrintRow label="Rate" value={formatPercent(tax236C.ratePercent)} />
              <PrintRow label="Tax (PKR)" value={formatCurrency(tax236C.amount)} />
              <PrintRow label="Status" value={tax236C.paymentStatus} />
              <PrintRow label="Challan / PSID" value={tax236C.challanNumber} />
              <PrintRow label="CPR" value={tax236C.cprNumber} />
            </dl>
          ) : (
            <p className="text-sm text-slate-700">236C not yet recorded on this open file.</p>
          )}
        </PrintSection>
        {consideration ? (
          <PrintSection title="Private consideration (seller ← XYZ)">
            <dl>
              <PrintRow label="Amount" value={formatCurrency(consideration.amount)} />
              <PrintRow label="Paid on" value={formatDate(consideration.paidAt)} />
              <PrintRow label="Method" value={labelize(consideration.paymentMethod)} />
            </dl>
          </PrintSection>
        ) : null}
      </PrintDocument>
    </PrintPageShell>
  );
}
