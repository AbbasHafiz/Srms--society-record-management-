import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSocietyLetterhead } from "@/lib/print";
import { plotLabel } from "@/lib/plots";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { HEIR_RELATION_LABELS } from "@/lib/death-transfer-shared";
import { filerStatusLabel, formatPercent, taxSectionShort } from "@/lib/fbr-tax-shared";
import { PrintDocument, PrintPageShell, PrintRow, PrintSection } from "@/components/print/print-document";

export const dynamic = "force-dynamic";

export default async function TransferPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [transfer, letterhead] = await Promise.all([
    prisma.transfer.findUnique({
      where: { id },
      include: {
        plot: { select: { sector: true, block: true, plotNumber: true } },
        payments: { orderBy: { createdAt: "desc" } },
        heirs: { orderBy: { createdAt: "asc" } },
        taxAssessments: { orderBy: { createdAt: "asc" } },
        openFiles: {
          include: { taxAssessments: { orderBy: { createdAt: "asc" } } },
        },
        completedBy: { select: { name: true } },
        approvedBy: { select: { name: true } },
        powerOfAttorney: { select: { poaNumber: true, attorneyName: true } },
      },
    }),
    getSocietyLetterhead(),
  ]);

  if (!transfer) notFound();

  const isDeath = transfer.transferType === "DEATH_SUCCESSION";
  const mergedTax = [
    ...transfer.taxAssessments,
    ...transfer.openFiles.flatMap((f) => f.taxAssessments),
  ].filter((row, index, all) => all.findIndex((r) => r.id === row.id) === index);
  const tax236C = mergedTax.find((a) => a.taxSection === "SECTION_236C");
  const tax236K = mergedTax.find((a) => a.taxSection === "SECTION_236K");
  const feeTotal = transfer.payments.reduce((sum, p) => sum + Number(p.amount), 0);
  const primaryHeir = transfer.heirs.find((h) => h.isPrimarySuccessor);

  const title = isDeath ? "Death / Succession Completion Slip" : "Sale Transfer Completion Slip";
  const subtitle = isDeath
    ? "FBR 236C / 236K does not apply to succession"
    : "Seller to purchaser — society fees and FBR withholding";

  return (
    <PrintPageShell backHref={`/transfers/${transfer.id}`} backLabel="Back to transfer">
      <PrintDocument
        letterhead={letterhead}
        title={title}
        subtitle={`${subtitle} · ${labelize(transfer.status)}`}
        serialLabel="Transfer no."
        serial={transfer.transferNumber}
        date={transfer.completedAt ?? transfer.approvedAt ?? transfer.createdAt}
        plot={plotLabel(transfer.plot)}
        parties={
          isDeath
            ? [
                {
                  label: "Deceased member",
                  value: `${transfer.sellerName}${transfer.sellerCnic ? ` · ${transfer.sellerCnic}` : ""}`,
                },
                {
                  label: "Primary successor",
                  value:
                    transfer.purchaserName ||
                    primaryHeir?.name ||
                    "Not recorded",
                },
              ]
            : [
                {
                  label: "Seller",
                  value: `${transfer.sellerName}${transfer.sellerCnic ? ` · ${transfer.sellerCnic}` : ""}`,
                },
                {
                  label: "Purchaser",
                  value: transfer.purchaserName
                    ? `${transfer.purchaserName}${transfer.purchaserCnic ? ` · ${transfer.purchaserCnic}` : ""}`
                    : "Not yet recorded",
                },
              ]
        }
        preparedBy={transfer.completedBy?.name || transfer.approvedBy?.name || "Transfer desk"}
        receivedBy={transfer.purchaserName || primaryHeir?.name || "Member"}
      >
        <PrintSection title="Case">
          <dl>
            <PrintRow label="Type" value={labelize(transfer.transferType)} />
            <PrintRow label="Status" value={labelize(transfer.status)} />
            {transfer.trdNumber ? <PrintRow label="TRD" value={transfer.trdNumber} /> : null}
            <PrintRow label="Seller membership" value={transfer.sellerMembershipNo} />
            {transfer.newMembershipNumber ? (
              <PrintRow label="New membership" value={transfer.newMembershipNumber} />
            ) : null}
            {transfer.newAllotmentNumber ? (
              <PrintRow label="New allotment" value={transfer.newAllotmentNumber} />
            ) : null}
            {transfer.powerOfAttorney ? (
              <PrintRow
                label="PoA"
                value={`${transfer.powerOfAttorney.poaNumber} · ${transfer.powerOfAttorney.attorneyName}`}
              />
            ) : null}
            {isDeath ? (
              <>
                <PrintRow label="Date of death" value={formatDate(transfer.deceasedDateOfDeath)} />
                <PrintRow label="Death certificate" value={transfer.deathCertificateRef} />
              </>
            ) : null}
          </dl>
        </PrintSection>

        {isDeath ? (
          <PrintSection title="Legal heirs">
            {transfer.heirs.length === 0 ? (
              <p className="text-sm text-slate-700">No heirs recorded.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-1">Name</th>
                    <th className="py-1">Relation</th>
                    <th className="py-1">CNIC</th>
                    <th className="py-1">Role</th>
                  </tr>
                </thead>
                <tbody>
                  {transfer.heirs.map((h) => (
                    <tr key={h.id} className="border-b border-slate-100">
                      <td className="py-1.5 font-medium">{h.name}</td>
                      <td className="py-1.5">
                        {HEIR_RELATION_LABELS[h.relationToDeceased] ?? labelize(h.relationToDeceased)}
                      </td>
                      <td className="py-1.5 font-mono text-xs">{h.cnic}</td>
                      <td className="py-1.5">
                        {h.isPrimarySuccessor ? "Primary successor" : "Heir"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <p className="mt-3 text-xs text-slate-600">
              Succession transfers are exempt from FBR 236C / 236K withholding. No tax assessment is
              printed on this slip.
            </p>
          </PrintSection>
        ) : (
          <PrintSection title="FBR 236C / 236K">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-1">Section</th>
                  <th className="py-1">Party</th>
                  <th className="py-1">DC / rate</th>
                  <th className="py-1">Amount</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {[tax236C, tax236K].map((row, i) =>
                  row ? (
                    <tr key={row.id} className="border-b border-slate-100">
                      <td className="py-1.5 font-medium">{taxSectionShort(row.taxSection)}</td>
                      <td className="py-1.5">
                        {row.partyName}
                        <div className="text-xs text-slate-500">{filerStatusLabel(row.filerStatus)}</div>
                      </td>
                      <td className="py-1.5">
                        {formatCurrency(row.dcValueSnapshot)} · {formatPercent(row.ratePercent)}
                      </td>
                      <td className="py-1.5">{formatCurrency(row.amount)}</td>
                      <td className="py-1.5 font-semibold">{row.paymentStatus}</td>
                    </tr>
                  ) : (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-1.5">{i === 0 ? "236C" : "236K"}</td>
                      <td className="py-1.5" colSpan={4}>
                        Not recorded — {i === 0 ? "UNPAID" : "UNPAID"}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </PrintSection>
        )}

        <PrintSection title="Society fees">
          {transfer.payments.length === 0 ? (
            <p className="text-sm text-slate-700">No society fee payment recorded.</p>
          ) : (
            <dl>
              {transfer.payments.map((p) => (
                <PrintRow
                  key={p.id}
                  label={p.receiptNumber}
                  value={`${formatCurrency(p.amount)} · ${labelize(p.feeType)} · ${labelize(p.status)}${
                    p.poNumber ? ` · P.O. ${p.poNumber}` : ""
                  }`}
                />
              ))}
              <PrintRow label="Total (PKR)" value={formatCurrency(feeTotal)} />
            </dl>
          )}
        </PrintSection>
      </PrintDocument>
    </PrintPageShell>
  );
}
