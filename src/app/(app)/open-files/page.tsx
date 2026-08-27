import Link from "next/link";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { PageHeader, EmptyState, StatCard } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate, daysUntil, cn } from "@/lib/utils";
import {
  LIVE_OPEN_FILE_STATUSES,
  OPEN_LIST_STATUSES,
  openFileStatusLabel,
} from "@/lib/open-files";
import type { OpenFileStatus, Prisma } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const FILTERS: { key: string; label: string; statuses?: OpenFileStatus[] }[] = [
  { key: "", label: "All" },
  { key: "open", label: "Open", statuses: OPEN_LIST_STATUSES },
  { key: "closed", label: "Closed in purchaser's name", statuses: ["CLOSED"] },
  { key: "cancelled", label: "Cancelled / withdrawn", statuses: ["CANCELLED"] },
];

export default async function OpenFilesPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const sp = await searchParams;
  const filterKey = sp.status?.trim() || "";
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];

  const session = await auth();
  const canCreate = session?.user && hasPermission(session.user.role, "create");

  const where: Prisma.OpenFileWhereInput | undefined = filter.statuses
    ? { status: { in: filter.statuses } }
    : undefined;

  const [openFiles, openCount, closedCount, cancelledCount] = await Promise.all([
    prisma.openFile.findMany({
      where,
      include: { plot: true, registeredOffice: { select: { officeName: true } } },
      orderBy: { openingDate: "desc" },
      take: 100,
    }),
    prisma.openFile.count({ where: { status: { in: LIVE_OPEN_FILE_STATUSES } } }),
    prisma.openFile.count({ where: { status: "CLOSED" } }),
    prisma.openFile.count({ where: { status: "CANCELLED" } }),
  ]);

  return (
    <div>
      <PageHeader
        title="Open Files"
        description="Open transfer — sold to investor/dealer; end purchaser not yet named. Legal membership stays with the seller until a later buyer proves identity, pays the society transfer fee, and the file is closed in the buyer's name."
        actions={
          canCreate ? (
            <Link href="/open-files/new">
              <Button>Open a file</Button>
            </Link>
          ) : undefined
        }
      />

      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <StatCard label="Open (end purchaser empty)" value={openCount} tone="warn" />
        <StatCard label="Closed in purchaser's name" value={closedCount} tone="success" />
        <StatCard label="Cancelled / withdrawn" value={cancelledCount} />
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter.key;
          const href = f.key ? `/open-files?status=${f.key}` : "/open-files";
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

      {openFiles.length === 0 ? (
        <EmptyState
          title={filter.key ? "No files in this status" : "No open files yet"}
          description={
            filter.key
              ? "Try another filter, or open a file when a seller has sold to an investor or dealer."
              : "When a seller sells to an investor or dealer, open the file here. End purchaser stays empty until a later buyer closes it."
          }
        />
      ) : (
        <>
          <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Open file</th>
                  <th>Plot</th>
                  <th>Seller</th>
                  <th>Holder (XYZ)</th>
                  <th>Dealer letterhead</th>
                  <th>Opened</th>
                  <th>Expiry</th>
                  <th>Days left</th>
                  <th>Fee</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {openFiles.map((f) => {
                  const days = daysUntil(f.expiryDate);
                  const live = LIVE_OPEN_FILE_STATUSES.includes(f.status);
                  const expiringSoon = live && days <= 30;
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
                      <td>{f.holderName ?? "—"}</td>
                      <td>{f.registeredOffice?.officeName ?? f.dealerName}</td>
                      <td>{formatDate(f.openingDate)}</td>
                      <td>{formatDate(f.expiryDate)}</td>
                      <td>
                        {live || f.status === "EXPIRED" ? (
                          <span
                            className={cn(
                              "font-medium",
                              days <= 0 ? "text-rose-700" : days <= 30 ? "text-amber-700" : ""
                            )}
                          >
                            {days <= 0 ? "Expired" : `${days}d`}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td>{formatCurrency(f.feeAmount)}</td>
                      <td>
                        <Badge status={f.status}>{openFileStatusLabel(f.status)}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="space-y-3 md:hidden">
            {openFiles.map((f) => {
              const days = daysUntil(f.expiryDate);
              const live = LIVE_OPEN_FILE_STATUSES.includes(f.status);
              return (
                <li key={f.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <Link href={`/open-files/${f.id}`} className="font-semibold text-teal-900 hover:underline">
                      {f.openFileNumber}
                    </Link>
                    <Badge status={f.status}>{openFileStatusLabel(f.status)}</Badge>
                  </div>
                  <p className="mt-1 text-sm text-slate-700">
                    {f.plot.sector}/{f.plot.block}-{f.plot.plotNumber} · Seller {f.sellerName}
                    {f.holderName ? ` · Holder ${f.holderName}` : ""}
                  </p>
                  <p className="text-sm text-slate-600">
                    Dealer {f.registeredOffice?.officeName ?? f.dealerName} · Fee {formatCurrency(f.feeAmount)}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    Opened {formatDate(f.openingDate)}
                    {live || f.status === "EXPIRED"
                      ? ` · ${days <= 0 ? "Expired" : `expires in ${days}d`}`
                      : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
