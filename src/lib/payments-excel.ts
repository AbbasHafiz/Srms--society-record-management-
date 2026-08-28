import { prisma } from "@/lib/db";
import { plotLabel } from "@/lib/plots";
import { formatDate, labelize } from "@/lib/utils";
import type { PaymentStatus } from "@/generated/prisma/client";
import type { ExcelColumn } from "@/lib/excel";

const STATUSES: PaymentStatus[] = [
  "PENDING",
  "SUBMITTED",
  "VERIFIED",
  "REJECTED",
  "CANCELLED",
  "PAID",
  "PARTIAL",
  "OVERDUE",
  "UNPAID",
];

export const PAYMENT_EXCEL_COLUMNS: ExcelColumn[] = [
  { header: "Date", key: "date", width: 14 },
  { header: "Ref", key: "ref", width: 18 },
  { header: "Plot", key: "plot", width: 16 },
  { header: "Membership", key: "membership", width: 16 },
  { header: "Party", key: "party", width: 22 },
  { header: "Category", key: "category", width: 18 },
  { header: "Method", key: "method", width: 16 },
  { header: "Amount", key: "amount", width: 12 },
  { header: "In/Out", key: "direction", width: 12 },
  { header: "Status", key: "status", width: 12 },
  { header: "Notes", key: "notes", width: 28 },
  { header: "PO Number", key: "poNumber", width: 16 },
];

export async function loadPaymentExcelRows(filters: { status?: string }) {
  const status = filters.status?.trim() as PaymentStatus | undefined;
  const payments = await prisma.payment.findMany({
    where: status && STATUSES.includes(status) ? { status } : undefined,
    include: {
      plot: true,
      ownership: { select: { ownerName: true, membershipNumber: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 10000,
  });
  return payments.map((p) => ({
    date: formatDate(p.paymentDate ?? p.createdAt),
    ref: p.receiptNumber,
    plot: p.plot ? plotLabel(p.plot) : "",
    membership: p.ownership?.membershipNumber ?? "",
    party: p.ownership?.ownerName ?? "",
    category: labelize(p.feeType),
    method: p.paymentMethod === "PO" ? "PO" : labelize(p.paymentMethod),
    amount: Number(p.amount),
    direction: "In",
    status: p.status,
    notes: p.remarks ?? "",
    poNumber: p.poNumber ?? "",
  }));
}
