import Link from "next/link";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate, labelize } from "@/lib/utils";
import type { DocumentStatus, DocumentType } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const DOC_TYPES = Object.values({
  CNIC: "CNIC",
  ALLOTMENT_LETTER: "ALLOTMENT_LETTER",
  POSSESSION_LETTER: "POSSESSION_LETTER",
  NOC: "NOC",
  NEC: "NEC",
  TRANSFER_FORM: "TRANSFER_FORM",
  BANK_LETTER: "BANK_LETTER",
  MORTGAGE_LETTER: "MORTGAGE_LETTER",
  BANK_NOC: "BANK_NOC",
  LOAN_DOCUMENTS: "LOAN_DOCUMENTS",
  PAYMENT_PO: "PAYMENT_PO",
  DEALER_LETTERHEAD: "DEALER_LETTERHEAD",
  OPEN_FILE_DOCUMENT: "OPEN_FILE_DOCUMENT",
  SIGNATURE: "SIGNATURE",
  THUMB_IMPRESSION: "THUMB_IMPRESSION",
  OTHER: "OTHER",
} satisfies Record<DocumentType, DocumentType>);

const DOC_STATUSES: DocumentStatus[] = ["ACTIVE", "SUPERSEDED", "ARCHIVED", "REJECTED"];

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string; status?: string }>;
}) {
  const sp = await searchParams;
  const docType = sp.type?.trim() as DocumentType | undefined;
  const status = sp.status?.trim() as DocumentStatus | undefined;

  const documents = await prisma.document.findMany({
    where: {
      ...(docType && DOC_TYPES.includes(docType) ? { documentType: docType } : {}),
      ...(status && DOC_STATUSES.includes(status) ? { status } : {}),
    },
    include: { plot: true, uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return (
    <div>
      <PageHeader
        title="Document Register"
        description="Versioned documents scoped to plots, ownerships, and transfers."
      />

      <form className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end">
        <select
          name="type"
          defaultValue={docType ?? ""}
          className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm"
        >
          <option value="">All types</option>
          {DOC_TYPES.map((t) => (
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
          {DOC_STATUSES.map((s) => (
            <option key={s} value={s}>
              {labelize(s)}
            </option>
          ))}
        </select>
        <Button type="submit">Filter</Button>
      </form>

      {documents.length === 0 ? (
        <EmptyState title="No documents found" description="Try adjusting your filters." />
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Type</th>
                <th>Plot</th>
                <th>Version</th>
                <th>Issue Date</th>
                <th>Uploaded By</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {documents.map((d) => (
                <tr key={d.id}>
                  <td>
                    <div className="font-medium">{d.title}</div>
                    <div className="text-xs text-slate-500">{d.fileName}</div>
                  </td>
                  <td>
                    <Badge>{labelize(d.documentType)}</Badge>
                  </td>
                  <td>
                    <Link href={`/plots/${d.plotId}`} className="text-teal-900 hover:underline">
                      {d.plot.sector}/{d.plot.block}-{d.plot.plotNumber}
                    </Link>
                  </td>
                  <td>v{d.version}</td>
                  <td>{formatDate(d.issueDate)}</td>
                  <td>{d.uploadedBy?.name ?? "—"}</td>
                  <td>
                    <Badge status={d.status} />
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
