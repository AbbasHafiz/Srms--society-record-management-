import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/utils";
import type { OwnershipStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const STATUS_OPTIONS: OwnershipStatus[] = ["ACTIVE", "TRANSFERRED", "CANCELLED", "SUSPENDED"];

export default async function MembershipsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; deceased?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim();
  const status = sp.status?.trim() as OwnershipStatus | undefined;
  const deceasedOnly = sp.deceased === "1";

  const [memberships, activeCount, transferredCount, deceasedCount] = await Promise.all([
    prisma.ownership.findMany({
      where: {
        ...(status && STATUS_OPTIONS.includes(status) ? { status } : {}),
        ...(deceasedOnly
          ? {
              status: "TRANSFERRED",
              transferOut: { transferType: "DEATH_SUCCESSION" },
            }
          : {}),
        ...(q
          ? {
              OR: [
                { ownerName: { contains: q, mode: "insensitive" } },
                { membershipNumber: { contains: q, mode: "insensitive" } },
                { allotmentNumber: { contains: q, mode: "insensitive" } },
                { cnic: { contains: q } },
                { plot: { plotNumber: { contains: q, mode: "insensitive" } } },
                { plot: { sector: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        plot: true,
        transferOut: { select: { id: true, transferType: true, transferNumber: true } },
        transferIn: { select: { id: true, transferNumber: true } },
      },
      orderBy: [{ status: "asc" }, { membershipNumber: "asc" }],
      take: 150,
    }),
    prisma.ownership.count({ where: { status: "ACTIVE" } }),
    prisma.ownership.count({ where: { status: "TRANSFERRED" } }),
    prisma.ownership.count({
      where: {
        status: "TRANSFERRED",
        transferOut: { transferType: "DEATH_SUCCESSION" },
      },
    }),
  ]);

  return (
    <div>
      <PageHeader
        title="Membership Register"
        description="Society membership numbers linked to plot ownership. Historical memberships are preserved — never overwritten."
        actions={
          <Link href="/owners" className="text-sm text-teal-800 hover:underline">
            Full ownership register
          </Link>
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Active Memberships" value={activeCount} tone="success" />
        <StatCard label="Transferred (historical)" value={transferredCount} />
        <StatCard label="Deceased (succession)" value={deceasedCount} tone="warn" />
      </div>

      <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input
            name="q"
            placeholder="Search membership, owner, CNIC, plot…"
            defaultValue={q}
          />
        </div>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ")}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" name="deceased" value="1" defaultChecked={deceasedOnly} />
          Deceased only
        </label>
        <Button type="submit">Filter</Button>
      </form>

      {memberships.length === 0 ? (
        <EmptyState title="No memberships found" description="Try adjusting your filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Membership</th>
                <th>Allotment</th>
                <th>Owner</th>
                <th>CNIC</th>
                <th>Plot</th>
                <th>Period</th>
                <th>Status</th>
                <th>Transfer</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => {
                const isDeceased =
                  m.status === "TRANSFERRED" && m.transferOut?.transferType === "DEATH_SUCCESSION";
                return (
                  <tr key={m.id}>
                    <td className="font-semibold text-teal-900">{m.membershipNumber}</td>
                    <td>{m.allotmentNumber}</td>
                    <td className="font-medium">{m.ownerName}</td>
                    <td>{m.cnic}</td>
                    <td>
                      <Link href={`/plots/${m.plotId}`} className="text-teal-900 hover:underline">
                        {m.plot.sector}/{m.plot.block}-{m.plot.plotNumber}
                      </Link>
                    </td>
                    <td>
                      {formatDate(m.startDate)}
                      {m.endDate ? ` → ${formatDate(m.endDate)}` : " → present"}
                    </td>
                    <td>
                      {isDeceased ? (
                        <Badge className="bg-slate-100 text-slate-700 border-slate-300">DECEASED</Badge>
                      ) : (
                        <Badge status={m.status} />
                      )}
                    </td>
                    <td>
                      {m.transferOut ? (
                        <Link
                          href={`/transfers/${m.transferOut.id}`}
                          className="text-sm text-teal-800 hover:underline"
                        >
                          {m.transferOut.transferNumber}
                        </Link>
                      ) : m.transferIn ? (
                        <Link
                          href={`/transfers/${m.transferIn.id}`}
                          className="text-sm text-teal-800 hover:underline"
                        >
                          In: {m.transferIn.transferNumber}
                        </Link>
                      ) : (
                        "—"
                      )}
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
