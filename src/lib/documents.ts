import { prisma } from "@/lib/db";
import type { DocumentType } from "@/generated/prisma/client";
import { saveUploadedFile } from "@/lib/uploads";

/** True when the row points at an actual uploaded file, not a placeholder stub. */
export function isRealUploadedDocument(doc: {
  filePath: string;
  fileSize?: number | null;
  fileName?: string;
}): boolean {
  if (doc.fileSize != null && doc.fileSize > 0) return true;
  if (doc.fileName?.includes("placeholder")) return false;
  if (doc.filePath.includes("/uploads/death/")) return false;
  if (doc.filePath.startsWith("/uploads/")) return false;
  return doc.filePath.length > 0;
}

export type CreateDocumentInput = {
  plotId: string;
  ownershipId?: string | null;
  transferId?: string | null;
  openFileId?: string | null;
  mortgageId?: string | null;
  registeredOfficeId?: string | null;
  documentType: DocumentType;
  title: string;
  documentNumber?: string | null;
  otherDetail?: string | null;
  issueDate?: Date | null;
  expiryDate?: Date | null;
  remarks?: string | null;
  uploadedById?: string | null;
  file: File;
};

function versionScopeWhere(input: CreateDocumentInput) {
  return {
    plotId: input.plotId,
    ownershipId: input.ownershipId ?? null,
    transferId: input.transferId ?? null,
    openFileId: input.openFileId ?? null,
    mortgageId: input.mortgageId ?? null,
    registeredOfficeId: input.registeredOfficeId ?? null,
    documentType: input.documentType,
    ...(input.documentNumber ? { documentNumber: input.documentNumber } : {}),
    status: "ACTIVE" as const,
  };
}

export async function createDocumentWithUpload(input: CreateDocumentInput) {
  const saved = await saveUploadedFile(input.file);

  const previous = await prisma.document.findFirst({
    where: versionScopeWhere(input),
    orderBy: { version: "desc" },
  });

  if (previous) {
    await prisma.document.update({
      where: { id: previous.id },
      data: { status: "SUPERSEDED" },
    });
  }

  return prisma.document.create({
    data: {
      plotId: input.plotId,
      ownershipId: input.ownershipId ?? undefined,
      transferId: input.transferId ?? undefined,
      openFileId: input.openFileId ?? undefined,
      mortgageId: input.mortgageId ?? undefined,
      registeredOfficeId: input.registeredOfficeId ?? undefined,
      documentType: input.documentType,
      otherDetail: input.otherDetail ?? undefined,
      title: input.title,
      documentNumber: input.documentNumber ?? undefined,
      issueDate: input.issueDate ?? undefined,
      expiryDate: input.expiryDate ?? undefined,
      fileName: saved.storedFileName,
      filePath: saved.relativePath,
      mimeType: saved.mimeType,
      fileSize: saved.fileSize,
      version: previous ? previous.version + 1 : 1,
      previousDocId: previous?.id,
      remarks: input.remarks ?? undefined,
      uploadedById: input.uploadedById ?? undefined,
      status: "ACTIVE",
    },
  });
}
