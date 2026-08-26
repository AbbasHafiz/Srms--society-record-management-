import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SlaBadge } from "@/components/sla-badge";
import { canCreatePossessionApplication } from "@/lib/possession";
import { formatCurrency, formatDate } from "@/lib/utils";
import { getSlaDays, SLA_SETTING_KEYS, resolveSlaDueAt } from "@/lib/sla";

export const dynamic = "force-dynamic";

export default async function PossessionPage() {
  const session = await auth();
  const canApply = session?.user && canCreatePossessionApplication(session.user.role);
  const [possessions, possessionSlaDays] = await Promise.all([
    prisma.possession.findMany({
      include: { plot: true },
      orderBy: { applicationDate: "desc" },
      take: 100,
    }),
    getSlaDays(SLA_SETTING_KEYS.possession, 21),
  ]);

  return (
    <div>
      <PageHeader
        title="Possession Register"
        description="Possession applications and issued letters."
        actions={
          canApply ? (
            <Link href="/possession/new">
              <Button>New application</Button>
            </Link>
          ) : undefined
        }
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
                <th>SLA</th>
                <th>Letter</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {possessions.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/possession/${p.id}`} className="font-medium text-teal-900 hover:underline">
                      {p.applicationNumber}
                    </Link>
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
                    <SlaBadge
                      dueAt={resolveSlaDueAt(p.slaDueAt, p.applicationDate, possessionSlaDays)}
                      completedAt={p.approvalStatus === "ISSUED" ? p.issueDate : null}
                    />
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
                  <td>
                    <Link href={`/possession/${p.id}`} className="text-xs text-teal-800 hover:underline">
                      Scans
                    </Link>
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
