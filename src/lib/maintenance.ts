import { prisma } from "@/lib/db";
import { createFinanceTransaction } from "@/lib/finance";
import { canManageMaintenance as canManageMaintenanceRole } from "@/lib/rbac";
import type {
  MaintenanceWorkStatus,
  PaymentMethod,
  PaymentStatus,
  Role,
} from "@/generated/prisma/client";
import { endOfDay, startOfDay } from "date-fns";

export const MAINTENANCE_TYPE_SUGGESTIONS = [
  "ELECTRICAL",
  "PLUMBING",
  "CIVIL",
  "ROADS",
  "STREET_LIGHTS",
  "PARK",
  "MOSQUE",
  "BUILDING",
  "GENERATOR",
  "OTHER",
] as const;

export const MAINTENANCE_STATUSES: MaintenanceWorkStatus[] = [
  "REPORTED",
  "IN_PROGRESS",
  "COMPLETED",
  "CANCELLED",
];

export const MAINTENANCE_PAYMENT_STATUSES: PaymentStatus[] = [
  "PENDING",
  "PAID",
  "PARTIAL",
  "OVERDUE",
  "UNPAID",
];

export function canManageMaintenance(role: Role) {
  return canManageMaintenanceRole(role);
}

export function canViewMaintenance(role: Role) {
  return (
    canManageMaintenance(role) ||
    role === "VIEWER" ||
    role === "SECRETARY" ||
    role === "PRESIDENT"
  );
}

export function normalizeMaintenanceType(value: string) {
  const trimmed = value.trim();
  if (!trimmed) throw new Error("Maintenance type is required");
  return trimmed;
}

type MaintenanceFilters = {
  from?: Date;
  to?: Date;
  workType?: string;
  status?: MaintenanceWorkStatus;
  paymentStatus?: PaymentStatus;
};

function maintenanceWhere(filters: MaintenanceFilters) {
  return {
    ...(filters.from || filters.to
      ? {
          workDate: {
            ...(filters.from ? { gte: startOfDay(filters.from) } : {}),
            ...(filters.to ? { lte: endOfDay(filters.to) } : {}),
          },
        }
      : {}),
    ...(filters.workType
      ? { workType: { equals: filters.workType, mode: "insensitive" as const } }
      : {}),
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.paymentStatus ? { paymentStatus: filters.paymentStatus } : {}),
  };
}

export async function getMaintenanceSummary(filters: MaintenanceFilters = {}) {
  const where = maintenanceWhere(filters);
  const activeWhere = { ...where, status: { not: "CANCELLED" as const } };

  const [totals, byType, works] = await Promise.all([
    prisma.maintenanceWork.aggregate({
      where: activeWhere,
      _sum: { cost: true },
      _count: true,
    }),
    prisma.maintenanceWork.groupBy({
      by: ["workType"],
      where: activeWhere,
      _sum: { cost: true },
      _count: true,
      orderBy: { _sum: { cost: "desc" } },
    }),
    prisma.maintenanceWork.findMany({
      where,
      include: {
        employee: { select: { id: true, name: true, employeeCode: true } },
        createdBy: { select: { name: true } },
        financeTransaction: { select: { id: true, txnNumber: true } },
      },
      orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
      take: 200,
    }),
  ]);

  return {
    totalCost: Number(totals._sum.cost ?? 0),
    workCount: totals._count,
    byType: byType.map((row) => ({
      workType: row.workType,
      cost: Number(row._sum.cost ?? 0),
      count: row._count,
    })),
    works,
  };
}

type CreateMaintenanceWorkInput = {
  workDate: Date;
  workType: string;
  description: string;
  location?: string | null;
  contractorName?: string | null;
  employeeId?: string | null;
  cost: number;
  status?: MaintenanceWorkStatus;
  paymentStatus?: PaymentStatus;
  remarks?: string | null;
  scanFileName?: string | null;
  scanFilePath?: string | null;
  scanMimeType?: string | null;
  postToFinance?: boolean;
  paymentMethod?: PaymentMethod;
  createdById?: string | null;
};

