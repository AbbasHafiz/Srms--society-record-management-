import { prisma } from "@/lib/db";
import { createFinanceTransaction } from "@/lib/finance";
import { canManageElectricity as canManageElectricityRole } from "@/lib/rbac";
import type { PaymentMethod, Role, UtilityBillStatus } from "@/generated/prisma/client";
import { endOfDay, startOfDay } from "date-fns";

export const UTILITY_BILL_STATUSES: UtilityBillStatus[] = ["PENDING", "PAID", "OVERDUE", "CANCELLED"];

export function canManageElectricity(role: Role) {
  return canManageElectricityRole(role);
}

export function canViewElectricity(role: Role) {
  return (
    canManageElectricity(role) ||
    role === "VIEWER" ||
    role === "SECRETARY" ||
    role === "PRESIDENT"
  );
}

export function periodLabel(month: number, year: number) {
  const d = new Date(year, month - 1, 1);
  return d.toLocaleDateString("en-GB", { month: "short", year: "numeric" });
}

type ElectricityFilters = {
  periodMonth?: number;
  periodYear?: number;
  status?: UtilityBillStatus;
  vendor?: string;
};

function billWhere(filters: ElectricityFilters) {
  return {
    ...(filters.periodMonth ? { periodMonth: filters.periodMonth } : {}),
    ...(filters.periodYear ? { periodYear: filters.periodYear } : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.vendor
      ? { vendor: { contains: filters.vendor, mode: "insensitive" as const } }
      : {}),
  };
}

