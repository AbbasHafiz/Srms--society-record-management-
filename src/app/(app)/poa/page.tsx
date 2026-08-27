import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { canRegisterPoa } from "@/lib/rbac";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, cn } from "@/lib/utils";
import { expireOverduePoas } from "@/lib/poa";
import { poaKindLabel, poaPurposeLabel, poaStatusLabel } from "@/lib/poa-shared";
import type { PowerOfAttorneyStatus, Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const FILTERS: { key: string; label: string; statuses?: PowerOfAttorneyStatus[] }[] = [
  { key: "", label: "All" },
  { key: "active", label: "Active", statuses: ["ACTIVE"] },
  {
    key: "in-progress",
    label: "In verification",
    statuses: ["DRAFT", "SUBMITTED", "TEHSILDAR_VERIFIED", "FOREIGN_OFFICE_VERIFIED", "ACCEPTED_BY_SOCIETY"],
  },
  { key: "closed", label: "Revoked / expired", statuses: ["REVOKED", "EXPIRED"] },
];

export default async function PoaListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  await expireOverduePoas();
  const sp = await searchParams;
  const filterKey = sp.status?.trim() || "";
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const session = await auth();
  const canCreate = session?.user && canRegisterPoa(session.user.role);

  const where: Prisma.PowerOfAttorneyWhereInput | undefined = filter.statuses
    ? { status: { in: filter.statuses } }
    : undefined;

  const [rows, activeCount, inProgressCount, closedCount] = await Promise.all([
    prisma.powerOfAttorney.findMany({
      where,
      include: { plot: true },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.powerOfAttorney.count({ where: { status: "ACTIVE" } }),
    prisma.powerOfAttorney.count({
      where: {
        status: {
          in: ["DRAFT", "SUBMITTED", "TEHSILDAR_VERIFIED", "FOREIGN_OFFICE_VERIFIED", "ACCEPTED_BY_SOCIETY"],
        },
      },
    }),
    prisma.powerOfAttorney.count({ where: { status: { in: ["REVOKED", "EXPIRED"] } } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Power of Attorney"
        description="Plot-scoped PoA linked to the owner/seller. Used when the principal is abroad or unwell, or for a special purpose such as possession / construction or applying for NOC."
        actions={
          canCreate ? (
            <Link href="/poa/new">
              <Button>Register PoA</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Active" value={activeCount} tone="success" />
        <StatCard label="In verification" value={inProgressCount} tone="warn" />
        <StatCard label="Revoked / expired" value={closedCount} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter.key;
          const href = f.key ? `/poa?status=${f.key}` : "/poa";
          return (
            <Link
              key={f.key || "all"}
              href={href}
              className={cn(
                "inline-flex h-9 items-center rounded-md border px-3 text-sm",
                active
                  ? "border-teal-800 bg-teal-800 text-white"
                  : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
              )}
            >
              {f.label}
            </Link>
          );
        })}
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title={filter.key ? "No PoAs in this status" : "No powers of attorney yet"}
          description="Register a PoA when the owner cannot appear at society, or for a limited special purpose."
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>PoA</th>
                  <th>Plot</th>
                  <th>Principal</th>
                  <th>Attorney</th>
                  <th>Kind</th>
                  <th>Purpose</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <Link href={`/poa/${p.id}`} className="font-semibold text-teal-900 hover:underline">
                        {p.poaNumber}
                      </Link>
                    </td>
                    <td>
                      <Link href={`/plots/${p.plotId}?tab=poa`} className="text-teal-900 hover:underline">
                        {p.plot.sector}/{p.plot.block}-{p.plot.plotNumber}
                      </Link>
                    </td>
                    <td>{p.principalName}</td>
                    <td>{p.attorneyName}</td>
                    <td>{poaKindLabel(p.kind)}</td>
                    <td>{poaPurposeLabel(p.purpose)}</td>
                    <td>
                      <Badge status={p.status}>{poaStatusLabel(p.status)}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {rows.map((p) => (
              <li key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/poa/${p.id}`} className="font-semibold text-teal-900 hover:underline">
                    {p.poaNumber}
                  </Link>
                  <Badge status={p.status}>{poaStatusLabel(p.status)}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-700">
                  {p.plot.sector}/{p.plot.block}-{p.plot.plotNumber} · {p.principalName} → {p.attorneyName}
                </p>
                <p className="text-xs text-slate-500">
                  {poaKindLabel(p.kind)} · {poaPurposeLabel(p.purpose)} · {formatDate(p.createdAt)}
                </p>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
