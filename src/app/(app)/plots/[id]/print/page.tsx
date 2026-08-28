import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSocietyLetterhead, PRINT_NOT_TITLE_DEED } from "@/lib/print";
import { plotLabel, plotTypeLabel } from "@/lib/plots";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { plotSizeDisplay } from "@/lib/property-sizes";
import { openFileStatusLabel } from "@/lib/open-files";
import { PrintDocument, PrintPageShell, PrintRow, PrintSection } from "@/components/print/print-document";

export const dynamic = "force-dynamic";

export default async function PlotSummaryPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [plot, letterhead] = await Promise.all([
    prisma.plot.findUnique({
      where: { id },
      include: {
        ownerships: { orderBy: { startDate: "asc" } },
        transfers: { orderBy: { createdAt: "desc" }, take: 20 },
        payments: { orderBy: { createdAt: "desc" }, take: 20 },
        plotCharges: { orderBy: [{ year: "desc" }, { month: "desc" }] },
        mortgages: { orderBy: { createdAt: "desc" } },
        openFiles: { orderBy: { openingDate: "desc" }, take: 5 },
      },
    }),
    getSocietyLetterhead(),
  ]);

  if (!plot) notFound();

  const activeOwner = plot.ownerships.find((o) => o.status === "ACTIVE");
  const outstandingCharges = plot.plotCharges.filter((c) =>
    ["PENDING", "BILLED", "OVERDUE"].includes(c.status)
  );
  const outstandingPayments = plot.payments.filter((p) =>
    ["PENDING", "SUBMITTED", "UNPAID", "PARTIAL", "OVERDUE"].includes(p.status)
  );
  const duesTotal =
    outstandingCharges.reduce((sum, c) => sum + Number(c.amount), 0) +
    outstandingPayments.reduce((sum, p) => sum + Number(p.amount), 0);
  const activeMortgage = plot.mortgages.find((m) => m.status === "ACTIVE");

  return (
    <PrintPageShell backHref={`/plots/${plot.id}`} backLabel="Back to plot">
      <PrintDocument
        letterhead={letterhead}
        title="Plot Summary Report"
        subtitle="Ownership history and current dues — not a title deed"
        serialLabel="Plot"
        serial={plotLabel(plot)}
        date={new Date()}
        plot={plotLabel(plot)}
        parties={[
          {
            label: "Current owner",
            value: activeOwner
              ? `${activeOwner.ownerName} · ${activeOwner.membershipNumber}`
              : "No active ownership",
          },
          { label: "CNIC", value: activeOwner?.cnic || "—" },
        ]}
        preparedBy="Records"
        receivedBy={activeOwner?.ownerName || "Member"}
        extraDisclaimer={PRINT_NOT_TITLE_DEED}
      >
        <PrintSection title="Plot">
          <dl>
            <PrintRow label="Type" value={plotTypeLabel(plot.plotType, plot.otherDetail)} />
            <PrintRow label="Size" value={plotSizeDisplay(plot)} />
            <PrintRow label="Street" value={plot.street} />
            <PrintRow label="Ownership" value={labelize(plot.ownershipStatus)} />
            <PrintRow label="Possession" value={labelize(plot.possessionStatus)} />
            <PrintRow label="Development" value={labelize(plot.developmentStatus)} />
            <PrintRow
              label="DC value"
              value={plot.dcValue != null ? formatCurrency(plot.dcValue) : "Not set"}
            />
            <PrintRow
              label="Mortgage"
              value={
                activeMortgage
                  ? `ACTIVE — ${activeMortgage.bankName}${activeMortgage.loanReference ? ` (${activeMortgage.loanReference})` : ""}`
                  : "None active"
              }
            />
          </dl>
        </PrintSection>

        <PrintSection title="Ownership history">
          {plot.ownerships.length === 0 ? (
            <p className="text-sm text-slate-700">No ownership rows on file.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-1">Owner</th>
                  <th className="py-1">Membership</th>
                  <th className="py-1">From</th>
                  <th className="py-1">To</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {plot.ownerships.map((o) => (
                  <tr key={o.id} className="border-b border-slate-100">
                    <td className="py-1.5 font-medium">{o.ownerName}</td>
                    <td className="py-1.5 font-mono text-xs">{o.membershipNumber}</td>
                    <td className="py-1.5">{formatDate(o.startDate)}</td>
                    <td className="py-1.5">{formatDate(o.endDate)}</td>
                    <td className="py-1.5">{labelize(o.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PrintSection>

        <PrintSection title="Current dues">
          <dl>
            <PrintRow label="Outstanding (PKR)" value={formatCurrency(duesTotal)} />
          </dl>
          {outstandingCharges.length === 0 && outstandingPayments.length === 0 ? (
            <p className="mt-2 text-sm text-slate-700">No outstanding plot charges or fee payments.</p>
          ) : (
            <table className="mt-2 w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-1">Item</th>
                  <th className="py-1">Ref</th>
                  <th className="py-1">Amount</th>
                  <th className="py-1">Status</th>
                </tr>
              </thead>
              <tbody>
                {outstandingCharges.map((c) => (
                  <tr key={c.id} className="border-b border-slate-100">
                    <td className="py-1.5">Annual / plot charge</td>
                    <td className="py-1.5">
                      {c.year}
                      {c.month ? `-${String(c.month).padStart(2, "0")}` : ""}
                    </td>
                    <td className="py-1.5">{formatCurrency(c.amount)}</td>
                    <td className="py-1.5">{labelize(c.status)}</td>
                  </tr>
                ))}
                {outstandingPayments.map((p) => (
                  <tr key={p.id} className="border-b border-slate-100">
                    <td className="py-1.5">{labelize(p.feeType)}</td>
                    <td className="py-1.5">{p.receiptNumber}</td>
                    <td className="py-1.5">{formatCurrency(p.amount)}</td>
                    <td className="py-1.5">{labelize(p.status)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </PrintSection>

        {plot.openFiles.length > 0 ? (
          <PrintSection title="Open files">
            <dl>
              {plot.openFiles.map((f) => (
                <PrintRow
                  key={f.id}
                  label={f.openFileNumber}
                  value={`${openFileStatusLabel(f.status)} · expires ${formatDate(f.expiryDate)}`}
                />
              ))}
            </dl>
          </PrintSection>
        ) : null}
      </PrintDocument>
    </PrintPageShell>
  );
}
