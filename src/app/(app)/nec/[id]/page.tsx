import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SlaBadge } from "@/components/sla-badge";
import { issueNec, updateNecReview } from "../actions";
import { canApproveNec } from "@/lib/nec";
import { plotSizeDisplay } from "@/lib/property-sizes";
import { plotTypeLabel, plotLabel } from "@/lib/plots";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getSlaDays, SLA_SETTING_KEYS, resolveSlaDueAt } from "@/lib/sla";
import { DocumentScansPanel } from "@/components/documents/document-scans-panel";

export const dynamic = "force-dynamic";

export default async function NecDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  const canReview = session?.user && canApproveNec(session.user.role);

  const [nec, necSlaDays] = await Promise.all([
    prisma.nec.findUnique({
      where: { id },
      include: {
        plot: true,
        ownership: true,
        approvedBy: { select: { name: true } },
      },
    }),
    getSlaDays(SLA_SETTING_KEYS.nec, 7),
  ]);

  if (!nec) notFound();

  const canIssue = canReview && ["SUBMITTED", "UNDER_REVIEW", "APPROVED"].includes(nec.status);

  return (
    <div>
      <div className="mb-4">
        <Link href="/nec" className="text-sm text-teal-800 hover:underline">
          ← NEC register
        </Link>
      </div>

      <PageHeader
        title={nec.applicationNumber}
        description="No Encumbrance Certificate application"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={nec.status} />
            <SlaBadge
              dueAt={resolveSlaDueAt(nec.slaDueAt, nec.applicationDate, necSlaDays)}
              completedAt={nec.status === "ISSUED" ? nec.issueDate : null}
            />
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display mb-4 text-lg font-semibold">Application</h2>
          <dl className="space-y-3 text-sm">
            <Row label="Applicant" value={nec.applicantName} />
            <Row label="Applied on" value={formatDate(nec.applicationDate)} />
            <Row label="Fee" value={nec.fee ? formatCurrency(nec.fee) : "—"} />
            <Row label="Payment" value={<Badge status={nec.paymentStatus} />} />
            {nec.remarks ? <Row label="Remarks" value={nec.remarks} /> : null}
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display mb-4 text-lg font-semibold">Plot</h2>
          <dl className="space-y-3 text-sm">
            <Row
              label="Plot"
              value={
                <Link href={`/plots/${nec.plotId}?tab=nec`} className="text-teal-900 hover:underline">
                  {plotLabel(nec.plot)}
                </Link>
              }
            />
            <Row label="Property type" value={plotTypeLabel(nec.plot.plotType)} />
            <Row label="Plot size" value={<span className="font-semibold text-teal-900">{plotSizeDisplay(nec.plot)}</span>} />
            <Row label="Membership" value={nec.ownership?.membershipNumber ?? "—"} />
          </dl>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="font-display mb-4 text-lg font-semibold">Issuance</h2>
          {nec.status === "ISSUED" ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <Row label="NEC number" value={nec.necNumber ?? "—"} />
              <Row label="Issue date" value={formatDate(nec.issueDate)} />
              <Row label="Expiry" value={formatDate(nec.expiryDate)} />
              <Row label="Approved by" value={nec.approvedBy?.name ?? "—"} />
            </dl>
          ) : canReview ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <form action={updateNecReview} className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
                <h3 className="font-medium text-slate-900">Review</h3>
                <input type="hidden" name="necId" value={nec.id} />
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
                  <select
                    name="status"
                    defaultValue={nec.status === "SUBMITTED" ? "UNDER_REVIEW" : nec.status}
                    className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                  >
                    <option value="UNDER_REVIEW">Under review</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Remarks</label>
                  <textarea name="remarks" rows={2} defaultValue={nec.remarks ?? ""} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                </div>
                <Button type="submit" variant="outline">Update review</Button>
              </form>

              {canIssue ? (
                <form action={issueNec} className="space-y-3 rounded-lg border border-teal-100 bg-teal-50/40 p-4">
                  <h3 className="font-medium text-teal-950">Issue NEC</h3>
                  <input type="hidden" name="necId" value={nec.id} />
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Issue date</label>
                    <Input name="issueDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Expiry date (optional)</label>
                    <Input name="expiryDate" type="date" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                      NEC document (optional PDF/image)
                    </label>
                    <Input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Remarks</label>
                    <textarea name="remarks" rows={2} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                  </div>
                  <Button type="submit">Issue NEC certificate</Button>
                </form>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-600">Awaiting society review and issuance.</p>
          )}
        </section>
      </div>

      <div className="mt-6">
        <DocumentScansPanel
          heading="NEC Document Scans"
          description="Supporting application documents and the issued NEC letter scan."
          scans={[
            {
              plotId: nec.plotId,
              ownershipId: nec.ownershipId ?? undefined,
              documentType: "OTHER",
              title: "Supporting Documents",
            },
            {
              plotId: nec.plotId,
              ownershipId: nec.ownershipId ?? undefined,
              documentType: "NEC",
              title: "Issued NEC Letter",
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
