import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { nextFinanceTxnNumber } from "@/lib/numbering";
import type {
  FeeType,
  FinanceCategoryType,
  FinanceTransactionStatus,
  PaymentMethod,
  Prisma,
} from "@/generated/prisma/client";
import { endOfDay, startOfDay, startOfMonth } from "date-fns";

export const FINANCE_CATEGORY_SEEDS: Array<{
  code: string;
  name: string;
  type: FinanceCategoryType;
  sortOrder: number;
  description?: string;
}> = [
  { code: "REV_TRANSFER_FEES", name: "Transfer Fees", type: "REVENUE", sortOrder: 10 },
  { code: "REV_OPEN_FILE", name: "Open File / Dealer Fees", type: "REVENUE", sortOrder: 20 },
  { code: "REV_PLOT_CHARGES", name: "Annual / Monthly Plot Charges", type: "REVENUE", sortOrder: 30 },
  { code: "REV_NOC_FEES", name: "NOC Fees (incl. Construction NOC)", type: "REVENUE", sortOrder: 40 },
  { code: "REV_NEC_FEES", name: "NEC Fees", type: "REVENUE", sortOrder: 50 },
  { code: "REV_POSSESSION", name: "Possession Fees", type: "REVENUE", sortOrder: 60 },
  { code: "REV_TANKER", name: "Water Tanker Charges", type: "REVENUE", sortOrder: 70 },
  { code: "REV_LATE_SURCHARGE", name: "Late Payment / Surcharge", type: "REVENUE", sortOrder: 80 },
  {
    code: "REV_MUTUAL_TRANSFER",
    name: "Mutual Transfer / Documentation Charges",
    type: "REVENUE",
    sortOrder: 90,
  },
  { code: "REV_COMMERCIAL_RENT", name: "Commercial / Shop Rent", type: "REVENUE", sortOrder: 100 },
  { code: "REV_AMENITY", name: "Amenity / Park Booking", type: "REVENUE", sortOrder: 110 },
  { code: "REV_DONATION", name: "Donation / Miscellaneous Income", type: "REVENUE", sortOrder: 120 },
  { code: "REV_OTHER", name: "Other Income", type: "REVENUE", sortOrder: 130 },
  { code: "EXP_SALARIES", name: "Staff Salaries / Payroll", type: "EXPENSE", sortOrder: 10 },
  {
    code: "EXP_CONTRACTOR",
    name: "Contractor Payments (Maintenance, Electrical, Civil, Plumbing)",
    type: "EXPENSE",
    sortOrder: 20,
  },
  { code: "EXP_UTILITIES", name: "Utilities (Electricity, Water for Society)", type: "EXPENSE", sortOrder: 30 },
  { code: "EXP_FUEL", name: "Fuel (Tractors, Tankers, Generators)", type: "EXPENSE", sortOrder: 40 },
  { code: "EXP_VEHICLE", name: "Vehicle Maintenance", type: "EXPENSE", sortOrder: 50 },
  { code: "EXP_SECURITY", name: "Security Expenses", type: "EXPENSE", sortOrder: 60 },
  { code: "EXP_OFFICE", name: "Office / Admin Supplies", type: "EXPENSE", sortOrder: 70 },
  { code: "EXP_LEGAL", name: "Legal / Professional Fees", type: "EXPENSE", sortOrder: 80 },
  {
    code: "EXP_REPAIR",
    name: "Repair & Maintenance (Roads, Parks, Mosque, Street Lights)",
    type: "EXPENSE",
    sortOrder: 90,
  },
  { code: "EXP_CONSTRUCTION", name: "Construction / Development Works", type: "EXPENSE", sortOrder: 100 },
  { code: "EXP_BANK", name: "Bank Charges", type: "EXPENSE", sortOrder: 110 },
  { code: "EXP_MISCELLANEOUS", name: "Miscellaneous Expenses", type: "EXPENSE", sortOrder: 120 },
  { code: "EXP_OTHER", name: "Other Expense", type: "EXPENSE", sortOrder: 130 },
];

/** Maps society fee types to chart-of-accounts revenue categories for auto-posting. */
export const FEE_TYPE_TO_CATEGORY_CODE: Partial<Record<FeeType, string>> = {
  TRANSFER: "REV_TRANSFER_FEES",
  OPEN_FILE: "REV_OPEN_FILE",
  ANNUAL_PLOT_CHARGE: "REV_PLOT_CHARGES",
  NOC: "REV_NOC_FEES",
  NEC: "REV_NEC_FEES",
  POSSESSION: "REV_POSSESSION",
  WATER_TANKER: "REV_TANKER",
  OTHER: "REV_OTHER",
};

export async function getFinanceSummary(referenceDate = new Date()) {
  const todayStart = startOfDay(referenceDate);
  const todayEnd = endOfDay(referenceDate);
  const monthStart = startOfMonth(referenceDate);

  const [todayRevenue, todayExpenses, mtdRevenue, mtdExpenses] = await Promise.all([
    prisma.financeTransaction.aggregate({
      where: {
        type: "REVENUE",
        status: "POSTED",
        txnDate: { gte: todayStart, lte: todayEnd },
      },
      _sum: { amount: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        type: "EXPENSE",
        status: "POSTED",
        txnDate: { gte: todayStart, lte: todayEnd },
      },
      _sum: { amount: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        type: "REVENUE",
        status: "POSTED",
        txnDate: { gte: monthStart, lte: todayEnd },
      },
      _sum: { amount: true },
    }),
    prisma.financeTransaction.aggregate({
      where: {
        type: "EXPENSE",
        status: "POSTED",
        txnDate: { gte: monthStart, lte: todayEnd },
      },
      _sum: { amount: true },
    }),
  ]);

  const todayRev = Number(todayRevenue._sum.amount ?? 0);
  const todayExp = Number(todayExpenses._sum.amount ?? 0);
  const mtdRev = Number(mtdRevenue._sum.amount ?? 0);
  const mtdExp = Number(mtdExpenses._sum.amount ?? 0);

  return {
    todayRevenue: todayRev,
    todayExpenses: todayExp,
    mtdRevenue: mtdRev,
    mtdExpenses: mtdExp,
    todayNet: todayRev - todayExp,
    mtdNet: mtdRev - mtdExp,
  };
}

