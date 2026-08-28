import { prisma } from "@/lib/db";
import { plotLabel } from "@/lib/plots";
import { formatDate, labelize } from "@/lib/utils";
import {
  LIVE_OPEN_FILE_STATUSES,
  OPEN_LIST_STATUSES,
  openFileStatusLabel,
} from "@/lib/open-files";
import type { OpenFileStatus, Prisma } from "@/generated/prisma/client";
import type { ExcelColumn } from "@/lib/excel";

const FILTERS: { key: string; statuses?: OpenFileStatus[] }[] = [
  { key: "" },
  { key: "open", statuses: OPEN_LIST_STATUSES },
  { key: "closed", statuses: ["CLOSED"] },
  { key: "cancelled", statuses: ["CANCELLED"] },
];

export const OPEN_FILE_EXCEL_COLUMNS: ExcelColumn[] = [
  { header: "Open File Number", key: "openFileNumber", width: 16 },
  { header: "Plot", key: "plot", width: 16 },
  { header: "Seller", key: "sellerName", width: 22 },
  { header: "Seller CNIC", key: "sellerCnic", width: 18 },
  { header: "Holder", key: "holderName", width: 22 },
  { header: "Dealer", key: "dealer", width: 22 },
  { header: "Opened", key: "openingDate", width: 14 },
  { header: "Expiry", key: "expiryDate", width: 14 },
  { header: "Fee Amount", key: "feeAmount", width: 12 },
  { header: "Payment Status", key: "paymentStatus", width: 16 },
  { header: "Status", key: "status", width: 22 },
];

export async function loadOpenFileExcelRows(filters: { status?: string }) {
  const filterKey = filters.status?.trim() || "";
  const filter = FILTERS.find((f) => f.key === filterKey) ?? FILTERS[0];
  const where: Prisma.OpenFileWhereInput | undefined = filter.statuses
    ? { status: { in: filter.statuses } }
    : undefined;
  const files = await prisma.openFile.findMany({
    where,
    include: { plot: true, registeredOffice: { select: { officeName: true } } },
    orderBy: { openingDate: "desc" },
    take: 10000,
  });
  return files.map((f) => ({
    openFileNumber: f.openFileNumber,
    plot: plotLabel(f.plot),
    sellerName: f.sellerName,
    sellerCnic: f.sellerCnic,
    holderName: f.holderName ?? "",
    dealer: f.registeredOffice?.officeName ?? f.dealerName,
    openingDate: formatDate(f.openingDate),
    expiryDate: formatDate(f.expiryDate),
    feeAmount: Number(f.feeAmount),
    paymentStatus: labelize(f.paymentStatus),
    status: openFileStatusLabel(f.status),
  }));
}

export { LIVE_OPEN_FILE_STATUSES };
