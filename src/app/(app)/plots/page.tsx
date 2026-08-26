import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function PlotsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sector?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim();

  const plots = await prisma.plot.findMany({
    where: q
      ? {
          OR: [
            { plotNumber: { contains: q, mode: "insensitive" } },
            { sector: { contains: q, mode: "insensitive" } },
            { street: { contains: q, mode: "insensitive" } },
            { block: { contains: q, mode: "insensitive" } },
            {
              ownerships: {
                some: {
                  OR: [
                    { ownerName: { contains: q, mode: "insensitive" } },
                    { membershipNumber: { contains: q, mode: "insensitive" } },
                    { cnic: { contains: q } },
                  ],
                },
              },
            },
          ],
        }
      : undefined,
    include: {
      ownerships: { where: { status: "ACTIVE" }, take: 1 },
      mortgages: { where: { status: "ACTIVE" }, take: 1 },
      openFiles: { where: { status: "ACTIVE" }, take: 1 },
    },
    orderBy: [{ sector: "asc" }, { plotNumber: "asc" }],
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Plot Register"
        description="Permanent plot master records. Ownership history is never overwritten."
      />

      <form className="mb-4 flex flex-col gap-2 sm:flex-row">
        <Input name="q" placeholder="Search plot, owner, CNIC, membership…" defaultValue={q} />
        <Button type="submit">Search</Button>
      </form>

      {plots.length === 0 ? (
        <EmptyState title="No plots found" description="Try another search term." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plot</th>
                <th>Location</th>
                <th>Size</th>
                <th>Current Owner</th>
                <th>Membership</th>
                <th>Flags</th>
              </tr>
            </thead>
            <tbody>
              {plots.map((p) => {
                const owner = p.ownerships[0];
                return (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/plots/${p.id}`} className="font-semibold text-teal-900 hover:underline">
                        {p.sector}/{p.block}-{p.plotNumber}
                      </Link>
                    </td>
                    <td>
                      {p.street || "—"}
                      <div className="text-xs text-slate-500">{p.plotType}</div>
                    </td>
                    <td>{Number(p.sizeMarla)} marla</td>
                    <td>{owner?.ownerName ?? "—"}</td>
                    <td>{owner?.membershipNumber ?? "—"}</td>
                    <td className="space-x-1 space-y-1">
                      {p.hasActiveMortgage || p.mortgages.length > 0 ? (
                        <Badge status="ACTIVE_MORTGAGE">Mortgage</Badge>
                      ) : null}
                      {p.hasOpenFile || p.openFiles.length > 0 ? (
                        <Badge status="PENDING">Open File</Badge>
                      ) : null}
                      <Badge status={p.ownershipStatus} />
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
