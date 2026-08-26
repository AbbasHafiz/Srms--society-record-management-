"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import {
  canManageMaintenance,
  cancelMaintenanceWorkRecord,
  createMaintenanceWorkRecord,
  postMaintenanceWorkToFinance,
  updateMaintenanceWorkRecord,
  updateMaintenanceWorkScan,
} from "@/lib/maintenance";
import { resolveCustomWorkType } from "@/lib/other-specify";
import { saveUploadedFile } from "@/lib/uploads";
import type { MaintenanceWorkStatus, PaymentMethod, PaymentStatus } from "@/generated/prisma/client";

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

function parseMaintenanceForm(formData: FormData) {
  const workDate = parseDate(String(formData.get("workDate") || ""));
  const workType = resolveCustomWorkType(formData);
  const description = String(formData.get("description") || "").trim();
  const cost = Number(formData.get("cost"));
  const status = String(formData.get("status") || "REPORTED") as MaintenanceWorkStatus;
  const paymentStatus = String(formData.get("paymentStatus") || "PENDING") as PaymentStatus;

  if (!workType) throw new Error("Maintenance type is required");
  if (!description) throw new Error("Description is required");
  if (!Number.isFinite(cost) || cost < 0) throw new Error("Cost must be zero or greater");

  return {
    workDate,
    workType,
    description,
    location: String(formData.get("location") || "").trim() || null,
    contractorName: String(formData.get("contractorName") || "").trim() || null,
    employeeId: String(formData.get("employeeId") || "").trim() || null,
    cost,
    status,
    paymentStatus,
    remarks: String(formData.get("remarks") || "").trim() || null,
  };
}

export async function createMaintenanceWork(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageMaintenance(session.user.role)) throw new Error("Forbidden");

  const input = parseMaintenanceForm(formData);
  const scan = await parseScan(formData);
  const postToFinance = formData.get("postToFinance") === "on";
  const paymentMethod = String(formData.get("paymentMethod") || "CASH") as PaymentMethod;

  const work = await createMaintenanceWorkRecord({
    ...input,
    ...scan,
    postToFinance,
    paymentMethod,
    createdById: session.user.id,
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "MAINTENANCE_WORK_CREATED",
    module: "maintenance",
    recordId: work.id,
    newValue: { workType: input.workType, cost: input.cost, status: input.status },
  });

  revalidatePath("/maintenance");
  redirect(`/maintenance/${work.id}`);
}

export async function updateMaintenanceWork(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageMaintenance(session.user.role)) throw new Error("Forbidden");

  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Record ID required");

  const input = parseMaintenanceForm(formData);
  const scan = await parseScan(formData);
  const work = await updateMaintenanceWorkRecord({ id, ...input, ...scan });

  await writeAuditLog({
    userId: session.user.id,
    action: "MAINTENANCE_WORK_UPDATED",
    module: "maintenance",
    recordId: work.id,
    newValue: { workType: input.workType, cost: input.cost, status: input.status },
  });

  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${id}`);
  redirect(`/maintenance/${id}`);
}

export async function cancelMaintenanceWork(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageMaintenance(session.user.role)) throw new Error("Forbidden");

  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Record ID required");

  const work = await cancelMaintenanceWorkRecord(id);

  await writeAuditLog({
    userId: session.user.id,
    action: "MAINTENANCE_WORK_CANCELLED",
    module: "maintenance",
    recordId: work.id,
    newValue: { status: "CANCELLED" },
  });

  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${id}`);
}

export async function postMaintenanceToFinanceAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageMaintenance(session.user.role)) throw new Error("Forbidden");

  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Record ID required");
  const paymentMethod = String(formData.get("paymentMethod") || "CASH") as PaymentMethod;

  const work = await postMaintenanceWorkToFinance(id, {
    paymentMethod,
    createdById: session.user.id,
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "MAINTENANCE_POSTED_TO_FINANCE",
    module: "maintenance",
    recordId: work.id,
    newValue: { financeTransactionId: work.financeTransactionId },
  });

  revalidatePath("/maintenance");
  revalidatePath(`/maintenance/${id}`);
  revalidatePath("/finance");
}

export async function uploadMaintenanceScan(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageMaintenance(session.user.role)) throw new Error("Forbidden");

  const id = String(formData.get("id") || "").trim();
  if (!id) throw new Error("Record ID required");

  const scan = await parseScan(formData);
  if (!scan.scanFilePath || !scan.scanFileName || !scan.scanMimeType) {
    throw new Error("Scan file is required");
  }

  await updateMaintenanceWorkScan(id, {
    scanFileName: scan.scanFileName,
    scanFilePath: scan.scanFilePath,
    scanMimeType: scan.scanMimeType,
  });

  revalidatePath(`/maintenance/${id}`);
}
