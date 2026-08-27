"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import type { Role } from "@/generated/prisma/client";
import {
  createFinanceTransaction,
  postFinanceTransaction,
  postRevenueFromPayment,
  voidFinanceTransaction,
} from "@/lib/finance";
import type {
  FinanceCategoryType,
  FinanceTransactionStatus,
  PaymentMethod,
} from "@/generated/prisma/client";
import { PAYMENT_METHODS } from "@/lib/finance-constants";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  redirectWithError,
  getErrorMessage,
  isNextNavigationError,
} from "@/lib/action-result";

function requireFinanceManage(role: Role) {
  if (!hasPermission(role, "manage_finance")) {
    throw new Error("You do not have permission to manage finance records");
  }
}

function parseTxnForm(formData: FormData) {
  const categoryId = String(formData.get("categoryId") || "").trim();
  const amountRaw = String(formData.get("amount") || "").trim();
  const txnDateRaw = String(formData.get("txnDate") || "").trim();
  const paymentMethod = String(formData.get("paymentMethod") || "CASH") as PaymentMethod;
  const postNow = formData.get("postNow") === "on";

  if (!categoryId) throw new Error("Category is required");
  const amount = Number(amountRaw);
  if (!amount || amount <= 0) throw new Error("Amount must be greater than zero");
  if (!PAYMENT_METHODS.includes(paymentMethod)) throw new Error("Invalid payment method");

  const txnDate = txnDateRaw ? new Date(txnDateRaw) : new Date();

  return {
    categoryId,
    amount,
    txnDate,
    paymentMethod,
    reference: String(formData.get("reference") || "").trim() || null,
    plotId: String(formData.get("plotId") || "").trim() || null,
    ownershipId: String(formData.get("ownershipId") || "").trim() || null,
    employeeId: String(formData.get("employeeId") || "").trim() || null,
    description: String(formData.get("description") || "").trim() || null,
    status: (postNow ? "POSTED" : "DRAFT") as FinanceTransactionStatus,
  };
}

export async function createFinanceTxnAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireFinanceManage(session.user.role);

  const input = parseTxnForm(formData);
  const txn = await createFinanceTransaction({
    ...input,
    createdById: session.user.id,
  });

  revalidatePath("/finance");
  redirect(`/finance?tab=${txn.type === "REVENUE" ? "revenue" : "expenses"}`);
}

export async function postFinanceTxnAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireFinanceManage(session.user.role);

  const txnId = String(formData.get("txnId") || "").trim();
  if (!txnId) throw new Error("Transaction ID required");

  await postFinanceTransaction(txnId, session.user.id);
  revalidatePath("/finance");
  revalidatePath("/payments");
}

export async function voidFinanceTxnAction(formData: FormData) {
  const returnPath = "/finance";

  try {
    const session = await auth();
    if (!session?.user) redirectWithError(returnPath, "Unauthorized");
    requireFinanceManage(session.user.role);

    const txnId = String(formData.get("txnId") || "").trim();
    const reason = String(formData.get("reason") || "").trim();
    if (!txnId) redirectWithError(returnPath, "Transaction ID required");
    if (!reason) redirectWithError(returnPath, "Void reason is required");

    const txn = await prisma.financeTransaction.findUnique({ where: { id: txnId } });
    if (!txn) redirectWithError(returnPath, "Transaction not found");
    if (txn.status === "VOID") redirectWithError(returnPath, "Transaction is already void");

    await voidFinanceTransaction(txnId, session.user.id, reason);
    revalidatePath("/finance");
    redirect("/finance?voided=1");
  } catch (err) {
    if (isNextNavigationError(err)) throw err;
    redirectWithError(returnPath, getErrorMessage(err));
  }
}

export async function postPaymentToLedgerAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireFinanceManage(session.user.role);

  const paymentId = String(formData.get("paymentId") || "").trim();
  if (!paymentId) throw new Error("Payment ID required");

  await postRevenueFromPayment(paymentId, session.user.id);
  revalidatePath("/finance");
  revalidatePath("/payments");
}

export async function createFinanceCategoryAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireFinanceManage(session.user.role);

  const code = String(formData.get("code") || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_");
  const name = String(formData.get("name") || "").trim();
  const type = String(formData.get("type") || "") as FinanceCategoryType;
  const description = String(formData.get("description") || "").trim() || null;

  if (!code || !name) throw new Error("Code and name are required");
  if (type !== "REVENUE" && type !== "EXPENSE") throw new Error("Invalid category type");

  const existing = await prisma.financeCategory.findUnique({ where: { code } });
  if (existing) throw new Error("Category code already exists");

  const maxSort = await prisma.financeCategory.aggregate({
    where: { type },
    _max: { sortOrder: true },
  });

  await prisma.financeCategory.create({
    data: {
      code,
      name,
      type,
      description,
      isSystem: false,
      isActive: true,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 10,
    },
  });

  revalidatePath("/finance/categories");
  revalidatePath("/finance");
}

export async function toggleFinanceCategoryAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  requireFinanceManage(session.user.role);

  const categoryId = String(formData.get("categoryId") || "").trim();
  if (!categoryId) throw new Error("Category ID required");

  const category = await prisma.financeCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new Error("Category not found");
  if (category.isSystem) throw new Error("System categories cannot be deactivated");

  await prisma.financeCategory.update({
    where: { id: categoryId },
    data: { isActive: !category.isActive },
  });

  revalidatePath("/finance/categories");
  revalidatePath("/finance");
}
