import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { verifyPayment } from "@/lib/services";
import { hasPermission } from "@/lib/rbac";
import { postPaymentToLedgerAction } from "@/app/(app)/finance/actions";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { ScanUpload } from "@/components/documents/scan-upload";
import type { PaymentStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: PaymentStatus[] = [
  "PENDING",
  "SUBMITTED",
  "VERIFIED",
  "REJECTED",
  "CANCELLED",
  "PAID",
  "PARTIAL",
  "OVERDUE",
  "UNPAID",
];

async function verifyPaymentAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "verify_payment")) {
    throw new Error("You do not have permission to verify payments");
  }

  const paymentId = formData.get("paymentId") as string;
  if (!paymentId) throw new Error("Payment ID required");

  await verifyPayment(paymentId, session.user.id);
  revalidatePath("/payments");
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status?.trim() as PaymentStatus | undefined;
  const session = await auth();
  const canVerify = session?.user && hasPermission(session.user.role, "verify_payment");
  const canManageFinance = session?.user && hasPermission(session.user.role, "manage_finance");

  const payments = await prisma.payment.findMany({
    where: status && STATUSES.includes(status) ? { status } : undefined,
    include: {
      plot: true,
      verifiedBy: { select: { name: true } },
      financeTransaction: { select: { txnNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Payments"
        description="Payment receipts and PO verification for society fees."
      />

      <form className="mb-4 flex gap-2">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {labelize(s)}
            </option>
          ))}
        </select>
        <Button type="submit">Filter</Button>
      </form>

      {payments.length === 0 ? (
        <EmptyState title="No payments found" description="Try adjusting your filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Receipt</th>
                <th>Fee Type</th>
                <th>Plot</th>
                <th>Amount</th>
                <th>PO / Method</th>
                <th>Date</th>
                <th>Status</th>
                <th>Verified By</th>
                <th>Ledger</th>
                <th>PO Scan</th>
                {(canVerify || canManageFinance) ? <th>Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td className="font-medium">{p.receiptNumber}</td>
                  <td>
                    <Badge>{labelize(p.feeType)}</Badge>
                  </td>
                  <td>
                    {p.plot ? (
                      <Link href={`/plots/${p.plotId}`} className="text-teal-900 hover:underline">
                        {p.plot.sector}/{p.plot.block}-{p.plot.plotNumber}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{formatCurrency(p.amount)}</td>
                  <td>
                    {p.poNumber ? (
                      <span>
                        {p.poNumber}
                        <div className="text-xs text-slate-500">{labelize(p.paymentMethod)}</div>
                      </span>
                    ) : (
                      labelize(p.paymentMethod)
                    )}
                  </td>
                  <td>{formatDate(p.paymentDate ?? p.createdAt)}</td>
                  <td>
                    <Badge status={p.status} />
                  </td>
                  <td>
                    {p.verifiedBy ? (
                      <span>
                        {p.verifiedBy.name}
                        <div className="text-xs text-slate-500">{formatDate(p.verifiedAt)}</div>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>
                    {p.financeTransaction ? (
                      <Link href="/finance" className="text-teal-900 hover:underline">
                        {p.financeTransaction.txnNumber}
                      </Link>
                    ) : p.status === "VERIFIED" ? (
                      <span className="text-xs text-amber-700">Not posted</span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="min-w-[140px]">
                    {p.plotId ? (
                      <ScanUpload
                        plotId={p.plotId}
                        documentType="PAYMENT_PO"
                        documentNumber={p.id}
                        title={`PO — ${p.receiptNumber}`}
                        compact
                      />
                    ) : (
                      "—"
                    )}
                  </td>
                  {canVerify || canManageFinance ? (
                    <td>
                      <div className="flex flex-col gap-1">
                        {canVerify && ["PENDING", "SUBMITTED", "PAID"].includes(p.status) ? (
                          <form action={verifyPaymentAction}>
                            <input type="hidden" name="paymentId" value={p.id} />
                            <Button type="submit" size="sm" variant="outline">
                              Verify
                            </Button>
                          </form>
                        ) : null}
                        {canManageFinance && p.status === "VERIFIED" && !p.financeTransaction ? (
                          <form action={postPaymentToLedgerAction}>
                            <input type="hidden" name="paymentId" value={p.id} />
                            <Button type="submit" size="sm" variant="outline">
                              Post to ledger
                            </Button>
                          </form>
                        ) : null}
                        {!canVerify && !canManageFinance ? "—" : null}
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
