import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { NOC_PURPOSE_LABELS } from "@/lib/property-sizes";
import { canCreateNocApplication } from "@/lib/noc";
import type { ApplicationStatus, NocPurpose } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: ApplicationStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "ISSUED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
];

const PURPOSES: NocPurpose[] = ["CONSTRUCTION", "TRANSFER", "GENERAL", "OTHER"];

export default async function NocPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; purpose?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;
  const status = sp.status?.trim() as ApplicationStatus | undefined;
  const purpose = sp.purpose?.trim() as NocPurpose | undefined;

  const nocs = await prisma.noc.findMany({
    where: {
      ...(status && STATUSES.includes(status) ? { status } : {}),
      ...(purpose && PURPOSES.includes(purpose) ? { purpose } : {}),
    },
    include: { plot: true },
    orderBy: { applicationDate: "desc" },
    take: 100,
  });

  const canApply = session?.user && canCreateNocApplication(session.user.role);

  return (
    <div>
      <PageHeader
        title="NOC Register"
        description="No Objection Certificate applications — including construction NOC for owners building a house."
        actions={
          canApply ? (
            <Link href="/noc/new?purpose=CONSTRUCTION">
              <Button>Apply for construction NOC</Button>
            </Link>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-wrap gap-2">
        <select
          name="purpose"
          defaultValue={purpose ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All purposes</option>
          {PURPOSES.map((p) => (
            <option key={p} value={p}>
              {NOC_PURPOSE_LABELS[p] ?? labelize(p)}
            </option>
          ))}
        </select>
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

      {nocs.length === 0 ? (
        <EmptyState title="No NOC records" description="Try adjusting your filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Application</th>
                <th>Purpose</th>
                <th>Applicant</th>
                <th>Plot</th>
                <th>NOC Number</th>
                <th>Fee</th>
                <th>Payment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {nocs.map((n) => (
                <tr key={n.id} className={n.purpose === "CONSTRUCTION" ? "bg-teal-50/40" : undefined}>
                  <td>
                    <Link href={`/noc/${n.id}`} className="font-medium text-teal-900 hover:underline">
                      {n.applicationNumber}
                    </Link>
                    <div className="text-xs text-slate-500">{formatDate(n.applicationDate)}</div>
                  </td>
                  <td>
                    <span
                      className={
                        n.purpose === "CONSTRUCTION"
                          ? "font-medium text-teal-900"
                          : "text-slate-700"
                      }
                    >
                      {NOC_PURPOSE_LABELS[n.purpose] ?? labelize(n.purpose)}
                    </span>
                  </td>
                  <td>{n.applicantName}</td>
                  <td>
                    <Link href={`/plots/${n.plotId}?tab=noc`} className="text-teal-900 hover:underline">
                      {n.plot.sector}/{n.plot.block}-{n.plot.plotNumber}
                    </Link>
                  </td>
                  <td>
                    {n.nocNumber ? (
                      <span>
                        {n.nocNumber}
                        <div className="text-xs text-slate-500">
                          {formatDate(n.issueDate)}
                          {n.expiryDate ? ` · exp ${formatDate(n.expiryDate)}` : ""}
                        </div>
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{n.fee ? formatCurrency(n.fee) : "—"}</td>
                  <td>
                    <Badge status={n.paymentStatus} />
                  </td>
                  <td>
                    <Badge status={n.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
