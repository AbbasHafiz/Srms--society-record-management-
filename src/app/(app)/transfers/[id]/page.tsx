import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, WarningBanner } from "@/components/ui/page";
import { SlaBadge, AllotmentSlaBadge } from "@/components/sla-badge";
import { formatCurrency, formatDate, formatDateTime, labelize } from "@/lib/utils";
import { hasPermission } from "@/lib/rbac";
import { plotLabel } from "@/lib/plots";
import { WhatsAppNotifyAction } from "@/components/whatsapp/whatsapp-notify-action";
import {
  DEATH_TRANSFER_DOCUMENTS,
  HEIR_RELATION_LABELS,
  deathDocumentChecklistState,
  validateDeathTransferReadiness,
} from "@/lib/death-transfer";
import {
  updateTransferStep,
  approveTransferAction,
  completeTransferAction,
  verifyTransferPaymentAction,
  addTransferHeir,
  removeTransferHeir,
  submitDeathCaseForApproval,
  markAllotmentPrintedAction,
  updateTransferRemarks,
} from "../actions";
import { HeirRelationFields } from "@/components/transfers/heir-relation-fields";
import { DocumentScansPanel } from "@/components/documents/document-scans-panel";
import { ConfirmActionForm } from "@/components/ui/confirm-action-form";
import { bindFormAction } from "@/lib/action-result";

export const dynamic = "force-dynamic";

