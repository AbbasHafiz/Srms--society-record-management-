import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { ApplicationStatus } from "@/generated/prisma/client";

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

export default async function NecPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status?.trim() as ApplicationStatus | undefined;

  const necs = await prisma.nec.findMany({
    where: status && STATUSES.includes(status) ? { status } : undefined,
    include: { plot: true },
    orderBy: { applicationDate: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader title="NEC Register" description="No Encumbrance Certificate applications and issuances." />

      <form className="mb-4 flex gap-2">
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <Button type="submit">Filter</Button>
      </form>

      {necs.length === 0 ? (
        <EmptyState title="No NEC records" description="Try adjusting your filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Application</th>
                <th>Applicant</th>
                <th>Plot</th>
                <th>NEC Number</th>
                <th>Fee</th>
                <th>Payment</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {necs.map((n) => (
                <tr key={n.id}>
                  <td>
                    <div className="font-medium">{n.applicationNumber}</div>
                    <div className="text-xs text-slate-500">{formatDate(n.applicationDate)}</div>
                  </td>
                  <td>{n.applicantName}</td>
                  <td>
                    <Link href={`/plots/${n.plotId}`} className="text-teal-900 hover:underline">
                      {n.plot.sector}/{n.plot.block}-{n.plot.plotNumber}
                    </Link>
                  </td>
                  <td>
                    {n.necNumber ? (
                      <span>
                        {n.necNumber}
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
