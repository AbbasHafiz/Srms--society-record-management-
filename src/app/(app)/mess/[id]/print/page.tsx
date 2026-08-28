import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getSocietyLetterhead } from "@/lib/print";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { PrintDocument, PrintPageShell, PrintRow, PrintSection } from "@/components/print/print-document";

export const dynamic = "force-dynamic";

export default async function MessBillPrintPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [meal, letterhead] = await Promise.all([
    prisma.messMeal.findUnique({
      where: { id },
      include: {
        financeTransaction: { select: { txnNumber: true } },
        createdBy: { select: { name: true } },
      },
    }),
    getSocietyLetterhead(),
  ]);

  if (!meal) notFound();

  const perPerson = meal.headcount > 0 ? Number(meal.amount) / meal.headcount : 0;

  return (
    <PrintPageShell backHref={`/mess/${meal.id}`} backLabel="Back to mess record">
      <PrintDocument
        letterhead={letterhead}
        title="Staff Mess Bill"
        subtitle={`${labelize(meal.mealType)} · ${labelize(meal.status)}`}
        serialLabel="Date"
        serial={formatDate(meal.mealDate)}
        date={meal.mealDate}
        parties={[
          { label: "Vendor", value: meal.vendor || "Society mess" },
          { label: "Recorded by", value: meal.createdBy?.name || "Mess desk" },
        ]}
        preparedBy={meal.createdBy?.name || "Mess desk"}
        receivedBy="Kitchen / accounts"
      >
        <PrintSection title="Meal">
          <dl>
            <PrintRow label="Meal type" value={labelize(meal.mealType)} />
            <PrintRow label="Headcount" value={String(meal.headcount)} />
            <PrintRow label="Amount (PKR)" value={formatCurrency(meal.amount)} />
            <PrintRow label="Per person" value={formatCurrency(perPerson)} />
            {meal.financeTransaction ? (
              <PrintRow label="Ledger" value={meal.financeTransaction.txnNumber} />
            ) : null}
            {meal.otherDetail ? <PrintRow label="Detail" value={meal.otherDetail} /> : null}
          </dl>
        </PrintSection>
        {meal.remarks ? (
          <PrintSection title="Remarks">
            <p className="text-sm text-slate-800">{meal.remarks}</p>
          </PrintSection>
        ) : null}
      </PrintDocument>
    </PrintPageShell>
  );
}
