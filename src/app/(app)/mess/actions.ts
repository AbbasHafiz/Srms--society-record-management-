"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { canManageMess } from "@/lib/rbac";
import {
  cancelMessMealRecord,
  createMessMealRecord,
  updateMessMealRecord,
} from "@/lib/mess";
import type { MealType, PaymentMethod } from "@/generated/prisma/client";

function parseDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return d;
}

function parseMessForm(formData: FormData) {
  const mealDate = parseDate(String(formData.get("mealDate") || ""));
  const mealType = String(formData.get("mealType") || "LUNCH") as MealType;
  const headcount = Number(formData.get("headcount"));
  const amount = Number(formData.get("amount"));
  const vendor = String(formData.get("vendor") || "").trim() || null;
  const remarks = String(formData.get("remarks") || "").trim() || null;

  if (!Number.isFinite(headcount) || headcount <= 0) throw new Error("Headcount must be greater than zero");
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than zero");

  return { mealDate, mealType, headcount, amount, vendor, remarks };
}

export async function createMessMeal(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageMess(session.user.role)) throw new Error("Forbidden");

  const input = parseMessForm(formData);
  const postToFinance = formData.get("postToFinance") === "on";
  const paymentMethod = String(formData.get("paymentMethod") || "CASH") as PaymentMethod;

  const meal = await createMessMealRecord({
    ...input,
    postToFinance,
    paymentMethod,
    createdById: session.user.id,
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "MESS_MEAL_CREATED",
    module: "mess",
    recordId: meal.id,
    newValue: {
      mealDate: input.mealDate.toISOString(),
      mealType: input.mealType,
      headcount: input.headcount,
      amount: input.amount,
      postToFinance,
    },
  });

  revalidatePath("/mess");
  revalidatePath("/finance");
  redirect(`/mess/${meal.id}`);
}

export async function updateMessMeal(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageMess(session.user.role)) throw new Error("Forbidden");

  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Record ID required");

  const input = parseMessForm(formData);
  const meal = await updateMessMealRecord({ id, ...input });

  await writeAuditLog({
    userId: session.user.id,
    action: "MESS_MEAL_UPDATED",
    module: "mess",
    recordId: meal.id,
    newValue: {
      mealDate: input.mealDate.toISOString(),
      mealType: input.mealType,
      headcount: input.headcount,
      amount: input.amount,
    },
  });

  revalidatePath("/mess");
  revalidatePath(`/mess/${id}`);
  redirect(`/mess/${id}`);
}

export async function cancelMessMeal(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageMess(session.user.role)) throw new Error("Forbidden");

  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Record ID required");

  const meal = await cancelMessMealRecord(id);

  await writeAuditLog({
    userId: session.user.id,
    action: "MESS_MEAL_CANCELLED",
    module: "mess",
    recordId: meal.id,
    oldValue: { status: "ACTIVE" },
    newValue: { status: "CANCELLED" },
  });

  revalidatePath("/mess");
  revalidatePath(`/mess/${id}`);
}
