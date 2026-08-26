import QRCode from "qrcode";

/** Base URL for scan links (NEXTAUTH_URL or local dev default). */
export function getAppBaseUrl(): string {
  const url = process.env.NEXTAUTH_URL || "http://127.0.0.1:43127";
  return url.replace(/\/$/, "");
}

/** Relative scan path for a physical file barcode. */
export function getScanPath(barcode: string): string {
  return `/f/${encodeURIComponent(barcode)}`;
}

/** Absolute scan URL encoded in QR codes (works when scanned on phones). */
export function getScanUrl(barcode: string, baseUrl?: string): string {
  return `${baseUrl ?? getAppBaseUrl()}${getScanPath(barcode)}`;
}

export async function generateQrDataUrl(text: string, size = 256): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    width: size,
    errorCorrectionLevel: "M",
  });
}
