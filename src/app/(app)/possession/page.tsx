import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PossessionPage() {
  const possessions = await prisma.possession.findMany({
    include: { plot: true },
    orderBy: { applicationDate: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Possession Register"
        description="Possession applications and issued letters."
      />

      {possessions.length === 0 ? (
        <EmptyState title="No possession records" description="Applications will appear here." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Application</th>
                <th>Applicant</th>
                <th>Plot</th>
                <th>Fee</th>
                <th>Payment</th>
                <th>Approval</th>
                <th>Letter</th>
              </tr>
            </thead>
            <tbody>
              {possessions.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div className="font-medium">{p.applicationNumber}</div>
                    <div className="text-xs text-slate-500">{formatDate(p.applicationDate)}</div>
                  </td>
                  <td>{p.applicantName}</td>
                  <td>
                    <Link href={`/plots/${p.plotId}`} className="text-teal-900 hover:underline">
                      {p.plot.sector}/{p.plot.block}-{p.plot.plotNumber}
                    </Link>
                  </td>
                  <td>{p.possessionFee ? formatCurrency(p.possessionFee) : "—"}</td>
                  <td>
                    <Badge status={p.paymentStatus} />
                  </td>
                  <td>
                    <Badge status={p.approvalStatus} />
                  </td>
                  <td>
                    {p.letterNumber ? (
                      <span>
                        {p.letterNumber}
                        <div className="text-xs text-slate-500">{formatDate(p.issueDate)}</div>
                      </span>
                    ) : (
                      "—"
                    )}
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
