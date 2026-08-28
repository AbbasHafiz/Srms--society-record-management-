import Link from "next/link";
import { revalidatePath } from "next/cache";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { renewOpenFile } from "@/lib/services";
import { PageHeader, WarningBanner } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, daysUntil, labelize } from "@/lib/utils";
import { plotLabel } from "@/lib/plots";
import { WhatsAppNotifyAction } from "@/components/whatsapp/whatsapp-notify-action";
import { DocumentScansPanel } from "@/components/documents/document-scans-panel";
import { cancelOpenFile, startCloseInPurchaserName } from "../actions";
import { assignRegisteredOfficeToOpenFile } from "@/app/(app)/offices/actions";
import { RegisteredOfficeSelect } from "@/components/offices/registered-office-select";
import { QueryErrorBanner } from "@/components/ui/confirm-on-submit-form";
import { ConfirmOnSubmitForm } from "@/components/ui/confirm-on-submit-form";
import { fileDownloadHref } from "@/lib/uploads";
import { canRegisterOpenFile, hasPermission } from "@/lib/rbac";
import { isLiveOpenFileStatus, openFileStatusLabel } from "@/lib/open-files";
import { OPEN_FILE_STORY, holderTypeLabel, sellerAppearanceLabel } from "@/lib/open-files-shared";
import { poaKindLabel } from "@/lib/poa-shared";
import { getFbrTaxRates } from "@/lib/fbr-tax";
import { FbrTaxAssessmentsPanel } from "@/components/tax/fbr-tax-assessments-panel";
import { PrintButton } from "@/components/print/print-button";

export const dynamic = "force-dynamic";

async function renewAction(formData: FormData) {
  "use server";

  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const openFileId = formData.get("openFileId") as string;
  const periods = Number(formData.get("periods") || 1);
  if (!openFileId || periods < 1) throw new Error("Invalid renewal request");

  await renewOpenFile(openFileId, periods, session.user.id);
  revalidatePath(`/open-files/${openFileId}`);
  revalidatePath("/open-files");
  redirect(`/open-files/${openFileId}`);
}

async function assignOfficeAction(formData: FormData) {
  "use server";
  await assignRegisteredOfficeToOpenFile(formData);
  const openFileId = String(formData.get("openFileId") || "");
  revalidatePath(`/open-files/${openFileId}`);
}

