import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, WarningBanner } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { issueNoc, updateNocReview } from "../actions";
import { DocumentScansPanel } from "@/components/documents/document-scans-panel";
import { plotTypeLabel } from "@/lib/plots";
import {
  CONSTRUCTION_TYPE_LABELS,
  NOC_PURPOSE_LABELS,
  plotSizeDisplay,
} from "@/lib/property-sizes";
import { canApproveNoc } from "@/lib/noc";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { plotLabel } from "@/lib/plots";
import { WhatsAppNotifyAction } from "@/components/whatsapp/whatsapp-notify-action";

export const dynamic = "force-dynamic";

export default async function NocDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const canReview = session?.user && canApproveNoc(session.user.role);

  const noc = await prisma.noc.findUnique({
    where: { id },
    include: {
      plot: true,
      ownership: true,
      approvedBy: { select: { name: true } },
    },
  });

  if (!noc) notFound();

  const mortgaged = noc.plot.hasActiveMortgage;
  const canIssue = canReview && ["SUBMITTED", "UNDER_REVIEW", "APPROVED"].includes(noc.status);

  return (
    <div>
      <div className="mb-4">
        <Link href="/noc" className="text-sm text-teal-800 hover:underline">
          ← NOC register
        </Link>
      </div>

      <PageHeader
        title={noc.applicationNumber}
        description={
          noc.purpose === "CONSTRUCTION"
            ? "Construction NOC — owner applied to society to build on this plot"
            : "No Objection Certificate application"
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {session?.user && noc.ownership?.contact ? (
              <WhatsAppNotifyAction
                userRole={session.user.role}
                relatedModule="noc"
                relatedRecordId={noc.id}
                plotId={noc.plotId}
                defaultTemplateKey={
                  noc.status === "ISSUED" ? "noc_issued" : "noc_submitted"
                }
                templateVars={{
                  applicationNumber: noc.applicationNumber,
                  plotLabel: plotLabel(noc.plot),
                  purpose: NOC_PURPOSE_LABELS[noc.purpose] ?? noc.purpose,
                  nocNumber: noc.nocNumber ?? "",
                  expiryDate: noc.expiryDate ? formatDate(noc.expiryDate) : "",
                  dueDate: noc.slaDueAt ? formatDate(noc.slaDueAt) : "",
                }}
                presets={[
                  {
                    key: "applicant",
                    label: "Applicant",
                    name: noc.applicantName,
                    phone: noc.ownership!.contact!,
                    type: "OWNER",
                  },
                ]}
                allowedModes={["preset", "custom"]}
              />
            ) : null}
            <Badge status={noc.status} />
          </div>
        }
      />

      {mortgaged && noc.purpose === "CONSTRUCTION" ? (
        <div className="mb-4">
          <WarningBanner>
            Active bank mortgage on plot {noc.plot.sector}/{noc.plot.block}-{noc.plot.plotNumber}.
            Verify bank clearance before issuing construction NOC.
          </WarningBanner>
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display mb-4 text-lg font-semibold">Application</h2>
          <dl className="space-y-3 text-sm">
            <Row label="Applicant" value={noc.applicantName} />
            <Row label="Purpose" value={NOC_PURPOSE_LABELS[noc.purpose] ?? labelize(noc.purpose)} />
            {noc.constructionType ? (
              <Row
                label="Construction type"
                value={CONSTRUCTION_TYPE_LABELS[noc.constructionType] ?? labelize(noc.constructionType)}
              />
            ) : null}
            <Row label="Applied on" value={formatDate(noc.applicationDate)} />
            <Row label="Fee" value={noc.fee ? formatCurrency(noc.fee) : "—"} />
            <Row label="Payment" value={<Badge status={noc.paymentStatus} />} />
            {noc.applicationNotes ? (
              <Row label="Notes" value={noc.applicationNotes} />
            ) : null}
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display mb-4 text-lg font-semibold">Plot</h2>
          <dl className="space-y-3 text-sm">
            <Row
              label="Plot"
              value={
                <Link href={`/plots/${noc.plotId}?tab=noc`} className="text-teal-900 hover:underline">
                  {noc.plot.sector}/{noc.plot.block}-{noc.plot.plotNumber}
                </Link>
              }
            />
            <Row label="Property type" value={plotTypeLabel(noc.plot.plotType)} />
            <Row
              label="Plot size"
              value={
                <span className="font-semibold text-teal-900">{plotSizeDisplay(noc.plot)}</span>
              }
            />
            <Row label="Owner membership" value={noc.ownership?.membershipNumber ?? "—"} />
            <Row label="Owner CNIC" value={noc.ownership?.cnic ?? "—"} />
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="font-display mb-4 text-lg font-semibold">Issuance</h2>
          {noc.status === "ISSUED" ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Row label="NOC number" value={noc.nocNumber ?? "—"} />
              <Row label="Issue date" value={formatDate(noc.issueDate)} />
              <Row label="Expiry" value={formatDate(noc.expiryDate)} />
              <Row label="Approved by" value={noc.approvedBy?.name ?? "—"} />
              <Row
                label="Document"
                value={
                  noc.documentPath ? (
                    <span className="font-mono text-xs">{noc.documentPath}</span>
                  ) : (
                    "— (upload placeholder)"
                  )
                }
              />
              {noc.remarks ? <Row label="Remarks" value={noc.remarks} /> : null}
            </dl>
          ) : canReview ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <form action={updateNocReview} className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <h3 className="font-medium text-slate-900">Review</h3>
                <input type="hidden" name="nocId" value={noc.id} />
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Status
                  </label>
                  <select
                    name="status"
                    defaultValue={noc.status === "SUBMITTED" ? "UNDER_REVIEW" : noc.status}
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="UNDER_REVIEW">Under review</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Remarks
                  </label>
                  <textarea
                    name="remarks"
                    rows={2}
                    defaultValue={noc.remarks ?? ""}
                    className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <Button type="submit" variant="outline">
                  Update review
                </Button>
              </form>

              {canIssue ? (
                <form action={issueNoc} encType="multipart/form-data" className="space-y-3 rounded-lg border border-teal-100 bg-teal-50/40 p-4">
                  <h3 className="font-medium text-teal-950">Issue NOC</h3>
                  <input type="hidden" name="nocId" value={noc.id} />
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                      Issue date
                    </label>
                    <input
                      name="issueDate"
                      type="date"
                      defaultValue={new Date().toISOString().slice(0, 10)}
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                      Expiry date (optional)
                    </label>
                    <input
                      name="expiryDate"
                      type="date"
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                      NOC document (optional PDF/image)
                    </label>
                    <input
                      name="file"
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                      Issue remarks
                    </label>
                    <textarea
                      name="remarks"
                      rows={2}
                      className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
                    />
                  </div>
                  {mortgaged && noc.purpose === "CONSTRUCTION" ? (
                    <label className="flex items-start gap-2 text-sm text-slate-700">
                      <input type="checkbox" name="acknowledgeMortgage" className="mt-1" />
                      Acknowledge active mortgage before issuing construction NOC
                    </label>
                  ) : null}
                  <Button type="submit">Issue NOC certificate</Button>
                </form>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-600">Awaiting society review and issuance.</p>
          )}
        </section>

        <DocumentScansPanel
          heading="NOC Document Scans"
          description="Supporting application documents and the issued NOC letter scan."
          scans={[
            {
              plotId: noc.plotId,
              ownershipId: noc.ownershipId ?? undefined,
              documentType: "OTHER",
              title: "Supporting Documents",
              description: "Application forms, plans, utility connection papers, etc.",
            },
            {
              plotId: noc.plotId,
              ownershipId: noc.ownershipId ?? undefined,
              documentType: "NOC",
              title: "Issued NOC Letter",
              description: "Scanned copy of the issued certificate",
            },
          ]}
        />
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-slate-900 sm:text-right">{value}</dd>
    </div>
  );
}
