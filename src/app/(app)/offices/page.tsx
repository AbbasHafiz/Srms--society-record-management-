import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { isSocietyLandOffice } from "@/lib/offices";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, labelize, cn } from "@/lib/utils";
import type { OfficePremisesType, RegisteredOfficeStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const PREMISES_TYPES: OfficePremisesType[] = ["SOCIETY_LAND", "PRIVATE"];
const STATUSES: RegisteredOfficeStatus[] = ["ACTIVE", "SUSPENDED", "EXPIRED"];

export default async function OfficesPage({
  searchParams,
}: {
  searchParams: Promise<{
    premisesType?: string;
    status?: string;
    q?: string;
  }>;
}) {
  const sp = await searchParams;
  const premisesType = sp.premisesType?.trim() as OfficePremisesType | undefined;
  const status = sp.status?.trim() as RegisteredOfficeStatus | undefined;
  const q = sp.q?.trim();

  const session = await auth();
  const canCreate = session?.user && hasPermission(session.user.role, "create");

  const offices = await prisma.registeredOffice.findMany({
    where: {
      ...(premisesType && PREMISES_TYPES.includes(premisesType) ? { premisesType } : {}),
      ...(status && STATUSES.includes(status) ? { status } : {}),
      ...(q
        ? {
            OR: [
              { officeName: { contains: q, mode: "insensitive" } },
              { ownerName: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
              { licenseNumber: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      plot: { select: { id: true, sector: true, block: true, plotNumber: true } },
      _count: { select: { openFiles: true, rentCharges: true } },
    },
    orderBy: [{ status: "asc" }, { officeName: "asc" }],
    take: 200,
  });

  const activeCount = offices.filter((o) => o.status === "ACTIVE").length;
  const societyLandCount = offices.filter((o) => o.premisesType === "SOCIETY_LAND").length;
  const overdueRent = offices.filter((o) => o.rentStatus === "OVERDUE").length;

  return (
    <div>
      <PageHeader
        title="Property Offices"
        description="Registered dealer offices and society-land premises with rent tracking."
        actions={
          canCreate ? (
            <Link href="/offices/new">
              <Button>Register office</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Active offices" value={activeCount} tone="success" />
        <StatCard label="Society land" value={societyLandCount} />
        <StatCard label="Rent overdue" value={overdueRent} tone={overdueRent ? "warn" : "default"} />
      </div>

      <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <input
          name="q"
          placeholder="Search name, owner, phone, license…"
          defaultValue={q}
          className="flex h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <select
          name="premisesType"
          defaultValue={premisesType ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All premises</option>
          <option value="PRIVATE">Private</option>
          <option value="SOCIETY_LAND">Society land</option>
        </select>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>{labelize(s)}</option>
          ))}
        </select>
        <Button type="submit">Filter</Button>
      </form>

      {offices.length === 0 ? (
        <EmptyState title="No registered offices" description="Register dealer offices or society-land premises." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Office</th>
                <th>Owner</th>
                <th>Phone</th>
                <th>Premises</th>
                <th>Rent</th>
                <th>Open files</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {offices.map((office) => {
                const societyLand = isSocietyLandOffice(office.premisesType);
                const inactive = office.status !== "ACTIVE";
                return (
                  <tr key={office.id} className={cn(inactive && "bg-slate-50/80")}>
                    <td className="font-medium">
                      <Link href={`/offices/${office.id}`} className="text-teal-900 hover:underline">
                        {office.officeName}
                      </Link>
                      {office.plot ? (
                        <p className="text-xs text-slate-500">
                          Plot {office.plot.sector}/{office.plot.block}-{office.plot.plotNumber}
                        </p>
                      ) : null}
                    </td>
                    <td>{office.ownerName}</td>
                    <td className="text-sm">{office.phone}</td>
                    <td>
                      <Badge status={office.premisesType} />
                    </td>
                    <td className="text-sm">
                      {societyLand
                        ? office.rentAmount
                          ? `${formatCurrency(office.rentAmount)}/mo`
                          : "—"
                        : "N/A"}
                      {societyLand && office.rentStatus ? (
                        <Badge status={office.rentStatus} className="ml-1" />
                      ) : null}
                    </td>
                    <td className="text-sm text-slate-600">{office._count.openFiles}</td>
                    <td>
                      <Badge status={office.status} />
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
