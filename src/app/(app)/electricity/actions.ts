"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { canManageElectricity } from "@/lib/electricity";
import {
  cancelElectricityBillRecord,
  createElectricityBillRecord,
  markElectricityBillPaid,
  updateElectricityBillRecord,
  updateElectricityBillScan,
} from "@/lib/electricity";
import { saveUploadedFile } from "@/lib/uploads";
import type { PaymentMethod } from "@/generated/prisma/client";

function parseDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return d;
}

async function parseScan(formData: FormData) {
  const scan = formData.get("scan");
  if (!(scan instanceof File) || scan.size === 0) {
    return { scanFileName: null, scanFilePath: null, scanMimeType: null };
  }
  const saved = await saveUploadedFile(scan);
  return {
    scanFileName: saved.storedFileName,
    scanFilePath: saved.relativePath,
    scanMimeType: saved.mimeType,
  };
}

function parseBillForm(formData: FormData) {
  const periodMonth = Number(formData.get("periodMonth"));
  const periodYear = Number(formData.get("periodYear"));
  const unitsRaw = String(formData.get("units") || "").trim();
  const units = unitsRaw ? Number(unitsRaw) : null;
  const amount = Number(formData.get("amount"));
  const dueDate = parseDate(String(formData.get("dueDate") || ""));

  if (!Number.isFinite(periodMonth) || periodMonth < 1 || periodMonth > 12) {
    throw new Error("Valid billing month is required");
  }
  if (!Number.isFinite(periodYear) || periodYear < 2000) {
    throw new Error("Valid billing year is required");
  }
  if (!Number.isFinite(amount) || amount <= 0) throw new Error("Amount must be greater than zero");
  if (units != null && (!Number.isFinite(units) || units < 0)) throw new Error("Invalid units");

  return {
    periodMonth,
    periodYear,
    meterNo: String(formData.get("meterNo") || "").trim() || null,
    accountNo: String(formData.get("accountNo") || "").trim() || null,
    units,
    amount,
    dueDate,
    vendor: String(formData.get("vendor") || "").trim() || null,
    remarks: String(formData.get("remarks") || "").trim() || null,
  };
}

export async function createElectricityBill(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageElectricity(session.user.role)) throw new Error("Forbidden");

  const input = parseBillForm(formData);
  const scan = await parseScan(formData);

  const bill = await createElectricityBillRecord({
    ...input,
    ...scan,
    createdById: session.user.id,
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "ELECTRICITY_BILL_CREATED",
    module: "electricity",
    recordId: bill.id,
    newValue: {
      periodMonth: input.periodMonth,
      periodYear: input.periodYear,
      amount: input.amount,
      vendor: input.vendor,
    },
  });

  revalidatePath("/electricity");
  redirect(`/electricity/${bill.id}`);
}

export async function updateElectricityBill(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageElectricity(session.user.role)) throw new Error("Forbidden");

  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Record ID required");

  const input = parseBillForm(formData);
  const scan = await parseScan(formData);
  const bill = await updateElectricityBillRecord({ id, ...input, ...scan });

  await writeAuditLog({
    userId: session.user.id,
    action: "ELECTRICITY_BILL_UPDATED",
    module: "electricity",
    recordId: bill.id,
    newValue: { amount: input.amount, vendor: input.vendor },
  });

  revalidatePath("/electricity");
  revalidatePath(`/electricity/${id}`);
  redirect(`/electricity/${id}`);
}

export async function markElectricityBillPaidAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageElectricity(session.user.role)) throw new Error("Forbidden");

  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Record ID required");

  const paidAtRaw = String(formData.get("paidAt") || "").trim();
  const paidAt = paidAtRaw ? parseDate(paidAtRaw) : new Date();
  const postToFinance = formData.get("postToFinance") === "on";
  const paymentMethod = String(formData.get("paymentMethod") || "BANK_TRANSFER") as PaymentMethod;

  const bill = await markElectricityBillPaid(id, {
    paidAt,
    postToFinance,
    paymentMethod,
    createdById: session.user.id,
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "ELECTRICITY_BILL_PAID",
    module: "electricity",
    recordId: bill.id,
    newValue: { status: "PAID", postToFinance },
  });

  revalidatePath("/electricity");
  revalidatePath(`/electricity/${id}`);
  revalidatePath("/finance");
}

export async function cancelElectricityBill(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageElectricity(session.user.role)) throw new Error("Forbidden");

  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Record ID required");

  const bill = await cancelElectricityBillRecord(id);

  await writeAuditLog({
    userId: session.user.id,
    action: "ELECTRICITY_BILL_CANCELLED",
    module: "electricity",
    recordId: bill.id,
    newValue: { status: "CANCELLED" },
  });

  revalidatePath("/electricity");
  revalidatePath(`/electricity/${id}`);
}

export async function uploadElectricityBillScan(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageElectricity(session.user.role)) throw new Error("Forbidden");

  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Record ID required");

  const scan = await parseScan(formData);
  if (!scan.scanFilePath || !scan.scanFileName || !scan.scanMimeType) {
    throw new Error("Scan file is required");
  }

  await updateElectricityBillScan(id, {
    scanFileName: scan.scanFileName,
    scanFilePath: scan.scanFilePath,
    scanMimeType: scan.scanMimeType,
  });

  revalidatePath(`/electricity/${id}`);
}
