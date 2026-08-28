import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSocietyLetterhead } from "@/lib/print";
import { plotLabel } from "@/lib/plots";
import { formatDate, labelize } from "@/lib/utils";
import { PrintDocument, PrintPageShell, PrintRow, PrintSection } from "@/components/print/print-document";

export const dynamic = "force-dynamic";

export default async function MortgagePrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [mortgage, letterhead] = await Promise.all([
    prisma.mortgage.findUnique({
      where: { id },
      include: {
        plot: true,
        ownership: true,
      },
    }),
    getSocietyLetterhead(),
  ]);

  if (!mortgage) notFound();

  const active = mortgage.status === "ACTIVE";

  return (
    <PrintPageShell backHref={`/mortgages/${mortgage.id}`} backLabel="Back to mortgage">
      <PrintDocument
        letterhead={letterhead}
        title={active ? "Mortgage Confirmation Letter" : "Mortgage Record"}
        subtitle={`${mortgage.bankName} · ${labelize(mortgage.status)}`}
        serialLabel="Loan ref."
        serial={mortgage.loanReference || mortgage.id.slice(-8).toUpperCase()}
        date={mortgage.releaseDate ?? mortgage.mortgageDate ?? mortgage.createdAt}
        plot={plotLabel(mortgage.plot)}
        parties={[
          { label: "Bank", value: mortgage.bankName },
          {
            label: "Member",
            value: mortgage.ownership
              ? `${mortgage.ownership.ownerName} · ${mortgage.ownership.membershipNumber}`
              : "—",
          },
        ]}
        preparedBy="Records"
        receivedBy={mortgage.ownership?.ownerName || "Member"}
      >
        <PrintSection title="Charge">
          <dl>
            <PrintRow label="Status" value={labelize(mortgage.status)} />
            <PrintRow label="Mortgage date" value={formatDate(mortgage.mortgageDate)} />
            <PrintRow label="Release date" value={formatDate(mortgage.releaseDate)} />
            <PrintRow label="CNIC" value={mortgage.ownership?.cnic} />
          </dl>
        </PrintSection>
        {active ? (
          <p className="mt-4 text-sm text-slate-800">
            Society records show an active bank mortgage on this plot. Transfer, construction NOC,
            and related completions remain blocked until the bank release is recorded.
          </p>
        ) : mortgage.status === "RELEASED" ? (
          <p className="mt-4 text-sm text-slate-800">
            The mortgage noted above has been marked released on society records as of the release
            date. This letter does not replace the bank&apos;s discharge documents.
          </p>
        ) : (
          <p className="mt-4 text-sm text-slate-800">
            This is an office copy of the mortgage register entry. Status: {labelize(mortgage.status)}.
          </p>
        )}
        {mortgage.remarks ? (
          <PrintSection title="Remarks">
            <p className="text-sm text-slate-800">{mortgage.remarks}</p>
          </PrintSection>
        ) : null}
      </PrintDocument>
    </PrintPageShell>
  );
}
