import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DocumentScansPanel } from "@/components/documents/document-scans-panel";
import { issuePossessionLetter, updatePossessionReview } from "../actions";
import { canApprovePossession } from "@/lib/possession";
import { formatCurrency, formatDate } from "@/lib/utils";
import { SlaBadge } from "@/components/sla-badge";
import { getSlaDays, SLA_SETTING_KEYS, resolveSlaDueAt } from "@/lib/sla";

export const dynamic = "force-dynamic";

export default async function PossessionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();
  const canReview = session?.user && canApprovePossession(session.user.role);

  const [possession, possessionSlaDays] = await Promise.all([
    prisma.possession.findUnique({
      where: { id },
      include: { plot: true, ownership: true, approvedBy: { select: { name: true } } },
    }),
    getSlaDays(SLA_SETTING_KEYS.possession, 21),
  ]);

  if (!possession) notFound();

  const canIssue =
    canReview && ["SUBMITTED", "UNDER_REVIEW", "APPROVED"].includes(possession.approvalStatus);

  return (
    <div>
      <div className="mb-4">
        <Link href="/possession" className="text-sm text-teal-800 hover:underline">
          ← Possession register
        </Link>
      </div>

      <PageHeader
        title={possession.applicationNumber}
        description={`Possession application · ${possession.applicantName}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge status={possession.approvalStatus} />
            <SlaBadge
              dueAt={resolveSlaDueAt(possession.slaDueAt, possession.applicationDate, possessionSlaDays)}
              completedAt={possession.approvalStatus === "ISSUED" ? possession.issueDate : null}
            />
          </div>
        }
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Info label="Plot">
          <Link href={`/plots/${possession.plotId}?tab=possession`} className="text-teal-900 hover:underline">
            {possession.plot.sector}/{possession.plot.block}-{possession.plot.plotNumber}
          </Link>
        </Info>
        <Info label="Applied">{formatDate(possession.applicationDate)}</Info>
        <Info label="Fee">{possession.possessionFee ? formatCurrency(possession.possessionFee) : "—"}</Info>
        <Info label="Payment">
          <Badge status={possession.paymentStatus} />
        </Info>
        <Info label="Letter">{possession.letterNumber ?? "—"}</Info>
        <Info label="Issued">{formatDate(possession.issueDate)}</Info>
      </div>

      <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="font-display mb-4 text-lg font-semibold">Review & issuance</h2>
        {possession.approvalStatus === "ISSUED" ? (
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <Row label="Letter number" value={possession.letterNumber ?? "—"} />
            <Row label="Issue date" value={formatDate(possession.issueDate)} />
            <Row label="Approved by" value={possession.approvedBy?.name ?? "—"} />
          </dl>
        ) : canReview ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <form action={updatePossessionReview} className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/50 p-4">
              <h3 className="font-medium text-slate-900">Review</h3>
              <input type="hidden" name="possessionId" value={possession.id} />
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Status</label>
                <select
                  name="approvalStatus"
                  defaultValue={possession.approvalStatus === "SUBMITTED" ? "UNDER_REVIEW" : possession.approvalStatus}
                  className="flex h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm"
                >
                  <option value="UNDER_REVIEW">Under review</option>
                  <option value="APPROVED">Approved</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Remarks</label>
                <textarea name="remarks" rows={2} defaultValue={possession.remarks ?? ""} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
              </div>
              <Button type="submit" variant="outline">Update review</Button>
            </form>

            {canIssue ? (
              <form action={issuePossessionLetter} className="space-y-3 rounded-lg border border-teal-100 bg-teal-50/40 p-4">
                <h3 className="font-medium text-teal-950">Issue possession letter</h3>
                <input type="hidden" name="possessionId" value={possession.id} />
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Issue date</label>
                  <Input name="issueDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">
                    Possession letter scan (optional)
                  </label>
                  <Input name="file" type="file" accept=".pdf,.jpg,.jpeg,.png,.webp" />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500">Remarks</label>
                  <textarea name="remarks" rows={2} className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm" />
                </div>
                <Button type="submit">Issue possession letter</Button>
              </form>
            ) : null}
          </div>
        ) : (
          <p className="text-sm text-slate-600">Awaiting society review and issuance.</p>
        )}
      </section>

      <DocumentScansPanel
        heading="Possession Document Scans"
        description="Application supporting documents and the issued possession letter."
        scans={[
          {
            plotId: possession.plotId,
            ownershipId: possession.ownershipId ?? undefined,
            documentType: "OTHER",
            title: "Application Documents",
            description: "Application form, fee receipt, owner CNIC, etc.",
          },
          {
            plotId: possession.plotId,
            ownershipId: possession.ownershipId ?? undefined,
            documentType: "POSSESSION_LETTER",
            title: "Issued Possession Letter",
          },
        ]}
      />
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4 text-sm shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="mt-1 font-medium text-slate-900">{children}</div>
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
