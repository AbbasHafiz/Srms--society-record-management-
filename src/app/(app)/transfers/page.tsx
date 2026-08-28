import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { SlaBadge } from "@/components/sla-badge";
import { Button } from "@/components/ui/button";
import { formatDate, labelize } from "@/lib/utils";
import type { TransferCaseType, TransferStatus } from "@/generated/prisma/client";
import { excelExportHref } from "@/lib/excel";
import { ExcelExportLink } from "@/components/excel/excel-export-link";

export const dynamic = "force-dynamic";

const STATUSES: TransferStatus[] = [
  "DRAFT",
  "SELLER_VERIFICATION",
  "DOCUMENTS_PENDING",
  "PAYMENT_PENDING",
  "PAYMENT_VERIFICATION",
  "APPROVAL_PENDING",
  "APPROVED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
];

const CASE_TYPES: TransferCaseType[] = ["SALE", "DEATH_SUCCESSION", "GIFT", "OTHER"];

export default async function TransfersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; type?: string }>;
}) {
  const sp = await searchParams;
  const status = sp.status?.trim() as TransferStatus | undefined;
  const caseType = sp.type?.trim() as TransferCaseType | undefined;
  const q = sp.q?.trim();

  const transfers = await prisma.transfer.findMany({
    where: {
      ...(status && STATUSES.includes(status) ? { status } : {}),
      ...(caseType && CASE_TYPES.includes(caseType) ? { transferType: caseType } : {}),
      ...(q
        ? {
            OR: [
              { transferNumber: { contains: q, mode: "insensitive" } },
              { trdNumber: { contains: q, mode: "insensitive" } },
              { sellerName: { contains: q, mode: "insensitive" } },
              { purchaserName: { contains: q, mode: "insensitive" } },
              { sellerCnic: { contains: q } },
              { purchaserCnic: { contains: q } },
            ],
          }
        : {}),
    },
    include: { plot: true },
    orderBy: { updatedAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Transfers"
        description="Ownership transfer workflow. Completed transfers preserve full history."
        actions={
          <div className="flex flex-wrap gap-2">
            <ExcelExportLink href={excelExportHref("transfers", { q, status, type: caseType })} />
            <Link
              href="/transfers/death/new"
              className="inline-flex h-10 items-center justify-center rounded-md border border-violet-300 bg-violet-50 px-4 text-sm font-medium text-violet-900 hover:bg-violet-100"
            >
              Death / Succession
            </Link>
            <Link
              href="/transfers/new"
              className="inline-flex h-10 items-center justify-center rounded-md bg-teal-800 px-4 text-sm font-medium text-white hover:bg-teal-900"
            >
              New Sale Transfer
            </Link>
          </div>
        }
      />

      <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <input
          name="q"
          placeholder="Search transfer #, seller, purchaser, CNIC…"
          defaultValue={q}
          className="flex h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm"
        />
        <select
          name="type"
          defaultValue={caseType ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All types</option>
          {CASE_TYPES.map((t) => (
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
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {labelize(s)}
            </option>
          ))}
        </select>
        <Button type="submit">Filter</Button>
      </form>

      {transfers.length === 0 ? (
        <EmptyState title="No transfers found" description="Try adjusting your filters or start a new transfer." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Transfer</th>
                <th>Type</th>
                <th>Plot</th>
                <th>Seller / Deceased</th>
                <th>Purchaser / Successor</th>
                <th>SLA</th>
                <th>Step</th>
                <th>Updated</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link href={`/transfers/${t.id}`} className="font-semibold text-teal-900 hover:underline">
                      {t.transferNumber}
                    </Link>
                    {t.trdNumber ? <div className="text-xs text-slate-500">{t.trdNumber}</div> : null}
                  </td>
                  <td>
                    <Badge status={t.transferType} />
                  </td>
                  <td>
                    <Link href={`/plots/${t.plotId}`} className="text-teal-900 hover:underline">
                      {t.plot.sector}/{t.plot.block}-{t.plot.plotNumber}
                    </Link>
                  </td>
                  <td>{t.sellerName}</td>
                  <td>{t.purchaserName ?? "—"}</td>
                  <td>
                    {t.slaDueAt ? (
                      <SlaBadge dueAt={t.slaDueAt} completedAt={t.completedAt} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{t.currentStep}</td>
                  <td>{formatDate(t.updatedAt)}</td>
                  <td>
                    <Badge status={t.status} />
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
