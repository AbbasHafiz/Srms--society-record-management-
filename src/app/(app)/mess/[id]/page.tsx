import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { canManageMess } from "@/lib/rbac";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { PrintButton } from "@/components/print/print-button";
import { cancelMessMeal } from "../actions";

export const dynamic = "force-dynamic";

export default async function MessDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const canManage = session?.user && canManageMess(session.user.role);

  const meal = await prisma.messMeal.findUnique({
    where: { id },
    include: { financeTransaction: true, createdBy: true },
  });

  if (!meal) notFound();

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Link href="/mess" className="text-sm text-teal-800 hover:underline">
          ← Staff Mess
        </Link>
        {canManage && meal.status === "ACTIVE" ? (
          <Link href={`/mess/${meal.id}/edit`} className="text-sm text-teal-800 hover:underline">
            Edit
          </Link>
        ) : null}
      </div>

      <PageHeader
        title={`${labelize(meal.mealType)} — ${formatDate(meal.mealDate)}`}
        description="Staff mess meal record."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={meal.status} />
            <PrintButton href={`/mess/${meal.id}/print`} label="Print bill" />
          </div>
        }
      />

      <div className="mb-6 max-w-2xl rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <dl className="grid gap-4 text-sm sm:grid-cols-2">
          <Row label="Date" value={formatDate(meal.mealDate)} />
          <Row label="Meal type" value={labelize(meal.mealType)} />
          <Row label="Headcount" value={String(meal.headcount)} />
          <Row label="Amount" value={formatCurrency(meal.amount)} />
          <Row label="Vendor" value={meal.vendor ?? "—"} />
          <Row label="Per person" value={formatCurrency(Number(meal.amount) / meal.headcount)} />
          {meal.remarks ? (
            <div className="sm:col-span-2">
              <Row label="Remarks" value={meal.remarks} />
            </div>
          ) : null}
          {meal.financeTransaction ? (
            <div className="sm:col-span-2">
              <Row
                label="Finance ledger"
                value={
                  <Link href="/finance" className="text-teal-800 hover:underline">
                    {meal.financeTransaction.txnNumber} — {formatCurrency(meal.financeTransaction.amount)}
                  </Link>
                }
              />
            </div>
          ) : null}
          {meal.createdBy ? <Row label="Recorded by" value={meal.createdBy.name} /> : null}
        </dl>
      </div>

      {canManage && meal.status === "ACTIVE" ? (
        <form action={cancelMessMeal} className="max-w-2xl rounded-xl border border-rose-200 bg-rose-50 p-5">
          <h2 className="font-display text-lg font-semibold text-rose-900">Cancel record</h2>
          <p className="mt-1 text-sm text-rose-800">
            Soft-cancel keeps history but excludes this entry from active mess totals. This does not void a linked finance transaction.
          </p>
          <input type="hidden" name="id" value={meal.id} />
          <Button type="submit" variant="outline" className="mt-4 border-rose-300 text-rose-900 hover:bg-rose-100">
            Cancel meal record
          </Button>
        </form>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-slate-900">{value}</dd>
    </div>
  );
}
