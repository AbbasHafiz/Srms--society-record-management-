import { generateQrDataUrl, getScanUrl } from "@/lib/qr";

export async function QrCodeDisplay({
  barcode,
  size = 200,
  showUrl = true,
  className,
}: {
  barcode: string;
  size?: number;
  showUrl?: boolean;
  className?: string;
}) {
  const scanUrl = getScanUrl(barcode);
  const dataUrl = await generateQrDataUrl(scanUrl, size);

  return (
    <div className={className}>
      <img
        src={dataUrl}
        alt={`QR code for ${barcode}`}
        width={size}
        height={size}
        className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm"
      />
      {showUrl ? (
        <p className="mt-2 break-all text-center font-mono text-xs text-slate-600">{scanUrl}</p>
      ) : null}
    </div>
  );
}
