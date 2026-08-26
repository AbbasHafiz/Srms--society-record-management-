import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { uploadDocument } from "@/app/(app)/documents/actions";
import { fileDownloadHref } from "@/lib/uploads";
import { hasPermission } from "@/lib/rbac";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatDate, labelize } from "@/lib/utils";
import type { DocumentType } from "@/generated/prisma/client";

export type ScanUploadProps = {
  plotId: string;
  ownershipId?: string;
  transferId?: string;
  mortgageId?: string;
  openFileId?: string;
  registeredOfficeId?: string;
  documentType: DocumentType;
  title: string;
  description?: string;
  documentNumber?: string;
  /** When true, only list ACTIVE versions (default shows all for audit trail). */
  activeOnly?: boolean;
  compact?: boolean;
};

export async function ScanUpload({
  plotId,
  ownershipId,
  transferId,
  mortgageId,
  openFileId,
  registeredOfficeId,
  documentType,
  title,
  description,
  documentNumber,
  activeOnly = false,
  compact = false,
}: ScanUploadProps) {
  const session = await auth();
  const canUpload =
    session?.user &&
    (hasPermission(session.user.role, "upload_document") ||
      (documentType === "PAYMENT_PO" && hasPermission(session.user.role, "verify_payment")));

  const documents = await prisma.document.findMany({
    where: {
      plotId,
      documentType,
      ...(ownershipId ? { ownershipId } : transferId ? { ownershipId: null } : {}),
      ...(transferId ? { transferId } : {}),
      ...(mortgageId ? { mortgageId } : {}),
      ...(openFileId ? { openFileId } : {}),
      ...(registeredOfficeId ? { registeredOfficeId } : {}),
      ...(documentNumber ? { documentNumber } : {}),
      ...(activeOnly ? { status: "ACTIVE" } : {}),
    },
    orderBy: [{ version: "desc" }, { createdAt: "desc" }],
    include: { uploadedBy: { select: { name: true } } },
    take: 20,
  });

  return (
    <div className={compact ? "rounded-md border border-slate-200 bg-white p-2" : "rounded-lg border border-slate-200 bg-white p-4"}>
      {!compact ? (
        <div className="mb-3">
          <h4 className="text-sm font-semibold text-slate-900">{title}</h4>
          {description ? <p className="mt-0.5 text-xs text-slate-600">{description}</p> : null}
        </div>
      ) : null}

      {documents.length > 0 ? (
        <ul className={compact ? "mb-2 space-y-1" : "mb-3 space-y-2"}>
          {documents.map((doc) => (
            <li
              key={doc.id}
              className={
                compact
                  ? "flex items-center justify-between gap-2 text-xs"
                  : "flex flex-wrap items-center justify-between gap-2 rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
              }
            >
              <div className="min-w-0 flex-1">
                {!compact ? <p className="truncate font-medium text-slate-900">{doc.title}</p> : null}
                <p className="text-xs text-slate-500">
                  v{doc.version}
                  {!compact ? ` · ${formatDate(doc.createdAt)}` : ""}
                  {doc.uploadedBy && !compact ? ` · ${doc.uploadedBy.name}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {!compact ? <Badge status={doc.status} /> : null}
                <a
                  href={fileDownloadHref(doc.filePath)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-teal-800 hover:underline"
                >
                  View
                </a>
              </div>
            </li>
          ))}
        </ul>
      ) : compact ? null : (
        <p className="mb-3 text-xs text-slate-500">No scans uploaded yet.</p>
      )}

      {canUpload ? (
        <form action={uploadDocument} encType="multipart/form-data" className="space-y-2 border-t border-slate-100 pt-3">
          <input type="hidden" name="plotId" value={plotId} />
          {ownershipId ? <input type="hidden" name="ownershipId" value={ownershipId} /> : null}
          {transferId ? <input type="hidden" name="transferId" value={transferId} /> : null}
          {mortgageId ? <input type="hidden" name="mortgageId" value={mortgageId} /> : null}
          {openFileId ? <input type="hidden" name="openFileId" value={openFileId} /> : null}
          {registeredOfficeId ? (
            <input type="hidden" name="registeredOfficeId" value={registeredOfficeId} />
          ) : null}
          <input type="hidden" name="documentType" value={documentType} />
          <input type="hidden" name="title" value={title} />
          {documentNumber ? <input type="hidden" name="documentNumber" value={documentNumber} /> : null}
          <div>
            <Label className="text-xs text-slate-500">
              Upload scan ({labelize(documentType)}) — PDF, JPEG, PNG
            </Label>
            <Input
              name="file"
              type="file"
              required
              accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
              className="mt-1"
            />
          </div>
          <Button type="submit" size="sm" variant="outline">
            Upload scan
          </Button>
        </form>
      ) : null}
    </div>
  );
}