export async function createMaintenanceWorkRecord(input: CreateMaintenanceWorkInput) {
  let financeTransactionId: string | undefined;

  if (input.postToFinance && (input.paymentStatus ?? "PENDING") === "PAID") {
    const category = await prisma.financeCategory.findUnique({ where: { code: "EXP_REPAIR" } });
    if (!category) throw new Error("Finance category EXP_REPAIR is not configured");

    const txn = await createFinanceTransaction({
      categoryId: category.id,
      amount: input.cost,
      txnDate: input.workDate,
      paymentMethod: input.paymentMethod ?? "CASH",
      reference: input.contractorName ?? undefined,
      description: `Maintenance — ${input.workType}: ${input.description.slice(0, 80)}`,
      status: "POSTED",
      createdById: input.createdById ?? undefined,
    });
    financeTransactionId = txn.id;
  }

  return prisma.maintenanceWork.create({
    data: {
      workDate: input.workDate,
      workType: normalizeMaintenanceType(input.workType),
      description: input.description,
      location: input.location ?? undefined,
      contractorName: input.contractorName ?? undefined,
      employeeId: input.employeeId ?? undefined,
      cost: input.cost,
      status: input.status ?? "REPORTED",
      paymentStatus: input.paymentStatus ?? "PENDING",
      remarks: input.remarks ?? undefined,
      scanFileName: input.scanFileName ?? undefined,
      scanFilePath: input.scanFilePath ?? undefined,
      scanMimeType: input.scanMimeType ?? undefined,
      financeTransactionId,
      createdById: input.createdById ?? undefined,
    },
  });
}

type UpdateMaintenanceWorkInput = {
  id: string;
  workDate: Date;
  workType: string;
  description: string;
  location?: string | null;
  contractorName?: string | null;
  employeeId?: string | null;
  cost: number;
  status: MaintenanceWorkStatus;
  paymentStatus: PaymentStatus;
  remarks?: string | null;
  scanFileName?: string | null;
  scanFilePath?: string | null;
  scanMimeType?: string | null;
};

export async function updateMaintenanceWorkRecord(input: UpdateMaintenanceWorkInput) {
  const existing = await prisma.maintenanceWork.findUnique({ where: { id: input.id } });
  if (!existing) throw new Error("Maintenance record not found");
  if (existing.status === "CANCELLED") throw new Error("Cancelled maintenance records cannot be edited");

  return prisma.maintenanceWork.update({
    where: { id: input.id },
    data: {
      workDate: input.workDate,
      workType: normalizeMaintenanceType(input.workType),
      description: input.description,
      location: input.location ?? undefined,
      contractorName: input.contractorName ?? undefined,
      employeeId: input.employeeId ?? undefined,
      cost: input.cost,
      status: input.status,
      paymentStatus: input.paymentStatus,
      remarks: input.remarks ?? undefined,
      scanFileName: input.scanFileName ?? undefined,
      scanFilePath: input.scanFilePath ?? undefined,
      scanMimeType: input.scanMimeType ?? undefined,
    },
  });
}

export async function cancelMaintenanceWorkRecord(id: string) {
  const existing = await prisma.maintenanceWork.findUnique({ where: { id } });
  if (!existing) throw new Error("Maintenance record not found");
  if (existing.status === "CANCELLED") throw new Error("Record is already cancelled");

  return prisma.maintenanceWork.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
}

export async function postMaintenanceWorkToFinance(
  id: string,
  options?: { paymentMethod?: PaymentMethod; createdById?: string | null }
) {
  const existing = await prisma.maintenanceWork.findUnique({ where: { id } });
  if (!existing) throw new Error("Maintenance record not found");
  if (existing.status === "CANCELLED") throw new Error("Cancelled records cannot be posted");
  if (existing.financeTransactionId) throw new Error("Already linked to finance ledger");

  const category = await prisma.financeCategory.findUnique({ where: { code: "EXP_REPAIR" } });
  if (!category) throw new Error("Finance category EXP_REPAIR is not configured");

  const txn = await createFinanceTransaction({
    categoryId: category.id,
    amount: Number(existing.cost),
    txnDate: existing.workDate,
    paymentMethod: options?.paymentMethod ?? "CASH",
    reference: existing.contractorName ?? undefined,
    description: `Maintenance — ${existing.workType}: ${existing.description.slice(0, 80)}`,
    status: "POSTED",
    createdById: options?.createdById ?? undefined,
  });

  return prisma.maintenanceWork.update({
    where: { id },
    data: { financeTransactionId: txn.id },
    include: { financeTransaction: { select: { id: true, txnNumber: true } } },
  });
}

export async function updateMaintenanceWorkScan(
  id: string,
  scan: { scanFileName: string; scanFilePath: string; scanMimeType: string }
) {
  const existing = await prisma.maintenanceWork.findUnique({ where: { id } });
  if (!existing) throw new Error("Maintenance record not found");
  if (existing.status === "CANCELLED") throw new Error("Cancelled records cannot be updated");

  return prisma.maintenanceWork.update({
    where: { id },
    data: scan,
  });
}

export async function getMaintenanceWork(id: string) {
  return prisma.maintenanceWork.findUnique({
    where: { id },
    include: {
      employee: { select: { id: true, name: true, employeeCode: true } },
      createdBy: { select: { name: true } },
      financeTransaction: { select: { id: true, txnNumber: true, status: true } },
    },
  });
}
