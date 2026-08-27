export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;

export function fileDownloadHref(relativePath: string): string {
  return `/api/files/${relativePath.split("/").map(encodeURIComponent).join("/")}`;
}
