"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { prisma } from "@/lib/db";
import { canRecordPlotDues, canViewPlotDues, recordPlotDuesEntry } from "@/lib/plot-dues";
import type { PlotDuesEntryKind } from "@/generated/prisma/client";

export async function lookupPlotStatusAction(formData: FormData) {
  const membership = String(formData.get("membership") || "").trim();
  const cnic = String(formData.get("cnic") || "").trim();
  const q = String(formData.get("q") || "").trim();
  const params = new URLSearchParams();
  if (membership) params.set("membership", membership);
  if (cnic) params.set("cnic", cnic);
  if (q) params.set("q", q);
  redirect(`/plot-status${params.toString() ? `?${params.toString()}` : ""}`);
}

export async function addPlotDuesEntryAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canViewPlotDues(session.user.role) || !canRecordPlotDues(session.user.role)) {
    throw new Error("You do not have permission to record plot dues");
  }

  const plotId = String(formData.get("plotId") || "").trim();
  const headId = String(formData.get("headId") || "").trim();
  const kind = String(formData.get("kind") || "").trim() as PlotDuesEntryKind;
  const amount = Number(formData.get("amount"));
  const asOf = String(formData.get("asOfDate") || "").trim();
  const due = String(formData.get("dueDate") || "").trim();
  const remarks = String(formData.get("remarks") || "").trim() || null;

  if (!plotId || !headId || (kind !== "DEPOSITED" && kind !== "OUTSTANDING")) {
    throw new Error("Head, kind, and plot are required");
  }

  const entry = await recordPlotDuesEntry({
    plotId,
    headId,
    kind,
    amount,
    asOfDate: asOf ? new Date(asOf) : null,
    dueDate: due ? new Date(due) : null,
    remarks,
    createdById: session.user.id,
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "PLOT_DUES_ENTRY_RECORDED",
    module: "plot-status",
    plotId,
    recordId: entry.id,
    newValue: { headId, kind, amount, remarks },
  });

  revalidatePath("/plot-status");
  revalidatePath(`/plot-status/print/${plotId}`);
  revalidatePath(`/plots/${plotId}`);
}

export async function createPlotDuesHeadAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canRecordPlotDues(session.user.role)) {
    throw new Error("You do not have permission to configure dues heads");
  }

  const code = String(formData.get("code") || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, "_");
  const name = String(formData.get("name") || "").trim();
  const sortOrder = Number(formData.get("sortOrder") || 200);
  const showUptoDate = formData.get("showUptoDate") === "on";

  if (!code || !name) throw new Error("Code and name are required");

  await prisma.plotDuesHead.upsert({
    where: { code },
    create: { code, name, sortOrder: Number.isFinite(sortOrder) ? sortOrder : 200, showUptoDate },
    update: { name, sortOrder: Number.isFinite(sortOrder) ? sortOrder : 200, showUptoDate, isActive: true },
  });

  revalidatePath("/settings");
  revalidatePath("/plot-status");
}

export async function updatePlotStatusSettingsAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canRecordPlotDues(session.user.role)) {
    throw new Error("You do not have permission to update society dues settings");
  }

  const ntn = String(formData.get("society_ntn") || "").trim();
  const dueDays = String(formData.get("dues_slip_due_days") || "").trim();
  const taxFee = String(formData.get("dues_slip_taxation_officer_fee") || "").trim();

  await prisma.systemSetting.upsert({
    where: { key: "society_ntn" },
    create: { key: "society_ntn", value: ntn, label: "Society NTN" },
    update: { value: ntn, label: "Society NTN" },
  });
  if (dueDays) {
    await prisma.systemSetting.upsert({
      where: { key: "dues_slip_due_days" },
      create: { key: "dues_slip_due_days", value: dueDays, label: "Plot dues slip due days from issue" },
      update: { value: dueDays },
    });
  }
  if (taxFee) {
    await prisma.systemSetting.upsert({
      where: { key: "dues_slip_taxation_officer_fee" },
      create: {
        key: "dues_slip_taxation_officer_fee",
        value: taxFee,
        label: "Default taxation officer fee (PKR)",
      },
      update: { value: taxFee },
    });
  }

  revalidatePath("/settings");
  revalidatePath("/plot-status");
}
