import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, daysUntil, cn } from "@/lib/utils";
import type { OpenFileStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: OpenFileStatus[] = ["ACTIVE", "EXPIRED", "CLOSED", "CANCELLED"];

export default async function OpenFilesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status?.trim() as OpenFileStatus | undefined;

  const openFiles = await prisma.openFile.findMany({
    where: status && STATUSES.includes(status) ? { status } : undefined,
    include: { plot: true },
    orderBy: { expiryDate: "asc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Open Files"
        description="Dealer open-file registrations with expiry tracking."
      />

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

      {openFiles.length === 0 ? (
        <EmptyState title="No open files" description="Try adjusting your filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Open File</th>
                <th>Plot</th>
                <th>Seller</th>
                <th>Dealer</th>
                <th>Opened</th>
                <th>Expiry</th>
                <th>Days Left</th>
                <th>Fee</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {openFiles.map((f) => {
                const days = daysUntil(f.expiryDate);
                const expiringSoon = f.status === "ACTIVE" && days <= 30;
                return (
                  <tr key={f.id} className={cn(expiringSoon && "bg-amber-50/60")}>
                    <td>
                      <Link
                        href={`/open-files/${f.id}`}
                        className="font-semibold text-teal-900 hover:underline"
                      >
                        {f.openFileNumber}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/plots/${f.plotId}`} className="text-teal-900 hover:underline">
                        {f.plot.sector}/{f.plot.block}-{f.plot.plotNumber}
                      </Link>
                    </td>
                    <td>{f.sellerName}</td>
                    <td>{f.dealerName}</td>
                    <td>{formatDate(f.openingDate)}</td>
                    <td>{formatDate(f.expiryDate)}</td>
                    <td>
                      {f.status === "ACTIVE" ? (
                        <span className={cn("font-medium", days <= 0 ? "text-rose-700" : days <= 30 ? "text-amber-700" : "")}>
                          {days <= 0 ? "Expired" : `${days}d`}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>{formatCurrency(f.feeAmount)}</td>
                    <td>
                      <Badge status={f.status} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
