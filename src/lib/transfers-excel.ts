import { prisma } from "@/lib/db";
import { plotLabel } from "@/lib/plots";
import { formatDate, labelize } from "@/lib/utils";
import type { TransferCaseType, TransferStatus } from "@/generated/prisma/client";
import type { ExcelColumn } from "@/lib/excel";

const STATUSES: TransferStatus[] = [
  "DRAFT",
  "SELLER_VERIFICATION",
  "DOCUMENTS_PENDING",
  "PAYMENT_PENDING",
  "PAYMENT_VERIFICATION",
  "APPROVAL_PENDING",
  "APPROVED",
  "COMPLETED",
  "REJECTED",
  "CANCELLED",
];

const CASE_TYPES: TransferCaseType[] = ["SALE", "DEATH_SUCCESSION", "GIFT", "OTHER"];

export const TRANSFER_EXCEL_COLUMNS: ExcelColumn[] = [
  { header: "Transfer Number", key: "transferNumber", width: 16 },
  { header: "TRD Number", key: "trdNumber", width: 14 },
  { header: "Type", key: "transferType", width: 16 },
  { header: "Plot", key: "plot", width: 16 },
  { header: "Seller / Deceased", key: "sellerName", width: 22 },
  { header: "Seller CNIC", key: "sellerCnic", width: 18 },
  { header: "Purchaser / Successor", key: "purchaserName", width: 22 },
  { header: "Purchaser CNIC", key: "purchaserCnic", width: 18 },
  { header: "Status", key: "status", width: 18 },
  { header: "Step", key: "currentStep", width: 8 },
  { header: "Created", key: "createdAt", width: 14 },
  { header: "Updated", key: "updatedAt", width: 14 },
  { header: "Completed", key: "completedAt", width: 14 },
];

export async function loadTransferExcelRows(filters: { q?: string; status?: string; type?: string }) {
  const status = filters.status?.trim() as TransferStatus | undefined;
  const caseType = filters.type?.trim() as TransferCaseType | undefined;
  const q = filters.q?.trim();
  const transfers = await prisma.transfer.findMany({
    where: {
      ...(status && STATUSES.includes(status) ? { status } : {}),
      ...(caseType && CASE_TYPES.includes(caseType) ? { transferType: caseType } : {}),
      ...(q
        ? {
            OR: [
              { transferNumber: { contains: q, mode: "insensitive" } },
              { trdNumber: { contains: q, mode: "insensitive" } },
              { sellerName: { contains: q, mode: "insensitive" } },
              { purchaserName: { contains: q, mode: "insensitive" } },
              { sellerCnic: { contains: q } },
              { purchaserCnic: { contains: q } },
            ],
          }
        : {}),
    },
    include: { plot: true },
    orderBy: { updatedAt: "desc" },
    take: 10000,
  });
  return transfers.map((t) => ({
    transferNumber: t.transferNumber,
    trdNumber: t.trdNumber ?? "",
    transferType: labelize(t.transferType),
    plot: plotLabel(t.plot),
    sellerName: t.sellerName,
    sellerCnic: t.sellerCnic,
    purchaserName: t.purchaserName ?? "",
    purchaserCnic: t.purchaserCnic ?? "",
    status: t.status,
    currentStep: t.currentStep,
    createdAt: formatDate(t.createdAt),
    updatedAt: formatDate(t.updatedAt),
    completedAt: formatDate(t.completedAt),
  }));
}
