"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { saveUploadedFile } from "@/lib/uploads";
import { createDocumentWithUpload } from "@/lib/documents";
import {
  generateMonthlyOfficeRentCharges,
  markOfficeRentChargePaid,
  isSocietyLandOffice,
} from "@/lib/offices";
import { writeAuditLog } from "@/lib/audit";
import type {
  OfficePremisesType,
  OfficeRentFrequency,
  RegisteredOfficeStatus,
} from "@/generated/prisma/client";

function canManageOffices(role: string) {
  return hasPermission(role as never, "create") || hasPermission(role as never, "edit");
}

function parseDate(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseDecimal(value: FormDataEntryValue | null) {
  if (!value || typeof value !== "string" || !value.trim()) return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

export async function createRegisteredOffice(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageOffices(session.user.role)) throw new Error("Permission denied");

  const premisesType = formData.get("premisesType") as OfficePremisesType;
  const officeName = String(formData.get("officeName") || "").trim();
  const ownerName = String(formData.get("ownerName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();

  if (!officeName || !ownerName || !phone) {
    throw new Error("Office name, owner name, and phone are required");
  }
  if (!["SOCIETY_LAND", "PRIVATE"].includes(premisesType)) {
    throw new Error("Invalid premises type");
  }

  const societyLand = isSocietyLandOffice(premisesType);
  const rentAmount = parseDecimal(formData.get("rentAmount"));
  const plotId = String(formData.get("plotId") || "").trim() || null;

  if (societyLand && (!rentAmount || rentAmount <= 0)) {
    throw new Error("Rent amount is required for society-land offices");
  }

  const letterhead = formData.get("letterhead");

  const office = await prisma.registeredOffice.create({
    data: {
      officeName,
      ownerName,
      phone,
      email: String(formData.get("email") || "").trim() || null,
      address: String(formData.get("address") || "").trim() || null,
      premisesType,
      plotId: plotId || undefined,
      rentAmount: societyLand ? rentAmount : null,
      rentFrequency: societyLand ? ("MONTHLY" as OfficeRentFrequency) : null,
      rentStartDate: societyLand ? parseDate(formData.get("rentStartDate")) : null,
      rentStatus: societyLand ? "CURRENT" : "NOT_APPLICABLE",
      licenseNumber: !societyLand ? String(formData.get("licenseNumber") || "").trim() || null : null,
      registrationDate: !societyLand ? parseDate(formData.get("registrationDate")) : null,
      expiryDate: !societyLand ? parseDate(formData.get("expiryDate")) : null,
      status: (formData.get("status") as RegisteredOfficeStatus) || "ACTIVE",
      remarks: String(formData.get("remarks") || "").trim() || null,
    },
  });

  if (letterhead instanceof File && letterhead.size > 0) {
    if (office.plotId) {
      await createDocumentWithUpload({
        plotId: office.plotId,
        registeredOfficeId: office.id,
        documentType: "DEALER_LETTERHEAD",
        title: `${office.officeName} Letterhead`,
        uploadedById: session.user.id,
        file: letterhead,
      });
    } else {
      const saved = await saveUploadedFile(letterhead);
      await prisma.registeredOffice.update({
        where: { id: office.id },
        data: { letterheadFilePath: saved.relativePath },
      });
    }
  }

  await writeAuditLog({
    userId: session.user.id,
    action: "REGISTERED_OFFICE_CREATED",
    module: "offices",
    recordId: office.id,
    plotId: office.plotId ?? undefined,
    newValue: { officeName, premisesType },
  });

  revalidatePath("/offices");
  redirect(`/offices/${office.id}`);
}

export async function updateRegisteredOffice(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageOffices(session.user.role)) throw new Error("Permission denied");

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Office ID required");

  const existing = await prisma.registeredOffice.findUnique({ where: { id } });
  if (!existing) throw new Error("Office not found");

  const officeName = String(formData.get("officeName") || "").trim();
  const ownerName = String(formData.get("ownerName") || "").trim();
  const phone = String(formData.get("phone") || "").trim();
  const societyLand = isSocietyLandOffice(existing.premisesType);
  const rentAmount = parseDecimal(formData.get("rentAmount"));
  const plotId = String(formData.get("plotId") || "").trim() || null;

  await prisma.registeredOffice.update({
    where: { id },
    data: {
      officeName,
      ownerName,
      phone,
      email: String(formData.get("email") || "").trim() || null,
      address: String(formData.get("address") || "").trim() || null,
      plotId: plotId || undefined,
      ...(societyLand
        ? {
            rentAmount: rentAmount ?? existing.rentAmount,
            rentStartDate: parseDate(formData.get("rentStartDate")) ?? existing.rentStartDate,
            rentStatus: existing.rentStatus === "NOT_APPLICABLE" ? "CURRENT" : existing.rentStatus,
          }
        : {
            licenseNumber: String(formData.get("licenseNumber") || "").trim() || null,
            registrationDate: parseDate(formData.get("registrationDate")),
            expiryDate: parseDate(formData.get("expiryDate")),
            status: (formData.get("status") as RegisteredOfficeStatus) || existing.status,
          }),
      remarks: String(formData.get("remarks") || "").trim() || null,
    },
  });

  revalidatePath("/offices");
  revalidatePath(`/offices/${id}`);
  revalidatePath(`/offices/${id}/edit`);
  redirect(`/offices/${id}`);
}

export async function deactivateRegisteredOffice(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageOffices(session.user.role)) throw new Error("Permission denied");

  const id = String(formData.get("id") || "");
  const reason = String(formData.get("reason") || "").trim() || null;
  if (!id) throw new Error("Office ID required");

  const existing = await prisma.registeredOffice.findUnique({ where: { id } });
  if (!existing) throw new Error("Office not found");
  if (existing.status === "SUSPENDED") throw new Error("Office already deactivated");

  const remarks = reason
    ? [existing.remarks, `Deactivated: ${reason}`].filter(Boolean).join("\n")
    : existing.remarks;

  await prisma.registeredOffice.update({
    where: { id },
    data: { status: "SUSPENDED", remarks },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "REGISTERED_OFFICE_DEACTIVATED",
    module: "offices",
    recordId: id,
    plotId: existing.plotId ?? undefined,
    oldValue: { status: existing.status },
    newValue: { status: "SUSPENDED" },
    reason,
  });

  revalidatePath("/offices");
  revalidatePath(`/offices/${id}`);
  redirect(`/offices/${id}`);
}

export async function reactivateRegisteredOffice(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageOffices(session.user.role)) throw new Error("Permission denied");

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Office ID required");

  const existing = await prisma.registeredOffice.findUnique({ where: { id } });
  if (!existing) throw new Error("Office not found");
  if (existing.status === "ACTIVE") throw new Error("Office is already active");

  await prisma.registeredOffice.update({
    where: { id },
    data: { status: "ACTIVE" },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "REGISTERED_OFFICE_REACTIVATED",
    module: "offices",
    recordId: id,
    plotId: existing.plotId ?? undefined,
    oldValue: { status: existing.status },
    newValue: { status: "ACTIVE" },
  });

  revalidatePath("/offices");
  revalidatePath(`/offices/${id}`);
  redirect(`/offices/${id}`);
}

