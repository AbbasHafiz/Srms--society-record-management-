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
