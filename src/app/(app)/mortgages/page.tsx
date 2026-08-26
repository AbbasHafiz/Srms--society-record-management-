import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState, WarningBanner } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function MortgagesPage() {
  const mortgages = await prisma.mortgage.findMany({
    include: { plot: true },
    orderBy: [{ status: "asc" }, { mortgageDate: "desc" }],
    take: 100,
  });

  const activeCount = mortgages.filter((m) => m.status === "ACTIVE").length;

  return (
    <div>
      <PageHeader
        title="Bank / Mortgage Register"
        description="Active mortgages restrict plot transfers until bank NOC is obtained."
      />

      {activeCount > 0 ? (
        <div className="mb-4">
          <WarningBanner>
            <strong>{activeCount} active mortgage{activeCount === 1 ? "" : "s"}</strong> on record.
            Transfers cannot be completed while an active bank restriction exists.
          </WarningBanner>
        </div>
      ) : null}

      {mortgages.length === 0 ? (
        <EmptyState title="No mortgage records" description="Bank encumbrances will appear here." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Bank</th>
                <th>Plot</th>
                <th>Loan Reference</th>
                <th>Mortgage Date</th>
                <th>Release Date</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {mortgages.map((m) => (
                <tr
                  key={m.id}
                  className={cn(m.status === "ACTIVE" && "bg-rose-50/60")}
                >
                  <td className="font-medium">{m.bankName}</td>
                  <td>
                    <Link href={`/plots/${m.plotId}`} className="text-teal-900 hover:underline">
                      {m.plot.sector}/{m.plot.block}-{m.plot.plotNumber}
                    </Link>
                  </td>
                  <td>{m.loanReference ?? "—"}</td>
                  <td>{formatDate(m.mortgageDate)}</td>
                  <td>{formatDate(m.releaseDate)}</td>
                  <td>
                    <Badge status={m.status === "ACTIVE" ? "ACTIVE_MORTGAGE" : m.status} />
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
