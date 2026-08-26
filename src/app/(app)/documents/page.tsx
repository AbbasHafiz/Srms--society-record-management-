import Link from "next/link";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { PageHeader, EmptyState } from "@/components/ui/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DocumentUploadForm } from "@/components/documents/document-upload-form";
import { uploadDocument } from "./actions";
import { fileDownloadHref } from "@/lib/uploads";
import { hasPermission } from "@/lib/rbac";
import { formatDate, labelize } from "@/lib/utils";
import type { DocumentStatus, DocumentType } from "@/generated/prisma/client";

export const dynamic = "force-dynamic";

const DOC_TYPES = Object.values({
  CNIC: "CNIC",
  ALLOTMENT_LETTER: "ALLOTMENT_LETTER",
  OLD_ALLOTMENT_LETTER: "OLD_ALLOTMENT_LETTER",
  DECEASED_CNIC: "DECEASED_CNIC",
  DEATH_CERTIFICATE: "DEATH_CERTIFICATE",
  FRC_NADRA: "FRC_NADRA",
  LEGAL_HEIR_CERTIFICATE: "LEGAL_HEIR_CERTIFICATE",
  SUCCESSION_DOCS: "SUCCESSION_DOCS",
  HEIR_CNIC: "HEIR_CNIC",
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
  searchParams: Promise<{ type?: string; status?: string; plotId?: string }>;
}) {
  const session = await auth();
  const sp = await searchParams;
  const docType = sp.type?.trim() as DocumentType | undefined;
  const status = sp.status?.trim() as DocumentStatus | undefined;
  const plotId = sp.plotId?.trim();

  const canUpload = session?.user && hasPermission(session.user.role, "upload_document");

  const [documents, plots] = await Promise.all([
    prisma.document.findMany({
      where: {
        ...(docType && DOC_TYPES.includes(docType) ? { documentType: docType } : {}),
        ...(status && DOC_STATUSES.includes(status) ? { status } : {}),
        ...(plotId ? { plotId } : {}),
      },
      include: { plot: true, uploadedBy: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    canUpload
      ? prisma.plot.findMany({
          include: { ownerships: { where: { status: "ACTIVE" }, take: 1 } },
          orderBy: { plotNumber: "asc" },
          take: 200,
        })
      : Promise.resolve([]),
  ]);

  const selectedPlot = plotId ? plots.find((p) => p.id === plotId) : undefined;

  return (
    <div>
      <PageHeader
        title="Document Register"
        description="Versioned documents scoped to plots, ownerships, and transfers."
      />

      {canUpload && plots.length > 0 ? (
        <div className="mb-6">
          {!plotId ? (
            <form className="mb-4 flex gap-2" action="/documents" method="get">
              <select
                name="plotId"
                defaultValue=""
                className="h-10 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm"
              >
                <option value="">Select plot to upload…</option>
                {plots.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.sector}/{p.block}-{p.plotNumber}
                    {p.ownerships[0] ? ` — ${p.ownerships[0].ownerName}` : ""}
                  </option>
                ))}
              </select>
              <Button type="submit">Upload to plot</Button>
            </form>
          ) : selectedPlot ? (
            <DocumentUploadForm
              action={uploadDocument}
              plotId={selectedPlot.id}
              ownerships={selectedPlot.ownerships.map((o) => ({
                id: o.id,
                ownerName: o.ownerName,
                membershipNumber: o.membershipNumber,
              }))}
            />
          ) : null}
        </div>
      ) : null}

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
        {plotId ? <input type="hidden" name="plotId" value={plotId} /> : null}
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
                <th>File</th>
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
                  <td>
                    {d.filePath.startsWith("/uploads/") ? (
                      <span className="text-xs text-slate-400">seed placeholder</span>
                    ) : (
                      <a
                        href={fileDownloadHref(d.filePath)}
                        className="text-sm text-teal-800 hover:underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        View
                      </a>
                    )}
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