type CreateFinanceTxnInput = {
  categoryId: string;
  amount: number;
  txnDate: Date;
  paymentMethod: PaymentMethod;
  reference?: string | null;
  plotId?: string | null;
  ownershipId?: string | null;
  employeeId?: string | null;
  paymentId?: string | null;
  description?: string | null;
  status?: FinanceTransactionStatus;
  createdById?: string | null;
};

export async function createFinanceTransaction(input: CreateFinanceTxnInput) {
  const category = await prisma.financeCategory.findUnique({ where: { id: input.categoryId } });
  if (!category || !category.isActive) throw new Error("Finance category not found or inactive");

  if (input.paymentId) {
    const existing = await prisma.financeTransaction.findUnique({
      where: { paymentId: input.paymentId },
    });
    if (existing) throw new Error("A ledger entry already exists for this payment");
  }

  const txnNumber = await nextFinanceTxnNumber();
  const status = input.status ?? "DRAFT";

  const txn = await prisma.financeTransaction.create({
    data: {
      txnNumber,
      categoryId: category.id,
      type: category.type,
      amount: input.amount,
      txnDate: input.txnDate,
      paymentMethod: input.paymentMethod,
      reference: input.reference ?? undefined,
      plotId: input.plotId ?? undefined,
      ownershipId: input.ownershipId ?? undefined,
      employeeId: input.employeeId ?? undefined,
      paymentId: input.paymentId ?? undefined,
      description: input.description ?? undefined,
      status,
      createdById: input.createdById ?? undefined,
    },
    include: { category: true },
  });

  await writeAuditLog({
    userId: input.createdById,
    action: status === "POSTED" ? "FINANCE_TXN_POSTED" : "FINANCE_TXN_CREATED",
    module: "finance",
    recordId: txn.id,
    plotId: txn.plotId,
    newValue: {
      txnNumber: txn.txnNumber,
      type: txn.type,
      amount: Number(txn.amount),
      status: txn.status,
      categoryCode: category.code,
    } as Prisma.InputJsonValue,
  });

  return txn;
}

export async function postFinanceTransaction(txnId: string, userId: string) {
  const txn = await prisma.financeTransaction.findUnique({ where: { id: txnId } });
  if (!txn) throw new Error("Transaction not found");
  if (txn.status === "POSTED") throw new Error("Transaction is already posted");
  if (txn.status === "VOID") throw new Error("Cannot post a voided transaction");

  const updated = await prisma.financeTransaction.update({
    where: { id: txnId },
    data: { status: "POSTED" },
    include: { category: true },
  });

  await writeAuditLog({
    userId,
    action: "FINANCE_TXN_POSTED",
    module: "finance",
    recordId: txn.id,
    plotId: txn.plotId,
    oldValue: { status: txn.status },
    newValue: { status: "POSTED", amount: Number(txn.amount) },
  });

  return updated;
}

export async function voidFinanceTransaction(txnId: string, userId: string, reason: string) {
  const txn = await prisma.financeTransaction.findUnique({ where: { id: txnId } });
  if (!txn) throw new Error("Transaction not found");
  if (txn.status === "VOID") throw new Error("Transaction is already void");

  const updated = await prisma.financeTransaction.update({
    where: { id: txnId },
    data: { status: "VOID", voidReason: reason.trim() || "Voided" },
    include: { category: true },
  });

  await writeAuditLog({
    userId,
    action: "FINANCE_TXN_VOIDED",
    module: "finance",
    recordId: txn.id,
    plotId: txn.plotId,
    oldValue: { status: txn.status, amount: Number(txn.amount) },
    newValue: { status: "VOID" },
    reason,
  });

  return updated;
}

/**
 * Post revenue from a verified payment receipt into the finance ledger.
 * Used automatically on payment verification (TRANSFER, OPEN_FILE) and via manual "Post to ledger" action.
 */
export async function postRevenueFromPayment(paymentId: string, userId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("Payment not found");
  if (payment.status !== "VERIFIED") {
    throw new Error("Payment must be verified before posting to the ledger");
  }

  const existing = await prisma.financeTransaction.findUnique({ where: { paymentId } });
  if (existing) throw new Error("Ledger entry already exists for this payment");

  const categoryCode = FEE_TYPE_TO_CATEGORY_CODE[payment.feeType] ?? "REV_OTHER";
  const category = await prisma.financeCategory.findUnique({ where: { code: categoryCode } });
  if (!category) throw new Error(`Finance category ${categoryCode} not configured`);

  return createFinanceTransaction({
    categoryId: category.id,
    amount: Number(payment.amount),
    txnDate: payment.paymentDate ?? payment.verifiedAt ?? new Date(),
    paymentMethod: payment.paymentMethod,
    reference: payment.poNumber ?? payment.receiptNumber,
    plotId: payment.plotId,
    ownershipId: payment.ownershipId,
    paymentId: payment.id,
    description: `${category.name} — receipt ${payment.receiptNumber}`,
    status: "POSTED",
    createdById: userId,
  });
}

/** Fee types that auto-post to the ledger when Finance verifies the payment. */
export const AUTO_POST_FEE_TYPES: FeeType[] = ["TRANSFER", "OPEN_FILE"];
