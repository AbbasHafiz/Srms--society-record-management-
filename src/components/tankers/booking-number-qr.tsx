import { generateQrDataUrl } from "@/lib/qr";

export async function BookingNumberQr({
  bookingNumber,
  size = 120,
}: {
  bookingNumber: string;
  size?: number;
}) {
  const dataUrl = await generateQrDataUrl(bookingNumber, size);

  return (
    <img
      src={dataUrl}
      alt={`QR code for booking ${bookingNumber}`}
      width={size}
      height={size}
      className="tanker-slip-qr rounded border border-slate-300 bg-white p-1"
    />
  );
}
