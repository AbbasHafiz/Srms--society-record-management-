import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import type { DocumentType, Role } from "@/generated/prisma/client";
import { hasPermission } from "@/lib/rbac";

export const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), "uploads");
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const RESTRICTED_DOCUMENT_TYPES = new Set<DocumentType>([
  "CNIC",
  "DECEASED_CNIC",
  "HEIR_CNIC",
  "PAYMENT_PO",
  "LOAN_DOCUMENTS",
  "BANK_LETTER",
  "MORTGAGE_LETTER",
  "BANK_NOC",
]);

export function sanitizeFileName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, "_");
  return base.slice(0, 200) || "file";
}

export function validateUploadFile(file: File): void {
  if (!file || file.size === 0) throw new Error("No file provided");
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error(`File exceeds maximum size of ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB`);
  }
  const mime = file.type || "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.has(mime)) {
    throw new Error("File type not allowed. Use PDF, JPEG, PNG, or WebP.");
  }
}

export async function saveUploadedFile(file: File): Promise<{
  relativePath: string;
  storedFileName: string;
  mimeType: string;
  fileSize: number;
}> {
  validateUploadFile(file);

  const safeOriginal = sanitizeFileName(file.name);
  const storedFileName = `${randomUUID()}-${safeOriginal}`;
  const relativePath = storedFileName;
  const absolutePath = path.join(UPLOAD_DIR, relativePath);

  await fs.mkdir(UPLOAD_DIR, { recursive: true });

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.writeFile(absolutePath, buffer);

  return {
    relativePath,
    storedFileName,
    mimeType: file.type || "application/octet-stream",
    fileSize: file.size,
  };
}

export function resolveUploadAbsolutePath(relativePath: string): string {
  const normalized = path.normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/, "");
  const absolute = path.resolve(UPLOAD_DIR, normalized);
  const uploadRoot = path.resolve(UPLOAD_DIR);

  if (!absolute.startsWith(uploadRoot + path.sep) && absolute !== uploadRoot) {
    throw new Error("Invalid file path");
  }

  return absolute;
}

export function canAccessDocumentFile(role: Role, documentType?: DocumentType | null): boolean {
  if (!documentType || !RESTRICTED_DOCUMENT_TYPES.has(documentType)) {
    return hasPermission(role, "view");
  }
  return hasPermission(role, "upload_document") || hasPermission(role, "verify_payment");
}

export function fileDownloadHref(relativePath: string): string {
  return `/api/files/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}
