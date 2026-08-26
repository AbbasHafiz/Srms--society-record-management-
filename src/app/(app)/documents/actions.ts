"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { createDocumentWithUpload } from "@/lib/documents";
import { hasPermission } from "@/lib/rbac";
import type { DocumentType } from "@/generated/prisma/client";

const DOC_TYPES = new Set<string>([
  "CNIC",
  "ALLOTMENT_LETTER",
  "OLD_ALLOTMENT_LETTER",
  "DECEASED_CNIC",
  "DEATH_CERTIFICATE",
  "FRC_NADRA",
  "LEGAL_HEIR_CERTIFICATE",
  "SUCCESSION_DOCS",
  "HEIR_CNIC",
  "POSSESSION_LETTER",
  "NOC",
  "NEC",
  "TRANSFER_FORM",
  "BANK_LETTER",
  "MORTGAGE_LETTER",
  "BANK_NOC",
  "LOAN_DOCUMENTS",
  "PAYMENT_PO",
  "DEALER_LETTERHEAD",
  "OPEN_FILE_DOCUMENT",
  "SIGNATURE",
  "THUMB_IMPRESSION",
  "OTHER",
]);

function canUploadDocument(role: import("@/generated/prisma/client").Role, documentType: DocumentType) {
  if (hasPermission(role, "upload_document")) return true;
  if (documentType === "PAYMENT_PO" && hasPermission(role, "verify_payment")) return true;
  return false;
}

export async function uploadDocument(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const plotId = String(formData.get("plotId") || "");
  const ownershipId = String(formData.get("ownershipId") || "").trim() || null;
  const transferId = String(formData.get("transferId") || "").trim() || null;
  const mortgageId = String(formData.get("mortgageId") || "").trim() || null;
  const openFileId = String(formData.get("openFileId") || "").trim() || null;
  const documentType = String(formData.get("documentType") || "") as DocumentType;
  const title = String(formData.get("title") || "").trim();
  const documentNumber = String(formData.get("documentNumber") || "").trim() || null;
  const remarks = String(formData.get("remarks") || "").trim() || null;
  const file = formData.get("file");

  if (!canUploadDocument(session.user.role, documentType)) throw new Error("Forbidden");
  if (!plotId) throw new Error("Plot is required");
  if (!DOC_TYPES.has(documentType)) throw new Error("Invalid document type");
  if (!title) throw new Error("Title is required");
  if (!(file instanceof File) || file.size === 0) throw new Error("File is required");

  const plot = await prisma.plot.findUnique({ where: { id: plotId } });
  if (!plot) throw new Error("Plot not found");

  const doc = await createDocumentWithUpload({
    plotId,
    ownershipId,
    transferId,
    openFileId,
    mortgageId,
    documentType,
    title,
    documentNumber,
    remarks,
    uploadedById: session.user.id,
    file,
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "DOCUMENT_UPLOADED",
    module: "documents",
    recordId: doc.id,
    plotId,
    transferId: transferId ?? undefined,
    newValue: {
      documentType,
      title,
      version: doc.version,
      fileName: doc.fileName,
    },
  });

  revalidatePath("/documents");
  revalidatePath(`/plots/${plotId}`);
  if (transferId) revalidatePath(`/transfers/${transferId}`);
  if (mortgageId) revalidatePath(`/mortgages/${mortgageId}`);
  if (openFileId) revalidatePath(`/open-files/${openFileId}`);
  revalidatePath("/payments");
  revalidatePath("/possession");
  revalidatePath("/noc");
  revalidatePath("/nec");
}
