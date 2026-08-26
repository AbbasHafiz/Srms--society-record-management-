import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import {
  canManageMaintenance,
  canViewMaintenance,
  getMaintenanceSummary,
  MAINTENANCE_PAYMENT_STATUSES,
  MAINTENANCE_STATUSES,
  MAINTENANCE_TYPE_SUGGESTIONS,
} from "@/lib/maintenance";
import { PageHeader, StatCard, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import type { MaintenanceWorkStatus, PaymentStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

export default async function MaintenancePage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    workType?: string;
    status?: string;
    paymentStatus?: string;
  }>;
}) {
  const sp = await searchParams;
  const session = await auth();
  if (!session?.user || !canViewMaintenance(session.user.role)) {
    return (
      <div>
        <PageHeader title="Maintenance" description="You do not have access to maintenance records." />
      </div>
    );
  }

  const status = MAINTENANCE_STATUSES.includes(sp.status as MaintenanceWorkStatus)
    ? (sp.status as MaintenanceWorkStatus)
    : undefined;
  const paymentStatus = MAINTENANCE_PAYMENT_STATUSES.includes(sp.paymentStatus as PaymentStatus)
    ? (sp.paymentStatus as PaymentStatus)
    : undefined;

  const filters = {
    from: sp.from ? new Date(sp.from) : undefined,
    to: sp.to ? new Date(sp.to) : undefined,
    workType: sp.workType?.trim() || undefined,
    status,
    paymentStatus,
  };

  const summary = await getMaintenanceSummary(filters);
  const canManage = canManageMaintenance(session.user.role);

  const distinctTypes = await prisma.maintenanceWork.findMany({
    select: { workType: true },
    distinct: ["workType"],
    orderBy: { workType: "asc" },
    take: 50,
  });

  return (
    <div>
      <PageHeader
        title="Maintenance"
        description="Society-wide repairs and upkeep — any maintenance type is supported (electrical, plumbing, civil, custom, etc.)."
        actions={
          canManage ? (
            <Link href="/maintenance/new">
              <Button>New job</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Total cost (filtered)" value={formatCurrency(summary.totalCost)} />
        <StatCard label="Jobs (filtered)" value={summary.workCount} />
        <StatCard label="Types tracked" value={summary.byType.length} />
      </div>

      {summary.byType.length > 0 ? (
        <section className="mb-6 rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="font-display text-lg font-semibold">Totals by type</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {summary.byType.map((row) => (
              <Link
                key={row.workType}
                href={`/maintenance?workType=${encodeURIComponent(row.workType)}`}
                className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm hover:bg-slate-100"
              >
                <span className="font-medium">{labelize(row.workType)}</span>
                <span className="ml-2 text-slate-600">
                  {formatCurrency(row.cost)} · {row.count} job{row.count === 1 ? "" : "s"}
                </span>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <form className="mb-4 flex flex-wrap gap-2">
        <input
          type="date"
          name="from"
          defaultValue={sp.from ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <input
          type="date"
          name="to"
          defaultValue={sp.to ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <select
          name="workType"
          defaultValue={filters.workType ?? ""}
          className="h-10 min-w-[180px] rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All types</option>
          {MAINTENANCE_TYPE_SUGGESTIONS.map((t) => (
            <option key={t} value={t}>
              {labelize(t)}
            </option>
          ))}
          {distinctTypes
            .map((d) => d.workType)
            .filter((t) => !MAINTENANCE_TYPE_SUGGESTIONS.includes(t as (typeof MAINTENANCE_TYPE_SUGGESTIONS)[number]))
            .map((t) => (
              <option key={t} value={t}>
                {labelize(t)}
              </option>
            ))}
        </select>
        <select
          name="status"
          defaultValue={status ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All statuses</option>
          {MAINTENANCE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {labelize(s)}
            </option>
          ))}
        </select>
        <select
          name="paymentStatus"
          defaultValue={paymentStatus ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All payment statuses</option>
          {MAINTENANCE_PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>
              {labelize(s)}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline">
          Filter
        </Button>
      </form>

      {summary.works.length === 0 ? (
        <EmptyState title="No maintenance jobs" description="Add a job or adjust filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Type</th>
                <th>Description</th>
                <th>Location</th>
                <th>Cost</th>
                <th>Status</th>
                <th>Payment</th>
              </tr>
            </thead>
            <tbody>
              {summary.works.map((work) => (
                <tr key={work.id}>
                  <td>{formatDate(work.workDate)}</td>
                  <td>
                    <Link href={`/maintenance/${work.id}`} className="font-medium text-teal-900 hover:underline">
                      {labelize(work.workType)}
                    </Link>
                  </td>
                  <td className="max-w-xs truncate">{work.description}</td>
                  <td>{work.location ?? "—"}</td>
                  <td>{formatCurrency(work.cost)}</td>
                  <td>
                    <Badge status={work.status} />
                  </td>
                  <td>
                    <Badge status={work.paymentStatus} />
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
