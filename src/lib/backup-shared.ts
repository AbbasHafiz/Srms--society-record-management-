export const BACKUP_APP_ID = "srms";
export const BACKUP_FORMAT = 1;
export const MAX_BACKUP_BYTES = 512 * 1024 * 1024;
export const RESTORE_CONFIRM_PHRASE = "RESTORE";

export function looksLikeRejectedUpload(file: { name: string; type: string }): string | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".xlsx") || name.endsWith(".xls") || name.endsWith(".csv")) {
    return "That is a spreadsheet, not a Society Records backup. Choose a .zip downloaded from this page.";
  }
  if (name.endsWith(".pdf")) {
    return "PDF files cannot be restored. Choose a .zip downloaded from Settings → Backup & restore.";
  }
  if (
    !name.endsWith(".zip") &&
    file.type !== "application/zip" &&
    file.type !== "application/x-zip-compressed"
  ) {
    return "Upload a .zip produced by Download backup on this page.";
  }
  return null;
}