export default async function OpenFileDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;

  const openFile = await prisma.openFile.findUnique({
    where: { id },
    include: {
      plot: true,
      ownership: true,
      registeredOffice: true,
      powerOfAttorney: true,
      transfer: { select: { id: true, transferNumber: true, status: true } },
      renewals: { orderBy: { renewalDate: "desc" } },
      payments: { orderBy: { createdAt: "desc" } },
      considerations: { orderBy: { createdAt: "desc" } },
      taxAssessments: { orderBy: { createdAt: "asc" } },
      documents: {
        where: { documentType: { in: ["DEALER_LETTERHEAD", "ALLOTMENT_LETTER"] } },
        orderBy: { version: "desc" },
      },
    },
  });

  if (!openFile) notFound();

  const session = await auth();
  const canCreate = session?.user && canRegisterOpenFile(session.user.role);
  const canEdit = session?.user && (hasPermission(session.user.role, "edit") || canCreate);
  const canMarkPaid =
    session?.user &&
    (hasPermission(session.user.role, "verify_payment") ||
      hasPermission(session.user.role, "edit") ||
      hasPermission(session.user.role, "complete_transfer"));
  const fbrRates = await getFbrTaxRates();
  const days = daysUntil(openFile.expiryDate);
  const live = isLiveOpenFileStatus(openFile.status);
  const canClose = live || openFile.status === "EXPIRED";
  const expiringSoon = live && days <= 30;
  const poPayment = openFile.payments.find((p) => p.feeType === "OPEN_FILE") ?? openFile.payments[0];
  const letterhead =
    openFile.documents.find((d) => d.id === openFile.letterheadDocumentId) ??
    openFile.documents.find((d) => d.documentType === "DEALER_LETTERHEAD");
  const allotment =
    openFile.documents.find((d) => d.id === openFile.allotmentLetterDocumentId) ??
    openFile.documents.find((d) => d.documentType === "ALLOTMENT_LETTER");
  const consideration = openFile.considerations[0];
  const purchaserEmpty = !openFile.purchaserName;

  return (
    <div>
      <PageHeader
        title={openFile.openFileNumber}
        description={OPEN_FILE_STORY}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {session?.user ? (
              <WhatsAppNotifyAction
                userRole={session.user.role}
                relatedModule="open-files"
                relatedRecordId={openFile.id}
                plotId={openFile.plotId}
                defaultTemplateKey="open_file_expiry"
                templateVars={{
                  openFileNumber: openFile.openFileNumber,
                  plotLabel: plotLabel(openFile.plot),
                  expiryDate: formatDate(openFile.expiryDate),
                }}
                presets={[
                  ...(openFile.ownership?.contact
                    ? [
                        {
                          key: "seller",
                          label: "Seller / owner",
                          name: openFile.sellerName,
                          phone: openFile.ownership.contact,
                          type: "OWNER" as const,
                        },
                      ]
                    : []),
                ]}
                allowedModes={["preset", "custom"]}
              />
            ) : null}
            <PrintButton href={`/open-files/${openFile.id}/print`} label="Print slip" />
            <Link href="/open-files" className="text-sm text-teal-800 hover:underline">
              ← Back to list
            </Link>
          </div>
        }
      />

      <QueryErrorBanner error={sp.error} />

      {expiringSoon ? (
        <div className="mb-4">
          <WarningBanner>
            This open file expires in <strong>{days <= 0 ? "0 (overdue)" : days}</strong> day
            {days === 1 ? "" : "s"}. Renew the window, record an end buyer, or withdraw it without
            changing ownership.
          </WarningBanner>
        </div>
      ) : null}

      {openFile.status === "CLOSED" ? (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-950">
          Closed in purchaser&apos;s name
          {openFile.purchaserName ? (
            <>
              : <strong>{openFile.purchaserName}</strong>
            </>
          ) : null}
          . Plot ownership history now includes the purchaser.
          {openFile.transfer ? (
            <>
              {" "}
              Sale transfer{" "}
              <Link href={`/transfers/${openFile.transfer.id}`} className="font-medium underline">
                {openFile.transfer.transferNumber}
              </Link>
              .
            </>
          ) : null}
        </div>
      ) : null}

      {openFile.status === "CANCELLED" ? (
        <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800">
          Withdrawn / cancelled without an end buyer. Ownership was not changed.
          {openFile.cancellationReason ? <> Reason: {openFile.cancellationReason}</> : null}
        </div>
      ) : null}

      {live && purchaserEmpty ? (
        <div className="mb-4 rounded-lg border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-950">
          {OPEN_FILE_STORY} Legal membership remains <strong>{openFile.sellerName}</strong>. Open-file
          holder is {openFile.holderName ?? "not recorded"}.
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Open transfer</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid gap-3 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Plot</dt>
                <dd>
                  <Link href={`/plots/${openFile.plotId}`} className="font-medium text-teal-900 hover:underline">
                    {openFile.plot.sector}/{openFile.plot.block}-{openFile.plot.plotNumber}
                  </Link>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Status</dt>
                <dd>
                  <Badge status={openFile.status}>{openFileStatusLabel(openFile.status)}</Badge>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Seller (legal member)</dt>
                <dd>{openFile.sellerName}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Seller CNIC</dt>
                <dd>{openFile.sellerCnic}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Membership</dt>
                <dd>{openFile.sellerMembershipNo ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Seller appearance</dt>
                <dd>{sellerAppearanceLabel(openFile.sellerAppearance)}</dd>
              </div>
              {openFile.powerOfAttorney ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase text-slate-500">Attorney</dt>
                  <dd>
                    <Link href={`/poa/${openFile.powerOfAttorney.id}`} className="text-teal-900 hover:underline">
                      {openFile.powerOfAttorney.poaNumber}
                    </Link>{" "}
                    · {openFile.powerOfAttorney.attorneyName} ({poaKindLabel(openFile.powerOfAttorney.kind)})
                  </dd>
                </div>
              ) : null}
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Holder (XYZ)</dt>
                <dd>
                  {openFile.holderName ?? "—"}
                  {openFile.holderType ? ` · ${holderTypeLabel(openFile.holderType)}` : ""}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">XYZ CNIC</dt>
                <dd>{openFile.holderCnic ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">End purchaser</dt>
                <dd>
                  {purchaserEmpty ? (
                    <span className="text-amber-800">Empty until a buyer purchases this open file</span>
                  ) : (
                    openFile.purchaserName
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Letterhead dealer</dt>
                <dd>
                  {openFile.registeredOffice ? (
                    <Link href={`/offices/${openFile.registeredOffice.id}`} className="text-teal-900 hover:underline">
                      {openFile.registeredOffice.officeName}
                    </Link>
                  ) : (
                    openFile.dealerName
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Letterhead scan</dt>
                <dd>
                  {letterhead ? (
                    <a
                      href={fileDownloadHref(letterhead.filePath)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-900 hover:underline"
                    >
                      View scan (v{letterhead.version})
                    </a>
                  ) : (
                    <span className="text-amber-800">No letterhead scan on this file yet</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Allotment letter</dt>
                <dd>
                  {allotment ? (
                    <a
                      href={fileDownloadHref(allotment.filePath)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-900 hover:underline"
                    >
                      View scan (v{allotment.version})
                    </a>
                  ) : (
                    <span className="text-amber-800">No allotment letter scan</span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Opened</dt>
                <dd>{formatDate(openFile.openingDate)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Expiry</dt>
                <dd>{formatDate(openFile.expiryDate)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Society open-file fee</dt>
                <dd>{formatCurrency(openFile.feeAmount)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-slate-500">Dues</dt>
                <dd>
                  {openFile.duesClearedAt
                    ? `Cleared ${formatDate(openFile.duesClearedAt)}`
                    : openFile.duesOverrideReason
                      ? `Override: ${openFile.duesOverrideReason}`
                      : "—"}
                </dd>
              </div>
              {openFile.purchaserCnic ? (
                <div>
                  <dt className="text-xs font-medium uppercase text-slate-500">Purchaser CNIC</dt>
                  <dd>{openFile.purchaserCnic}</dd>
                </div>
              ) : null}
              {openFile.transfer ? (
                <div className="sm:col-span-2">
                  <dt className="text-xs font-medium uppercase text-slate-500">Sale transfer</dt>
                  <dd>
                    <Link href={`/transfers/${openFile.transfer.id}`} className="text-teal-900 hover:underline">
                      {openFile.transfer.transferNumber}
                    </Link>{" "}
                    <Badge status={openFile.transfer.status} />
                  </dd>
                </div>
              ) : null}
            </dl>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Private consideration (seller ← XYZ)</CardTitle>
            </CardHeader>
            <CardContent>
              {consideration ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Amount</dt>
                    <dd className="font-medium">{formatCurrency(consideration.amount)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Date</dt>
                    <dd>{formatDate(consideration.paidAt)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Method</dt>
                    <dd>
                      {labelize(consideration.paymentMethod)}
                      {consideration.methodOther ? ` (${consideration.methodOther})` : ""}
                    </dd>
                  </div>
                  <p className="pt-2 text-xs text-slate-500">
                    Private sale row — not a society fee. Consideration rows are never overwritten.
                  </p>
                </dl>
              ) : (
                <p className="text-sm text-slate-600">No consideration row (older files may predate this).</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Pay order (society open-file fee)</CardTitle>
            </CardHeader>
            <CardContent>
              {poPayment ? (
                <dl className="space-y-2 text-sm">
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Receipt</dt>
                    <dd className="font-medium">{poPayment.receiptNumber}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Method</dt>
                    <dd>Pay order</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">P.O. number</dt>
                    <dd>{poPayment.poNumber ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Issuing bank</dt>
                    <dd>{poPayment.bankName ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">P.O. date</dt>
                    <dd>{formatDate(poPayment.poDate)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Amount</dt>
                    <dd>{formatCurrency(poPayment.amount)}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-slate-500">Status</dt>
                    <dd>
                      <Badge status={poPayment.status} />
                    </dd>
                  </div>
                  <p className="pt-2 text-xs text-slate-500">
                    Payment rows are never overwritten. Finance verifies the P.O. from the Payments
                    register.
                  </p>
                  <div className="pt-3">
                    <PrintButton href={`/payments/${poPayment.id}/print`} label="Print receipt" size="sm" />
                  </div>
                  <Link href="/payments" className="text-xs text-teal-800 hover:underline">
                    Open payments →
                  </Link>
                </dl>
              ) : (
                <p className="text-sm text-amber-800">
                  No pay-order payment row is linked yet. Older files may predate this requirement.
                </p>
              )}
            </CardContent>
          </Card>

          {canClose && canCreate ? (
            <Card>
              <CardHeader>
                <CardTitle>Record end buyer / close file</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-slate-600">
                  When a buyer purchases this open file they must prove identity (CNIC scan + particulars)
                  and pay the society transfer fee in the sale transfer wizard. Completing that transfer
                  closes this file in the buyer&apos;s name and adds a new ACTIVE ownership row — the
                  seller row is never overwritten.
                </p>
                {openFile.transfer &&
                openFile.transfer.status !== "COMPLETED" &&
                openFile.transfer.status !== "CANCELLED" ? (
                  <p className="mb-3 text-sm">
                    Sale transfer already started:{" "}
                    <Link href={`/transfers/${openFile.transfer.id}`} className="font-medium text-teal-900 underline">
                      {openFile.transfer.transferNumber}
                    </Link>
                    . Updating particulars below continues that case.
                  </p>
                ) : null}
                <form action={startCloseInPurchaserName} className="space-y-3">
                  <input type="hidden" name="openFileId" value={openFile.id} />
                  <div>
                    <Label htmlFor="purchaserName">End-buyer name</Label>
                    <Input
                      id="purchaserName"
                      name="purchaserName"
                      required
                      className="mt-1"
                      defaultValue={openFile.purchaserName ?? ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="purchaserCnic">End-buyer CNIC</Label>
                    <Input
                      id="purchaserCnic"
                      name="purchaserCnic"
                      required
                      className="mt-1"
                      placeholder="12345-1234567-1"
                      defaultValue={openFile.purchaserCnic ?? ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="purchaserCnicScan">CNIC scan</Label>
                    <Input
                      id="purchaserCnicScan"
                      name="purchaserCnicScan"
                      type="file"
                      required
                      accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="purchaserContact">Contact</Label>
                    <Input
                      id="purchaserContact"
                      name="purchaserContact"
                      className="mt-1"
                      defaultValue={openFile.purchaserContact ?? ""}
                    />
                  </div>
                  <div>
                    <Label htmlFor="purchaserAddress">Address</Label>
                    <Input
                      id="purchaserAddress"
                      name="purchaserAddress"
                      className="mt-1"
                      defaultValue={openFile.purchaserAddress ?? ""}
                    />
                  </div>
                  <Button type="submit" className="w-full">
                    Record end buyer / close file
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {canClose && canEdit ? (
            <Card>
              <CardHeader>
                <CardTitle>Withdraw without end buyer</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-3 text-sm text-slate-600">
                  Cancel this open transfer if the seller or XYZ pulls the file. Ownership stays with{" "}
                  {openFile.sellerName}.
                </p>
                <ConfirmOnSubmitForm
                  action={cancelOpenFile}
                  confirmMessage="Withdraw this open file without changing ownership?"
                  className="space-y-3"
                >
                  <input type="hidden" name="openFileId" value={openFile.id} />
                  <div>
                    <Label htmlFor="cancellationReason">Reason</Label>
                    <Input
                      id="cancellationReason"
                      name="cancellationReason"
                      required
                      className="mt-1"
                      placeholder="e.g. Seller withdrew, expired without buyer"
                    />
                  </div>
                  <Button type="submit" variant="outline" className="w-full">
                    Cancel / withdraw
                  </Button>
                </ConfirmOnSubmitForm>
              </CardContent>
            </Card>
          ) : null}

          {live ? (
            <Card>
              <CardHeader>
                <CardTitle>Renew open-file window</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={renewAction} className="space-y-4">
                  <input type="hidden" name="openFileId" value={openFile.id} />
                  <div>
                    <Label htmlFor="periods">Periods to renew</Label>
                    <Input
                      id="periods"
                      name="periods"
                      type="number"
                      min={1}
                      max={12}
                      defaultValue={1}
                      className="mt-1"
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      Each period extends by the configured open-file fee period and creates a new
                      pending payment row.
                    </p>
                  </div>
                  <Button type="submit" variant="secondary" className="w-full">
                    Renew &amp; create payment
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}

          {canEdit && !openFile.registeredOfficeId ? (
            <Card>
              <CardHeader>
                <CardTitle>Link registered dealer</CardTitle>
              </CardHeader>
              <CardContent>
                <form action={assignOfficeAction} className="space-y-3">
                  <input type="hidden" name="openFileId" value={openFile.id} />
                  <RegisteredOfficeSelect defaultValue={openFile.registeredOfficeId ?? ""} />
                  <p className="text-xs text-slate-500">
                    Older files may only have a free-text dealer name. Link the register record.
                  </p>
                  <Button type="submit" size="sm" className="w-full">
                    Save dealer link
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </div>
      </div>

      {openFile.renewals.length > 0 ? (
        <section className="mt-8 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="font-display text-lg font-semibold">Renewal history</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Previous expiry</th>
                  <th>New expiry</th>
                  <th>Periods</th>
                  <th>Fee</th>
                  <th>Payment</th>
                </tr>
              </thead>
              <tbody>
                {openFile.renewals.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.renewalDate)}</td>
                    <td>{formatDate(r.previousExpiry)}</td>
                    <td>{formatDate(r.newExpiry)}</td>
                    <td>{r.periods}</td>
                    <td>{formatCurrency(r.feeAmount)}</td>
                    <td>
                      <Badge status={r.paymentStatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <div className="mt-8">
        <DocumentScansPanel
          heading="Open file scans"
          description="Allotment letter and dealer letterhead are required at opening. Supporting papers stay versioned on this file."
          scans={[
            {
              plotId: openFile.plotId,
              openFileId: openFile.id,
              ownershipId: openFile.ownershipId ?? undefined,
              documentType: "ALLOTMENT_LETTER",
              title: "Allotment letter",
              description: "Handed to XYZ with the plot documents",
            },
            {
              plotId: openFile.plotId,
              openFileId: openFile.id,
              ownershipId: openFile.ownershipId ?? undefined,
              documentType: "DEALER_LETTERHEAD",
              title: "Dealer open-transfer letterhead",
            },
            {
              plotId: openFile.plotId,
              openFileId: openFile.id,
              ownershipId: openFile.ownershipId ?? undefined,
              documentType: "CNIC",
              title: "CNIC",
              description: "Seller, XYZ, or end-buyer identity scans",
            },
            {
              plotId: openFile.plotId,
              openFileId: openFile.id,
              ownershipId: openFile.ownershipId ?? undefined,
              documentType: "SITE_PLAN",
              title: "Site plan",
            },
            {
              plotId: openFile.plotId,
              openFileId: openFile.id,
              ownershipId: openFile.ownershipId ?? undefined,
              documentType: "PREVIOUS_TRANSFER",
              title: "Previous transfer",
            },
            {
              plotId: openFile.plotId,
              openFileId: openFile.id,
              ownershipId: openFile.ownershipId ?? undefined,
              documentType: "PAYMENT_PO",
              title: "Pay order scan",
              description: "Optional image of the society open-file fee P.O.",
            },
            {
              plotId: openFile.plotId,
              openFileId: openFile.id,
              ownershipId: openFile.ownershipId ?? undefined,
              documentType: "OPEN_FILE_DOCUMENT",
              title: "Other open-file papers",
            },
          ]}
        />
      </div>

      <div className="mt-6">
        <FbrTaxAssessmentsPanel
          assessments={openFile.taxAssessments.map((a) => ({
            id: a.id,
            assessmentNumber: a.assessmentNumber,
            taxSection: a.taxSection,
            partyRole: a.partyRole,
            filerStatus: a.filerStatus,
            dcValueSnapshot: String(a.dcValueSnapshot),
            ratePercent: String(a.ratePercent),
            amount: String(a.amount),
            paymentStatus: a.paymentStatus,
            challanNumber: a.challanNumber,
            cprNumber: a.cprNumber,
            paidAt: a.paidAt,
            partyName: a.partyName,
            partyCnic: a.partyCnic,
            createdAt: a.createdAt,
          }))}
          plotId={openFile.plotId}
          transferId={openFile.transferId}
          openFileId={openFile.id}
          dcValueDefault={openFile.plot.dcValue ? String(openFile.plot.dcValue) : ""}
          rates={fbrRates}
          sellerName={openFile.sellerName}
          purchaserName={openFile.purchaserName}
          canRecord={!!canEdit && live}
          canMarkPaid={!!canMarkPaid}
          allow236C
          allow236K={false}
          emptyTitle="No seller 236C recorded"
          emptyDescription="Open files record only seller FBR 236C on the DC value. Purchaser 236K is assessed when an end buyer transfers into their name."
        />
      </div>
    </div>
  );
}
