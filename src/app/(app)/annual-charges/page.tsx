import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveAnnualFeeConfig } from "@/lib/charges";
import { hasPermission } from "@/lib/rbac";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatDate, labelize } from "@/lib/utils";
import { plotLabel } from "@/lib/plots";
import { WhatsAppNotifyAction } from "@/components/whatsapp/whatsapp-notify-action";
import { generateChargesAction, markChargePaidAction } from "./actions";
import type { ChargePeriodStatus } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const STATUSES: ChargePeriodStatus[] = ["PENDING", "BILLED", "PAID", "OVERDUE", "WAIVED"];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export default async function AnnualChargesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; year?: string; month?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status?.trim() as ChargePeriodStatus | undefined;
  const year = sp.year ? Number(sp.year) : undefined;
  const month = sp.month ? Number(sp.month) : undefined;
  const q = sp.q?.trim();

  const session = await auth();
  const canManage = session?.user && hasPermission(session.user.role, "verify_payment");

  const now = new Date();
  const defaultYear = now.getFullYear();
  const defaultMonth = now.getMonth() + 1;

  const [activeFee, charges, summary] = await Promise.all([
    getActiveAnnualFeeConfig(),
    prisma.plotCharge.findMany({
      where: {
        ...(status && STATUSES.includes(status) ? { status } : {}),
        ...(year ? { year } : {}),
        ...(month ? { month } : {}),
        ...(q
          ? {
              OR: [
                { plot: { plotNumber: { contains: q, mode: "insensitive" } } },
                { plot: { sector: { contains: q, mode: "insensitive" } } },
                { ownership: { membershipNumber: { contains: q, mode: "insensitive" } } },
                { ownership: { ownerName: { contains: q, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      include: {
        plot: true,
        ownership: { select: { ownerName: true, membershipNumber: true, contact: true } },
        feeConfig: { select: { name: true } },
      },
      orderBy: [{ year: "desc" }, { month: "desc" }, { plot: { sector: "asc" } }],
      take: 150,
    }),
    prisma.plotCharge.groupBy({
      by: ["status"],
      _count: true,
      _sum: { amount: true },
    }),
  ]);

  const outstanding = summary
    .filter((s) => ["PENDING", "BILLED", "OVERDUE"].includes(s.status))
    .reduce((sum, s) => sum + Number(s._sum.amount ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Plot Annual Charges"
        description="Monthly plot charges billed from fee configuration snapshots. Historical rates are never overwritten."
        actions={
          canManage ? (
            <form action={generateChargesAction} className="flex flex-wrap items-end gap-2">
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">Year</span>
                <Input
                  name="year"
                  type="number"
                  defaultValue={defaultYear}
                  className="h-9 w-24"
                />
              </label>
              <label className="text-sm">
                <span className="mb-1 block text-xs font-medium text-slate-600">Month</span>
                <select
                  name="month"
                  defaultValue={defaultMonth}
                  className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </label>
              <Button type="submit" size="sm">Generate bills</Button>
            </form>
          ) : null
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard
          label="Active Rate (snapshot source)"
          value={activeFee ? formatCurrency(activeFee.amount) : "Not configured"}
          hint={activeFee?.name}
        />
        <StatCard
          label="Outstanding Total"
          value={formatCurrency(outstanding)}
          tone="warn"
        />
        <StatCard label="Charge Records" value={charges.length} />
      </div>

      <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="flex-1">
          <Input name="q" placeholder="Search plot, sector, membership…" defaultValue={q} />
        </div>
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
        <Input name="year" type="number" placeholder="Year" defaultValue={year} className="h-10 w-28" />
        <select
          name="month"
          defaultValue={month ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All months</option>
          {MONTHS.map((m, i) => (
            <option key={m} value={i + 1}>{m}</option>
          ))}
        </select>
        <Button type="submit">Filter</Button>
      </form>

      {charges.length === 0 ? (
        <EmptyState
          title="No plot charges found"
          description="Generate monthly bills or adjust filters."
        />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Plot</th>
                <th>Owner / Membership</th>
                <th>Period</th>
                <th>Rate Snapshot</th>
                <th>Amount</th>
                <th>Due</th>
                <th>Status</th>
                <th>Notify</th>
                {canManage ? <th>Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {charges.map((c) => (
                <tr key={c.id}>
                  <td>
                    <Link href={`/plots/${c.plotId}`} className="font-medium text-teal-900 hover:underline">
                      {c.plot.sector}/{c.plot.block}-{c.plot.plotNumber}
                    </Link>
                  </td>
                  <td>
                    <div>{c.ownership?.ownerName ?? "—"}</div>
                    <div className="text-xs text-slate-500">{c.ownership?.membershipNumber}</div>
                  </td>
                  <td>
                    {c.year}
                    {c.month ? ` / ${MONTHS[c.month - 1]}` : ""}
                  </td>
                  <td>{formatCurrency(c.rateSnapshot)}</td>
                  <td>{formatCurrency(c.amount)}</td>
                  <td>{c.dueDate ? formatDate(c.dueDate) : "—"}</td>
                  <td><Badge status={c.status} /></td>
                  <td>
                    {session?.user && c.ownership?.contact ? (
                      <WhatsAppNotifyAction
                        userRole={session.user.role}
                        relatedModule="annual-charges"
                        relatedRecordId={c.id}
                        plotId={c.plotId}
                        defaultTemplateKey="annual_charge_overdue"
                        templateVars={{
                          plotLabel: plotLabel(c.plot),
                          amount: formatCurrency(c.amount),
                        }}
                        presets={[
                          {
                            key: "owner",
                            label: "Owner",
                            name: c.ownership!.ownerName,
                            phone: c.ownership!.contact!,
                            type: "OWNER",
                          },
                        ]}
                        allowedModes={["preset", "custom"]}
                        label="WhatsApp"
                      />
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </td>
                  {canManage ? (
                    <td>
                      {["PENDING", "BILLED", "OVERDUE"].includes(c.status) ? (
                        <form action={markChargePaidAction}>
                          <input type="hidden" name="chargeId" value={c.id} />
                          <Button type="submit" size="sm" variant="outline">Mark paid</Button>
                        </form>
                      ) : (
                        c.paidAt ? (
                          <span className="text-xs text-slate-500">Paid {formatDate(c.paidAt)}</span>
                        ) : "—"
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