const SALE_STEPS = [
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

const DEATH_STEPS = [
  "Case Intake",
  "Legal Heirs",
  "Documents",
  "Primary Successor",
  "Approval",
  "Completion",
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
      heirs: { orderBy: { createdAt: "asc" } },
      documents: { where: { status: "ACTIVE" }, orderBy: { createdAt: "desc" } },
    },
  });

  if (!transfer) notFound();

  const isDeath = transfer.transferType === "DEATH_SUCCESSION";
  const activeMortgage = transfer.plot.mortgages[0];
  const canApprove = session?.user && hasPermission(session.user.role, "approve");
  const canComplete = session?.user && hasPermission(session.user.role, "complete_transfer");
  const canVerifyPay = session?.user && hasPermission(session.user.role, "verify_payment");
  const canEdit = session?.user && hasPermission(session.user.role, "edit");
  const verifiedPay = transfer.payments.find((p) => p.status === "VERIFIED");
  const pendingPay = transfer.payments.find((p) => p.status === "SUBMITTED");

  const deathReadiness = isDeath
    ? validateDeathTransferReadiness({
        heirs: transfer.heirs,
        documents: transfer.documents,
      })
    : null;

  const steps = isDeath ? DEATH_STEPS : SALE_STEPS;
  const deathDocChecklist = isDeath
    ? deathDocumentChecklistState(transfer.documents, transfer.heirs)
    : null;

  return (
    <div>
      <PageHeader
        title={`${isDeath ? "Succession " : ""}Transfer ${transfer.transferNumber}`}
        description={`Plot ${transfer.plot.sector}/${transfer.plot.block}-${transfer.plot.plotNumber} · ${labelize(transfer.transferType)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {session?.user ? (
              <WhatsAppNotifyAction
                userRole={session.user.role}
                relatedModule="transfers"
                relatedRecordId={transfer.id}
                plotId={transfer.plotId}
                transferId={transfer.id}
                defaultTemplateKey={
                  transfer.status === "PAYMENT_PENDING"
                    ? "transfer_payment_pending"
                    : transfer.status === "COMPLETED"
                      ? "transfer_completed"
                      : isDeath
                        ? "transfer_death_succession"
                        : "transfer_seller_verification"
                }
                templateVars={{
                  transferNumber: transfer.transferNumber,
                  plotLabel: plotLabel(transfer.plot),
                  membershipNumber: transfer.newMembershipNumber ?? "",
                  amount: pendingPay ? formatCurrency(pendingPay.amount) : "",
                }}
                presets={[
                  ...(transfer.sellerContact
                    ? [
                        {
                          key: "seller",
                          label: "Seller",
                          name: transfer.sellerName,
                          phone: transfer.sellerContact,
                          type: "OWNER" as const,
                        },
                      ]
                    : []),
                  ...(transfer.purchaserContact && transfer.purchaserName
                    ? [
                        {
                          key: "purchaser",
                          label: "Purchaser",
                          name: transfer.purchaserName,
                          phone: transfer.purchaserContact,
                          type: "OWNER" as const,
                        },
                      ]
                    : []),
                  ...transfer.heirs
                    .filter((h) => h.contact)
                    .map((h) => ({
                      key: `heir-${h.id}`,
                      label: `Heir (${labelize(h.relationToDeceased)})`,
                      name: h.name,
                      phone: h.contact!,
                      type: "HEIR" as const,
                    })),
                ]}
                allowedModes={["preset", "custom"]}
              />
            ) : null}
            <Link href={`/plots/${transfer.plotId}`} className="text-sm text-teal-800 hover:underline">
              Open plot profile
            </Link>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <Badge status={transfer.status} />
        <Badge status={transfer.transferType} />
        {transfer.slaDueAt ? (
          <SlaBadge dueAt={transfer.slaDueAt} completedAt={transfer.completedAt} showDueDate />
        ) : null}
        {transfer.allotmentLetterDueAt || transfer.allotmentLetterPrintedAt ? (
          <AllotmentSlaBadge
            dueAt={transfer.allotmentLetterDueAt}
            printedAt={transfer.allotmentLetterPrintedAt}
          />
        ) : null}
        <span className="text-sm text-slate-500">
          Step {transfer.currentStep} of {steps.length}
        </span>
      </div>

      {canEdit && transfer.status !== "COMPLETED" ? (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <form action={updateTransferRemarks} className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <input type="hidden" name="id" value={transfer.id} />
            <label className="flex-1 text-sm">
              <Label>Case remarks</Label>
              <Input
                name="remarks"
                defaultValue={transfer.remarks ?? ""}
                className="mt-1"
                placeholder="Staff notes — heir consent, pending documents, etc."
              />
            </label>
            <Button type="submit" size="sm">
              Save remarks
            </Button>
          </form>
        </section>
      ) : null}

      {isDeath ? (
        <DeathWorkflow
          transfer={transfer}
          canEdit={!!canEdit}
          canApprove={!!canApprove}
          canComplete={!!canComplete}
          activeMortgage={!!activeMortgage}
          deathReadiness={deathReadiness}
          deathDocChecklist={deathDocChecklist}
        />
      ) : (
        <SaleWorkflow
          transfer={transfer}
          canApprove={!!canApprove}
          canComplete={!!canComplete}
          canVerifyPay={!!canVerifyPay}
          activeMortgage={activeMortgage}
          verifiedPay={verifiedPay}
          pendingPay={pendingPay}
        />
      )}
    </div>
  );
}

function DeathWorkflow({
  transfer,
  canEdit,
  canApprove,
  canComplete,
  activeMortgage,
  deathReadiness,
  deathDocChecklist,
}: {
  transfer: NonNullable<Awaited<ReturnType<typeof prisma.transfer.findUnique>> & object> & {
    heirs: { id: string; name: string; cnic: string; relationToDeceased: string; otherDetail: string | null; contact: string | null; address: string | null; isPrimarySuccessor: boolean; shareNotes: string | null }[];
    documents: { id: string; documentType: string; title: string; filePath: string; fileSize: number | null; fileName: string; documentNumber: string | null; createdAt: Date }[];
    plot: { mortgages: unknown[] };
    payments: unknown[];
    sellerVerifiedBy: { name: string } | null;
    approvedBy: { name: string } | null;
    completedBy: { name: string } | null;
    toOwnership: { membershipNumber: string; ownerName: string } | null;
  };
  canEdit: boolean;
  canApprove: boolean;
  canComplete: boolean;
  activeMortgage: boolean;
  deathReadiness: ReturnType<typeof validateDeathTransferReadiness> | null;
  deathDocChecklist: ReturnType<typeof deathDocumentChecklistState> | null;
}) {
  const deathScans = [
    ...DEATH_TRANSFER_DOCUMENTS.filter((doc) => doc.type !== "HEIR_CNIC").map((doc) => ({
      plotId: transfer.plotId,
      transferId: transfer.id,
      documentType: doc.type,
      title: doc.label,
      description: doc.description,
    })),
    ...transfer.heirs.map((h) => ({
      plotId: transfer.plotId,
      transferId: transfer.id,
      documentType: "HEIR_CNIC" as const,
      title: `CNIC — ${h.name}`,
      description: `${HEIR_RELATION_LABELS[h.relationToDeceased as keyof typeof HEIR_RELATION_LABELS]} · ${h.cnic}`,
      documentNumber: h.cnic,
    })),
  ];
  return (
    <>
      {activeMortgage ? (
        <div className="mb-4">
          <WarningBanner>
            Active mortgage on plot. Succession transfer cannot be completed until bank NOC / release.
          </WarningBanner>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-violet-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold text-violet-950">Deceased Member</h2>
          <dl className="mt-3 space-y-2 text-sm">
            <Row label="Name" value={transfer.sellerName} />
            <Row label="CNIC" value={transfer.sellerCnic} />
            <Row label="Membership" value={transfer.sellerMembershipNo} />
            <Row label="Date of death" value={formatDate(transfer.deceasedDateOfDeath)} />
            <Row label="Death cert. ref" value={transfer.deathCertificateRef || "—"} />
            <Row label="Remarks" value={transfer.remarks || "—"} />
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Legal Heirs</h2>
          {transfer.heirs.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {transfer.heirs.map((h) => (
                <li key={h.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">
                        {h.name}{" "}
                        {h.isPrimarySuccessor ? (
                          <span className="text-xs font-semibold text-teal-800">(Primary successor)</span>
                        ) : null}
                      </p>
                      <p className="text-slate-600">
                        {h.relationToDeceased === "OTHER" && h.otherDetail
                          ? h.otherDetail
                          : HEIR_RELATION_LABELS[h.relationToDeceased as keyof typeof HEIR_RELATION_LABELS]}{" "}
                        · {h.cnic}
                      </p>
                      {h.shareNotes ? <p className="mt-1 text-slate-500">{h.shareNotes}</p> : null}
                    </div>
                    {canEdit && transfer.status !== "COMPLETED" ? (
                      <form action={removeTransferHeir}>
                        <input type="hidden" name="heirId" value={h.id} />
                        <Button type="submit" variant="outline" size="sm" className="h-7 text-xs">
                          Remove
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-3 text-sm text-slate-500">No heirs recorded yet.</p>
          )}

          {canEdit && transfer.status !== "COMPLETED" ? (
            <form action={addTransferHeir} className="mt-4 space-y-3 border-t border-slate-100 pt-4">
              <input type="hidden" name="transferId" value={transfer.id} />
              <p className="text-sm font-medium">Add legal heir</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Name</Label>
                  <Input name="name" required className="mt-1" />
                </div>
                <div>
                  <Label>CNIC</Label>
                  <Input name="cnic" required className="mt-1" placeholder="35202-1234567-1" />
                </div>
                <HeirRelationFields />
                <div>
                  <Label>Contact</Label>
                  <Input name="contact" className="mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Address</Label>
                  <Input name="address" className="mt-1" />
                </div>
                <div className="sm:col-span-2">
                  <Label>Share / remarks</Label>
                  <Input name="shareNotes" className="mt-1" placeholder="e.g. 1/3 share — consents to widow as primary" />
                </div>
                <label className="flex items-center gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" name="isPrimarySuccessor" value="yes" />
                  Nominate as primary successor (membership holder)
                </label>
              </div>
              <Button type="submit" size="sm">
                Add heir
              </Button>
            </form>
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Required Documents Checklist</h2>
          <p className="mt-1 text-sm text-slate-600">
            Society-office checklist for death / succession transfer (Pakistani practice).
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {DEATH_TRANSFER_DOCUMENTS.map((doc) => {
              const uploaded = deathDocChecklist?.[doc.type] ?? false;
              return (
                <div
                  key={doc.type}
                  className={`flex items-start gap-2 rounded-lg border p-3 text-sm ${
                    uploaded
                      ? "border-emerald-200 bg-emerald-50"
                      : doc.mandatory
                        ? "border-amber-200 bg-amber-50"
                        : "border-slate-200 bg-white"
                  }`}
                >
                  <span className="mt-0.5">{uploaded ? "✓" : doc.mandatory ? "○" : "·"}</span>
                  <div className="flex-1">
                    <p className="font-medium">
                      {doc.label}
                      {doc.mandatory ? (
                        <span className="ml-1 text-xs text-rose-700">(required)</span>
                      ) : null}
                    </p>
                    {doc.description ? (
                      <p className="text-xs text-slate-600">{doc.description}</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {canEdit && transfer.status !== "COMPLETED" ? (
            <DocumentScansPanel
              heading="Document Scans"
              description="Upload scanned copies for each required succession document. New uploads create a new version; prior scans are preserved. Heir CNIC scans are uploaded separately for each legal heir."
              scans={deathScans}
            />
          ) : (
            <DocumentScansPanel heading="Uploaded Scans" scans={deathScans} />
          )}

          {transfer.heirs.length === 0 ? (
            <p className="mt-3 text-sm text-amber-800">
              Add legal heirs before uploading heir CNIC scans.
            </p>
          ) : null}

          {deathReadiness && !deathReadiness.ok && transfer.status !== "COMPLETED" ? (
            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
              <p className="font-medium">Cannot complete until:</p>
              <ul className="mt-1 list-inside list-disc">
                {deathReadiness.errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="font-display text-lg font-semibold">Approval &amp; Completion</h2>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <Row label="Status" value={labelize(transfer.status)} />
            <Row label="Approved by" value={transfer.approvedBy?.name || "—"} />
            <Row label="Approved at" value={formatDateTime(transfer.approvedAt)} />
            <Row label="Completed by" value={transfer.completedBy?.name || "—"} />
            <Row label="Completed at" value={formatDateTime(transfer.completedAt)} />
          </dl>

          <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
            {canEdit &&
            ["DOCUMENTS_PENDING", "DRAFT"].includes(transfer.status) &&
            transfer.heirs.some((h) => h.isPrimarySuccessor) ? (
              <form action={submitDeathCaseForApproval}>
                <input type="hidden" name="id" value={transfer.id} />
                <Button type="submit" variant="outline" disabled={!deathReadiness?.ok}>
                  Submit for approval
                </Button>
              </form>
            ) : null}

            {canApprove && transfer.status === "APPROVAL_PENDING" ? (
              <form action={approveTransferAction}>
                <input type="hidden" name="id" value={transfer.id} />
                <Button type="submit">Approve succession case</Button>
              </form>
            ) : null}

            {canComplete && transfer.status === "APPROVED" ? (
              <ConfirmActionForm
                action={bindFormAction(completeTransferAction)}
                confirmTitle="Complete succession transfer?"
                confirmDescription="This will issue a new membership to the primary heir and mark the deceased membership as TRANSFERRED. Ownership history is preserved and this step cannot be undone."
                submitLabel="Complete succession (new membership)"
                disabled={!!activeMortgage || !deathReadiness?.ok}
              >
                <input type="hidden" name="id" value={transfer.id} />
              </ConfirmActionForm>
            ) : null}

            {transfer.status === "COMPLETED" && transfer.toOwnership ? (
              <div className="w-full rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
                Succession completed. New membership{" "}
                <strong>{transfer.toOwnership.membershipNumber}</strong> issued to{" "}
                {transfer.toOwnership.ownerName}. Deceased membership{" "}
                <strong>{transfer.sellerMembershipNo}</strong> marked TRANSFERRED (history preserved).
              </div>
            ) : null}

            {transfer.status === "COMPLETED" &&
            !transfer.allotmentLetterPrintedAt &&
            canComplete ? (
              <form action={markAllotmentPrintedAction}>
                <input type="hidden" name="id" value={transfer.id} />
                <Button type="submit" variant="outline" size="sm">
                  Mark allotment letter printed
                </Button>
              </form>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}

function SaleWorkflow({
  transfer,
  canApprove,
  canComplete,
  canVerifyPay,
  activeMortgage,
  verifiedPay,
  pendingPay,
}: {
  transfer: NonNullable<Awaited<ReturnType<typeof prisma.transfer.findUnique>> & object> & {
    plot: { mortgages: { bankName: string }[]; physicalFile: { fileNumber: string } | null };
    payments: { id: string; receiptNumber: string; status: string; amount: string | number | { toString(): string }; poNumber: string | null; bankName: string | null }[];
    sellerVerifiedBy: { name: string } | null;
    approvedBy: { name: string } | null;
    completedBy: { name: string } | null;
    toOwnership: { membershipNumber: string; ownerName: string } | null;
  };
  canApprove: boolean;
  canComplete: boolean;
  canVerifyPay: boolean;
  activeMortgage?: { bankName: string };
  verifiedPay?: { id: string };
  pendingPay?: { id: string };
}) {
  return (
    <>
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

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <DocumentScansPanel
            heading="Transfer Document Scans"
            description="Upload seller/purchaser CNIC, transfer form, and payment PO scans. Each new upload is versioned; older scans remain on file."
            scans={[
              {
                plotId: transfer.plotId,
                transferId: transfer.id,
                ownershipId: transfer.sellerOwnershipId ?? undefined,
                documentType: "CNIC",
                title: "Seller CNIC",
              },
              {
                plotId: transfer.plotId,
                transferId: transfer.id,
                documentType: "CNIC",
                title: "Purchaser CNIC",
              },
              {
                plotId: transfer.plotId,
                transferId: transfer.id,
                documentType: "TRANSFER_FORM",
                title: "Transfer Form",
              },
              {
                plotId: transfer.plotId,
                transferId: transfer.id,
                documentType: "PAYMENT_PO",
                title: "Payment / PO Scan",
              },
            ]}
          />
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
              <ConfirmActionForm
                action={bindFormAction(completeTransferAction)}
                confirmTitle="Complete transfer?"
                confirmDescription="This will issue a new membership to the purchaser and mark the seller membership as TRANSFERRED. Ownership history is preserved and this step cannot be undone."
                submitLabel="Complete transfer (new membership + history)"
                className="w-full"
                buttonClassName="w-full"
                disabled={!!activeMortgage}
              >
                <input type="hidden" name="id" value={transfer.id} />
              </ConfirmActionForm>
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
    </>
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