export async function getElectricitySummary(filters: ElectricityFilters = {}) {
  const where = billWhere(filters);
  const activeWhere = { ...where, status: { not: "CANCELLED" as const } };

  const [totals, paidTotals, bills] = await Promise.all([
    prisma.electricityBill.aggregate({
      where: activeWhere,
      _sum: { amount: true, units: true },
      _count: true,
    }),
    prisma.electricityBill.aggregate({
      where: { ...activeWhere, status: "PAID" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.electricityBill.findMany({
      where,
      include: {
        createdBy: { select: { name: true } },
        financeTransaction: { select: { txnNumber: true, id: true } },
      },
      orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { dueDate: "desc" }],
      take: 200,
    }),
  ]);

  return {
    totalAmount: Number(totals._sum.amount ?? 0),
    totalUnits: Number(totals._sum.units ?? 0),
    billCount: totals._count,
    paidAmount: Number(paidTotals._sum.amount ?? 0),
    paidCount: paidTotals._count,
    bills,
  };
}

export async function getMonthlyElectricitySpend(month: number, year: number) {
  const where = {
    periodMonth: month,
    periodYear: year,
    status: { not: "CANCELLED" as const },
  };

  const [billed, paid] = await Promise.all([
    prisma.electricityBill.aggregate({ where, _sum: { amount: true, units: true } }),
    prisma.electricityBill.aggregate({
      where: { ...where, status: "PAID" },
      _sum: { amount: true },
    }),
  ]);

  return {
    billedAmount: Number(billed._sum.amount ?? 0),
    billedUnits: Number(billed._sum.units ?? 0),
    paidAmount: Number(paid._sum.amount ?? 0),
  };
}

type CreateElectricityBillInput = {
  periodMonth: number;
  periodYear: number;
  meterNo?: string | null;
  accountNo?: string | null;
  units?: number | null;
  amount: number;
  dueDate: Date;
  vendor?: string | null;
  remarks?: string | null;
  scanFileName?: string | null;
  scanFilePath?: string | null;
  scanMimeType?: string | null;
  createdById?: string | null;
};

export async function createElectricityBillRecord(input: CreateElectricityBillInput) {
  if (input.periodMonth < 1 || input.periodMonth > 12) throw new Error("Invalid billing month");

  const status: UtilityBillStatus =
    input.dueDate < startOfDay(new Date()) ? "OVERDUE" : "PENDING";

  return prisma.electricityBill.create({
    data: {
      periodMonth: input.periodMonth,
      periodYear: input.periodYear,
      meterNo: input.meterNo ?? undefined,
      accountNo: input.accountNo ?? undefined,
      units: input.units ?? undefined,
      amount: input.amount,
      dueDate: input.dueDate,
      status,
      vendor: input.vendor ?? undefined,
      remarks: input.remarks ?? undefined,
      scanFileName: input.scanFileName ?? undefined,
      scanFilePath: input.scanFilePath ?? undefined,
      scanMimeType: input.scanMimeType ?? undefined,
      createdById: input.createdById ?? undefined,
    },
  });
}

type UpdateElectricityBillInput = CreateElectricityBillInput & { id: string };

export async function updateElectricityBillRecord(input: UpdateElectricityBillInput) {
  const existing = await prisma.electricityBill.findUnique({ where: { id: input.id } });
  if (!existing) throw new Error("Electricity bill not found");
  if (existing.status === "PAID") throw new Error("Paid bills cannot be edited");
  if (existing.status === "CANCELLED") throw new Error("Cancelled bills cannot be edited");

  const status: UtilityBillStatus =
    existing.status === "OVERDUE"
      ? "OVERDUE"
      : input.dueDate < startOfDay(new Date())
        ? "OVERDUE"
        : "PENDING";

  return prisma.electricityBill.update({
    where: { id: input.id },
    data: {
      periodMonth: input.periodMonth,
      periodYear: input.periodYear,
      meterNo: input.meterNo ?? undefined,
      accountNo: input.accountNo ?? undefined,
      units: input.units ?? undefined,
      amount: input.amount,
      dueDate: input.dueDate,
      status,
      vendor: input.vendor ?? undefined,
      remarks: input.remarks ?? undefined,
      scanFileName: input.scanFileName ?? undefined,
      scanFilePath: input.scanFilePath ?? undefined,
      scanMimeType: input.scanMimeType ?? undefined,
    },
  });
}

export async function markElectricityBillPaid(
  id: string,
  options?: {
    paidAt?: Date;
    postToFinance?: boolean;
    paymentMethod?: PaymentMethod;
    createdById?: string | null;
  }
) {
  const existing = await prisma.electricityBill.findUnique({ where: { id } });
  if (!existing) throw new Error("Electricity bill not found");
  if (existing.status === "CANCELLED") throw new Error("Cancelled bills cannot be marked paid");
  if (existing.status === "PAID") throw new Error("Bill is already paid");

  const paidAt = options?.paidAt ?? new Date();
  let financeTransactionId = existing.financeTransactionId ?? undefined;

  if (options?.postToFinance && !financeTransactionId) {
    const category = await prisma.financeCategory.findUnique({ where: { code: "EXP_UTILITIES" } });
    if (!category) throw new Error("Finance category EXP_UTILITIES is not configured");

    const txn = await createFinanceTransaction({
      categoryId: category.id,
      amount: Number(existing.amount),
      txnDate: paidAt,
      paymentMethod: options.paymentMethod ?? "BANK_TRANSFER",
      reference: existing.accountNo ?? existing.meterNo ?? undefined,
      description: `Electricity — ${periodLabel(existing.periodMonth, existing.periodYear)}${existing.vendor ? ` (${existing.vendor})` : ""}`,
      status: "POSTED",
      createdById: options.createdById ?? undefined,
    });
    financeTransactionId = txn.id;
  }

  return prisma.electricityBill.update({
    where: { id },
    data: {
      status: "PAID",
      paidAt,
      financeTransactionId,
    },
  });
}

export async function cancelElectricityBillRecord(id: string) {
  const existing = await prisma.electricityBill.findUnique({ where: { id } });
  if (!existing) throw new Error("Electricity bill not found");
  if (existing.status === "PAID") throw new Error("Paid bills cannot be cancelled — they remain in history");
  if (existing.status === "CANCELLED") throw new Error("Bill is already cancelled");

  return prisma.electricityBill.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
}

export async function refreshOverdueElectricityBills(referenceDate = new Date()) {
  const today = startOfDay(referenceDate);
  await prisma.electricityBill.updateMany({
    where: {
      status: "PENDING",
      dueDate: { lt: today },
    },
    data: { status: "OVERDUE" },
  });
}

export async function updateElectricityBillScan(
  id: string,
  scan: { scanFileName: string; scanFilePath: string; scanMimeType: string }
) {
  const existing = await prisma.electricityBill.findUnique({ where: { id } });
  if (!existing) throw new Error("Electricity bill not found");
  if (existing.status === "CANCELLED") throw new Error("Cancelled bills cannot be updated");

  return prisma.electricityBill.update({
    where: { id },
    data: scan,
  });
}

export async function getElectricityBill(id: string) {
  await refreshOverdueElectricityBills();
  return prisma.electricityBill.findUnique({
    where: { id },
    include: {
      createdBy: { select: { name: true } },
      financeTransaction: { select: { id: true, txnNumber: true, status: true } },
    },
  });
}
