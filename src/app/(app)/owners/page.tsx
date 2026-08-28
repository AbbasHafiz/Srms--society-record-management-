import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { OwnershipStatus } from "@/generated/prisma/client";
import { excelExportHref } from "@/lib/excel";
import { ExcelExportLink } from "@/components/excel/excel-export-link";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: OwnershipStatus[] = ["ACTIVE", "TRANSFERRED", "CANCELLED", "SUSPENDED"];

export default async function OwnersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim();
  const status = sp.status?.trim() as OwnershipStatus | undefined;

  const ownerships = await prisma.ownership.findMany({
    where: {
      ...(status && STATUS_OPTIONS.includes(status) ? { status } : {}),
      ...(q
        ? {
            OR: [
              { ownerName: { contains: q, mode: "insensitive" } },
              { membershipNumber: { contains: q, mode: "insensitive" } },
              { allotmentNumber: { contains: q, mode: "insensitive" } },
              { cnic: { contains: q } },
            ],
          }
        : {}),
    },
    include: { plot: true },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Ownership Register"
        description="Complete ownership history. Records are never overwritten — status changes preserve history."
        actions={<ExcelExportLink href={excelExportHref("owners", { q, status })} />}
      />

      <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input name="q" placeholder="Search owner, CNIC, membership…" defaultValue={q} />
        </div>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {s.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        <Button type="submit">Filter</Button>
      </form>

      {ownerships.length === 0 ? (
        <EmptyState title="No ownership records found" description="Try adjusting your filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Owner</th>
                <th>CNIC</th>
                <th>Membership</th>
                <th>Plot</th>
                <th>Period</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ownerships.map((o) => (
                <tr key={o.id}>
                  <td className="font-medium">{o.ownerName}</td>
                  <td>{o.cnic}</td>
                  <td>{o.membershipNumber}</td>
                  <td>
                    <Link href={`/plots/${o.plotId}`} className="font-semibold text-teal-900 hover:underline">
                      {o.plot.sector}/{o.plot.block}-{o.plot.plotNumber}
                    </Link>
                  </td>
                  <td>
                    {formatDate(o.startDate)}
                    {o.endDate ? ` → ${formatDate(o.endDate)}` : " → present"}
                  </td>
                  <td>
                    <Badge status={o.status} />
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