export async function uploadOfficeLetterhead(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "upload_document")) throw new Error("Permission denied");

  const officeId = String(formData.get("officeId") || "");
  const file = formData.get("file") as File | null;
  if (!officeId || !file?.size) throw new Error("Office and file are required");

  const office = await prisma.registeredOffice.findUnique({ where: { id: officeId } });
  if (!office) throw new Error("Office not found");

  if (office.plotId) {
    await createDocumentWithUpload({
      plotId: office.plotId,
      registeredOfficeId: officeId,
      documentType: "DEALER_LETTERHEAD",
      title: `${office.officeName} Letterhead`,
      uploadedById: session.user.id,
      file,
    });
  } else {
    const saved = await saveUploadedFile(file);
    await prisma.registeredOffice.update({
      where: { id: officeId },
      data: { letterheadFilePath: saved.relativePath },
    });
  }

  revalidatePath(`/offices/${officeId}`);
}

export async function generateOfficeRentChargesAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "verify_payment")) throw new Error("Permission denied");

  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  if (!year || !month || month < 1 || month > 12) throw new Error("Valid year and month required");

  await generateMonthlyOfficeRentCharges(year, month, session.user.id);
  revalidatePath("/offices");
  redirect("/offices");
}

export async function markOfficeRentPaidAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "verify_payment")) throw new Error("Permission denied");

  const chargeId = String(formData.get("chargeId") || "");
  if (!chargeId) throw new Error("Charge ID required");

  const charge = await prisma.officeRentCharge.findUnique({
    where: { id: chargeId },
    select: { registeredOfficeId: true },
  });

  await markOfficeRentChargePaid(chargeId, session.user.id);
  revalidatePath("/offices");
  if (charge) revalidatePath(`/offices/${charge.registeredOfficeId}`);
  redirect(charge ? `/offices/${charge.registeredOfficeId}` : "/offices");
}

export async function assignRegisteredOfficeToOpenFile(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canManageOffices(session.user.role)) throw new Error("Permission denied");

  const openFileId = String(formData.get("openFileId") || "");
  const registeredOfficeId = String(formData.get("registeredOfficeId") || "").trim() || null;

  const openFile = await prisma.openFile.findUnique({ where: { id: openFileId } });
  if (!openFile) throw new Error("Open file not found");

  let dealerName = openFile.dealerName;
  let dealerOffice = openFile.dealerOffice;

  if (registeredOfficeId) {
    const office = await prisma.registeredOffice.findUnique({ where: { id: registeredOfficeId } });
    if (!office) throw new Error("Registered office not found");
    dealerName = office.officeName;
    dealerOffice = office.address ?? office.ownerName;
  }

  await prisma.openFile.update({
    where: { id: openFileId },
    data: {
      registeredOfficeId,
      dealerName,
      dealerOffice,
    },
  });

  revalidatePath(`/open-files/${openFileId}`);
  revalidatePath("/open-files");
}
