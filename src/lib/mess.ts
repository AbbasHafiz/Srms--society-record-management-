import { prisma } from "@/lib/db";
import { createFinanceTransaction } from "@/lib/finance";
import type { MealType, MessMealStatus, PaymentMethod } from "@/generated/prisma/client";
import { endOfDay, startOfDay } from "date-fns";

export { MEAL_TYPE_OPTIONS } from "@/lib/mess-shared";

type MessSummaryFilters = {
  from: Date;
  to: Date;
  mealType?: MealType;
  status?: MessMealStatus;
};

function messWhere(filters: MessSummaryFilters) {
  return {
    mealDate: { gte: startOfDay(filters.from), lte: endOfDay(filters.to) },
    ...(filters.mealType ? { mealType: filters.mealType } : {}),
    status: filters.status ?? "ACTIVE",
  };
}

export async function getMessSpendingSummary(filters: MessSummaryFilters) {
  const where = messWhere(filters);

  const [totals, byType, meals] = await Promise.all([
    prisma.messMeal.aggregate({
      where,
      _sum: { amount: true, headcount: true },
      _count: true,
    }),
    prisma.messMeal.groupBy({
      by: ["mealType"],
      where,
      _sum: { amount: true, headcount: true },
      _count: true,
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.messMeal.findMany({
      where,
      orderBy: [{ mealDate: "desc" }, { mealType: "asc" }],
      take: 100,
    }),
  ]);

  return {
    totalAmount: Number(totals._sum.amount ?? 0),
    totalHeadcount: Number(totals._sum.headcount ?? 0),
    mealCount: totals._count,
    byType: byType.map((row) => ({
      mealType: row.mealType,
      amount: Number(row._sum.amount ?? 0),
      headcount: Number(row._sum.headcount ?? 0),
      count: row._count,
    })),
    meals,
  };
}

type CreateMessMealInput = {
  mealDate: Date;
  mealType: MealType;
  otherDetail?: string | null;
  headcount: number;
  amount: number;
  vendor?: string | null;
  remarks?: string | null;
  postToFinance?: boolean;
  paymentMethod?: PaymentMethod;
  createdById?: string | null;
};

export async function createMessMealRecord(input: CreateMessMealInput) {
  let financeTransactionId: string | undefined;

  if (input.postToFinance) {
    const category = await prisma.financeCategory.findUnique({ where: { code: "EXP_MESS" } });
    if (!category) throw new Error("Finance category EXP_MESS is not configured");

    const txn = await createFinanceTransaction({
      categoryId: category.id,
      amount: input.amount,
      txnDate: input.mealDate,
      paymentMethod: input.paymentMethod ?? "CASH",
      reference: input.vendor ?? undefined,
      description: `Staff mess — ${input.mealType.toLowerCase()} (${input.headcount} staff)`,
      status: "POSTED",
      createdById: input.createdById ?? undefined,
    });
    financeTransactionId = txn.id;
  }

  return prisma.messMeal.create({
    data: {
      mealDate: input.mealDate,
      mealType: input.mealType,
      otherDetail: input.otherDetail ?? undefined,
      headcount: input.headcount,
      amount: input.amount,
      vendor: input.vendor ?? undefined,
      remarks: input.remarks ?? undefined,
      financeTransactionId,
      createdById: input.createdById ?? undefined,
    },
  });
}

type UpdateMessMealInput = {
  id: string;
  mealDate: Date;
  mealType: MealType;
  otherDetail?: string | null;
  headcount: number;
  amount: number;
  vendor?: string | null;
  remarks?: string | null;
};

export async function updateMessMealRecord(input: UpdateMessMealInput) {
  const existing = await prisma.messMeal.findUnique({ where: { id: input.id } });
  if (!existing) throw new Error("Mess record not found");
  if (existing.status === "CANCELLED") throw new Error("Cancelled mess records cannot be edited");

  return prisma.messMeal.update({
    where: { id: input.id },
    data: {
      mealDate: input.mealDate,
      mealType: input.mealType,
      otherDetail: input.otherDetail ?? undefined,
      headcount: input.headcount,
      amount: input.amount,
      vendor: input.vendor ?? undefined,
      remarks: input.remarks ?? undefined,
    },
  });
}

export async function cancelMessMealRecord(id: string) {
  const existing = await prisma.messMeal.findUnique({ where: { id } });
  if (!existing) throw new Error("Mess record not found");
  if (existing.status === "CANCELLED") throw new Error("Record is already cancelled");

  return prisma.messMeal.update({
    where: { id },
    data: { status: "CANCELLED" },
  });
}
