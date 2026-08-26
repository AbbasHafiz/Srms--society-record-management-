import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, WarningBanner } from "@/components/ui/page";
import { formatCurrency, formatDateTime, labelize } from "@/lib/utils";
import { hasPermission } from "@/lib/rbac";
import {
  updateTransferStep,
  approveTransferAction,
  completeTransferAction,
  verifyTransferPaymentAction,
} from "../actions";

export const dynamic = "force-dynamic";

const STEPS = [
  "Search Plot",
  "Verify Owner",
  "Seller Identity",
  "Seller Documents",
  "Purchaser Details",
  "Purchaser Documents",
  "Transfer Payment",
  "Doc Verification",
  "Approval",
  "New Membership",
  "New Allotment",
  "File Location",
  "Complete",
  "Audit Log",
];

export default async function TransferDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const transfer = await prisma.transfer.findUnique({
    where: { id },
    include: {
      plot: {
        include: {
          ownerships: { where: { status: "ACTIVE" }, take: 1 },
          mortgages: { where: { status: "ACTIVE" } },
          physicalFile: { include: { currentLocation: true } },
        },
      },
      payments: { orderBy: { createdAt: "desc" } },
      sellerVerifiedBy: true,
      approvedBy: true,
      completedBy: true,
      toOwnership: true,
      fromOwnership: true,
    },
  });

  if (!transfer) notFound();

  const activeMortgage = transfer.plot.mortgages[0];
  const canApprove = session?.user && hasPermission(session.user.role, "approve");
  const canComplete = session?.user && hasPermission(session.user.role, "complete_transfer");
  const canVerifyPay = session?.user && hasPermission(session.user.role, "verify_payment");
  const verifiedPay = transfer.payments.find((p) => p.status === "VERIFIED");
  const pendingPay = transfer.payments.find((p) => p.status === "SUBMITTED");

  return (
    <div>
      <PageHeader
        title={`Transfer ${transfer.transferNumber}`}
        description={`Plot ${transfer.plot.sector}/${transfer.plot.block}-${transfer.plot.plotNumber} · guided workflow with immutable history`}
        actions={
          <Link href={`/plots/${transfer.plotId}`} className="text-sm text-teal-800 hover:underline">
            Open plot profile
          </Link>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge status={transfer.status} />
        <span className="text-sm text-slate-500">Step {transfer.currentStep} of 14</span>
      </div>

      <div className="mb-6 flex gap-1 overflow-x-auto pb-2">
        {STEPS.map((label, i) => {
          const n = i + 1;
          const done = n < transfer.currentStep || transfer.status === "COMPLETED";
          const current = n === transfer.currentStep && transfer.status !== "COMPLETED";
          return (
            <div
              key={label}
              className={`min-w-[7.5rem] rounded-lg border px-2 py-2 text-center text-[11px] ${
                done
                  ? "border-emerald-200 bg-emerald-50 text-emerald-900"
                  : current
                    ? "border-teal-700 bg-teal-800 text-white"
                    : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              <div className="font-semibold">{n}</div>
              <div className="leading-tight">{label}</div>
            </div>
          );
        })}
      </div>

      {activeMortgage ? (
        <div className="mb-4">
          <WarningBanner>
            Active mortgage with {activeMortgage.bankName}. Transfer cannot be completed until bank
            NOC / release.
          </WarningBanner>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Seller</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Name" value={transfer.sellerName} />
            <Row label="CNIC" value={transfer.sellerCnic} />
            <Row label="Membership" value={transfer.sellerMembershipNo} />
            <Row label="Contact" value={transfer.sellerContact || "—"} />
            <Row
              label="Present personally"
              value={transfer.sellerPresentPersonally ? "Yes" : "No"}
            />
            <Row
              label="Identity verified"
              value={transfer.sellerIdentityVerified ? "Yes" : "No"}
            />
            <Row label="Verified by" value={transfer.sellerVerifiedBy?.name || "—"} />
            <Row label="Verification date" value={formatDateTime(transfer.sellerVerificationDate)} />
          </dl>

          {!transfer.sellerIdentityVerified && transfer.status !== "COMPLETED" ? (
            <form action={updateTransferStep} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <input type="hidden" name="id" value={transfer.id} />
              <input type="hidden" name="step" value="3" />
              <p className="text-sm font-medium text-slate-800">Step 3 — Seller identity verification</p>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="sellerPresentPersonally" value="yes" required />
                Seller present personally
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="sellerIdentityVerified" value="yes" required />
                Identity verified against CNIC
              </label>
              <div>
                <Label htmlFor="notes">Verification notes</Label>
                <Input id="notes" name="sellerVerificationNotes" className="mt-1" />
              </div>
              <Button type="submit">Confirm seller verification</Button>
            </form>
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Purchaser</h2>
          {transfer.purchaserName ? (
            <dl className="mt-3 space-y-2 text-sm">
              <Row label="Name" value={transfer.purchaserName} />
              <Row label="CNIC" value={transfer.purchaserCnic || "—"} />
              <Row label="Contact" value={transfer.purchaserContact || "—"} />
              <Row label="Address" value={transfer.purchaserAddress || "—"} />
              <Row label="New membership" value={transfer.newMembershipNumber || "Pending completion"} />
              <Row label="New allotment" value={transfer.newAllotmentNumber || "Pending completion"} />
            </dl>
          ) : (
            <form action={updateTransferStep} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={transfer.id} />
              <input type="hidden" name="step" value="5" />
              <p className="text-sm font-medium">Step 5 — Purchaser details</p>
              <div>
                <Label>Name</Label>
                <Input name="purchaserName" required className="mt-1" />
              </div>
              <div>
                <Label>CNIC</Label>
                <Input name="purchaserCnic" required className="mt-1" />
              </div>
              <div>
                <Label>Contact</Label>
                <Input name="purchaserContact" className="mt-1" />
              </div>
              <div>
                <Label>Address</Label>
                <Input name="purchaserAddress" className="mt-1" />
              </div>
              <Button type="submit" disabled={!transfer.sellerIdentityVerified}>
                Save purchaser
              </Button>
            </form>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Transfer Payment</h2>
          {transfer.payments.length > 0 ? (
            <div className="mt-3 space-y-3">
              {transfer.payments.map((p) => (
                <div key={p.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{p.receiptNumber}</span>
                    <Badge status={p.status} />
                  </div>
                  <p className="mt-1 text-slate-600">
                    {formatCurrency(p.amount)} · PO {p.poNumber || "—"} · {p.bankName || "—"}
                  </p>
                  {p.status === "SUBMITTED" && canVerifyPay ? (
                    <form action={verifyTransferPaymentAction} className="mt-2">
                      <input type="hidden" name="paymentId" value={p.id} />
                      <Button type="submit" size="sm">
                        Verify payment (Finance)
                      </Button>
                    </form>
                  ) : null}
                </div>
              ))}
            </div>
          ) : transfer.purchaserName ? (
            <form action={updateTransferStep} className="mt-4 space-y-3">
              <input type="hidden" name="id" value={transfer.id} />
              <input type="hidden" name="step" value="7" />
              <p className="text-sm font-medium">Step 7 — Payment / PO</p>
              <div>
                <Label>Amount (PKR)</Label>
                <Input name="amount" type="number" defaultValue={50000} required className="mt-1" />
              </div>
              <div>
                <Label>PO Number</Label>
                <Input name="poNumber" required className="mt-1" />
              </div>
              <div>
                <Label>Bank</Label>
                <Input name="bankName" required className="mt-1" />
              </div>
              <Button type="submit">Submit payment</Button>
            </form>
          ) : (
            <p className="mt-3 text-sm text-slate-500">Add purchaser details first.</p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Approval &amp; Completion</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Status" value={labelize(transfer.status)} />
            <Row label="Approved by" value={transfer.approvedBy?.name || "—"} />
            <Row label="Approved at" value={formatDateTime(transfer.approvedAt)} />
            <Row label="Completed by" value={transfer.completedBy?.name || "—"} />
            <Row label="Completed at" value={formatDateTime(transfer.completedAt)} />
            <Row
              label="Physical file"
              value={
                transfer.plot.physicalFile
                  ? `${transfer.plot.physicalFile.fileNumber}`
                  : "—"
              }
            />
          </dl>

          <div className="mt-4 space-y-2 border-t border-slate-100 pt-4">
            {canApprove &&
            ["APPROVAL_PENDING", "PAYMENT_VERIFICATION"].includes(transfer.status) &&
            verifiedPay ? (
              <form action={approveTransferAction}>
                <input type="hidden" name="id" value={transfer.id} />
                <Button type="submit" className="w-full">
                  Approve transfer
                </Button>
              </form>
            ) : null}

            {canComplete && transfer.status === "APPROVED" ? (
              <form action={completeTransferAction}>
                <input type="hidden" name="id" value={transfer.id} />
                <Button type="submit" className="w-full" disabled={!!activeMortgage}>
                  Complete transfer (new membership + history)
                </Button>
              </form>
            ) : null}

            {transfer.status === "COMPLETED" && transfer.toOwnership ? (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                Completed. New membership <strong>{transfer.toOwnership.membershipNumber}</strong>{" "}
                issued to {transfer.toOwnership.ownerName}. Prior membership{" "}
                <strong>{transfer.sellerMembershipNo}</strong> marked TRANSFERRED (not deleted).
              </div>
            ) : null}

            {!verifiedPay && pendingPay ? (
              <p className="text-sm text-amber-800">
                Waiting for Finance to verify payment before approval.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">{label}</dt>
      <dd className="text-right font-medium text-slate-900">{value}</dd>
    </div>
  );
}
