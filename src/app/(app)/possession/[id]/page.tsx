import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { DocumentScansPanel } from "@/components/documents/document-scans-panel";
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
  const possessionSlaDays = await getSlaDays(SLA_SETTING_KEYS.possession, 21);

  const possession = await prisma.possession.findUnique({
    where: { id },
    include: { plot: true, ownership: true },
  });

  if (!possession) notFound();

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
        actions={<Badge status={possession.approvalStatus} />}
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
        <Info label="SLA">
          <SlaBadge
            dueAt={resolveSlaDueAt(possession.slaDueAt, possession.applicationDate, possessionSlaDays)}
            completedAt={possession.approvalStatus === "ISSUED" ? possession.issueDate : null}
          />
        </Info>
      </div>

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
