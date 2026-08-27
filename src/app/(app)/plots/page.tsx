import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PlotStatusBadges } from "@/components/plots/plot-status-badges";
import { ALL_PLOT_TYPES, ALL_POSSESSION_STATUSES, plotTypeLabel } from "@/lib/plots";
import { hasPermission } from "@/lib/rbac";
import type { PlotType, PossessionStatus } from "@/generated/prisma/client";
import { LIVE_OPEN_FILE_STATUSES } from "@/lib/open-files";

export const dynamic = "force-dynamic";

export default async function PlotsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; possession?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q?.trim();
  const typeFilter = sp.type?.trim();
  const possessionFilter = sp.possession?.trim();

  const session = await auth();
  const canCreate = session?.user && hasPermission(session.user.role, "create");

  const where: {
    OR?: Array<Record<string, unknown>>;
    plotType?: PlotType;
    possessionStatus?: PossessionStatus;
  } = {};

  if (q) {
    where.OR = [
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
    ];
  }

  if (typeFilter && ALL_PLOT_TYPES.includes(typeFilter as PlotType)) {
    where.plotType = typeFilter as PlotType;
  }

  if (possessionFilter && ALL_POSSESSION_STATUSES.includes(possessionFilter as PossessionStatus)) {
    where.possessionStatus = possessionFilter as PossessionStatus;
  }

  const plots = await prisma.plot.findMany({
    where: Object.keys(where).length > 0 ? where : undefined,
    include: {
      ownerships: { where: { status: "ACTIVE" }, take: 1 },
      mortgages: { where: { status: "ACTIVE" }, take: 1 },
      openFiles: { where: { status: { in: LIVE_OPEN_FILE_STATUSES } }, take: 1 },
    },
    orderBy: [{ sector: "asc" }, { plotNumber: "asc" }],
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Plot Register"
        description="Permanent plot master records. Ownership history is never overwritten."
        actions={
          canCreate ? (
            <Link href="/plots/new">
              <Button>Register property</Button>
            </Link>
          ) : undefined
        }
      />

      <form className="mb-4 flex flex-col gap-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Input name="q" placeholder="Search plot, owner, CNIC, membership…" defaultValue={q} />
          <select
            name="type"
            defaultValue={typeFilter || ""}
            className="flex h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">All property types</option>
            {ALL_PLOT_TYPES.map((t) => (
              <option key={t} value={t}>
                {plotTypeLabel(t)}
              </option>
            ))}
          </select>
          <select
            name="possession"
            defaultValue={possessionFilter || ""}
            className="flex h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
          >
            <option value="">All possession</option>
            {ALL_POSSESSION_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s === "NOT_APPLIED" ? "No possession / Not applied" : s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <Button type="submit">Filter</Button>
        </div>
      </form>

      {plots.length === 0 ? (
        <EmptyState title="No plots found" description="Try another search term or filter." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plot</th>
                <th>Property</th>
                <th>Size</th>
                <th>Current Owner</th>
                <th>Membership</th>
                <th>Status</th>
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
                      {p.street ? <div className="text-xs text-slate-500">{p.street}</div> : null}
                    </td>
                    <td>
                      <PlotStatusBadges plot={p} />
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
