"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { createDocumentWithUpload } from "@/lib/documents";
import { canApproveNoc, canCreateNocApplication } from "@/lib/noc";
import { nextNocApplicationNumber, nextNocNumber } from "@/lib/numbering";
import { computeNocSlaDue } from "@/lib/sla";
import type {
  ApplicationStatus,
  ConstructionType,
  NocPurpose,
} from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCustomType, requireOtherDetail } from "@/lib/other-specify";

const PURPOSES: NocPurpose[] = ["CONSTRUCTION", "TRANSFER", "GENERAL", "UTILITY_CONNECTION", "OTHER"];
const CONSTRUCTION_TYPES: ConstructionType[] = [
  "HOUSE",
  "BOUNDARY_WALL",
  "EXTENSION",
  "COMMERCIAL_BUILDING",
  "OTHER",
];

async function getActiveNocFee() {
  return prisma.feeConfiguration.findFirst({
    where: { feeType: "NOC", status: "ACTIVE" },
    orderBy: { effectiveFrom: "desc" },
  });
}

export async function createNocApplication(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canCreateNocApplication(session.user.role)) throw new Error("Forbidden");

  const plotId = String(formData.get("plotId") || "");
  const purpose = String(formData.get("purpose") || "GENERAL") as NocPurpose;
  const constructionTypeRaw = String(formData.get("constructionType") || "").trim();
  const applicationNotes = String(formData.get("applicationNotes") || "").trim() || null;
  const purposeOther = requireCustomType(formData, purpose, {
    message: "Please specify the NOC purpose when Other is selected",
  });
  const constructionOther = requireOtherDetail(formData, constructionTypeRaw, {
    message: "Please specify the construction type when Other is selected",
  });
  const acknowledgeMortgage = formData.get("acknowledgeMortgage") === "on";

  if (!plotId) throw new Error("Plot is required");
  if (!PURPOSES.includes(purpose)) throw new Error("Invalid NOC purpose");

  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    include: {
      ownerships: { where: { status: "ACTIVE" }, take: 1 },
      mortgages: { where: { status: "ACTIVE" }, take: 1 },
    },
  });
  if (!plot) throw new Error("Plot not found");

  const owner = plot.ownerships[0];
  if (!owner) throw new Error("No active owner on this plot — cannot apply for NOC");

  if (plot.hasActiveMortgage && purpose === "CONSTRUCTION" && !acknowledgeMortgage) {
    throw new Error("Active mortgage warning must be acknowledged before applying");
  }

  const constructionType =
    purpose === "CONSTRUCTION" && constructionTypeRaw
      ? CONSTRUCTION_TYPES.includes(constructionTypeRaw as ConstructionType)
        ? (constructionTypeRaw as ConstructionType)
        : "HOUSE"
      : null;

  const feeConfig = await getActiveNocFee();
  const applicationNumber = await nextNocApplicationNumber();
  const applicationDate = new Date();
  const slaDueAt = await computeNocSlaDue(applicationDate, purpose);

  const noc = await prisma.noc.create({
    data: {
      plotId,
      ownershipId: owner.id,
      applicationNumber,
      applicationDate,
      slaDueAt,
      applicantName: owner.ownerName,
      purpose,
      customType: purposeOther,
      constructionType: constructionType ?? undefined,
      otherDetail: constructionOther,
      applicationNotes,
      fee: feeConfig?.amount,
      paymentStatus: "PENDING",
      status: "SUBMITTED",
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "NOC_APPLICATION_SUBMITTED",
    module: "noc",
    recordId: noc.id,
    plotId,
    newValue: {
      applicationNumber,
      purpose,
      constructionType,
      applicantName: owner.ownerName,
      hasActiveMortgage: plot.hasActiveMortgage,
    },
    reason:
      purpose === "CONSTRUCTION"
        ? "Owner applied to society for NOC to construct/build on plot"
        : undefined,
  });

  revalidatePath("/noc");
  revalidatePath(`/plots/${plotId}`);
  redirect(`/noc/${noc.id}`);
}

export async function updateNocReview(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canApproveNoc(session.user.role)) throw new Error("Forbidden");

  const nocId = String(formData.get("nocId") || "");
  const status = String(formData.get("status") || "") as ApplicationStatus;
  const remarks = String(formData.get("remarks") || "").trim() || null;

  if (!nocId) throw new Error("NOC id required");
  if (!["UNDER_REVIEW", "APPROVED", "REJECTED"].includes(status)) {
    throw new Error("Invalid review status");
  }

  const existing = await prisma.noc.findUnique({ where: { id: nocId } });
  if (!existing) throw new Error("NOC not found");
  if (["ISSUED", "CANCELLED"].includes(existing.status)) {
    throw new Error("Cannot change status of issued/cancelled NOC");
  }

  const updated = await prisma.noc.update({
    where: { id: nocId },
    data: {
      status,
      remarks,
      approvedById: status === "APPROVED" ? session.user.id : existing.approvedById,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "NOC_STATUS_UPDATED",
    module: "noc",
    recordId: nocId,
    plotId: existing.plotId,
    oldValue: { status: existing.status },
    newValue: { status },
    reason: remarks,
  });

  revalidatePath("/noc");
  revalidatePath(`/noc/${nocId}`);
  revalidatePath(`/plots/${existing.plotId}`);
}

export async function issueNoc(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canApproveNoc(session.user.role)) throw new Error("Forbidden");

  const nocId = String(formData.get("nocId") || "");
  const issueDateRaw = String(formData.get("issueDate") || "");
  const expiryDateRaw = String(formData.get("expiryDate") || "").trim();
  const remarks = String(formData.get("remarks") || "").trim() || null;
  const file = formData.get("file");
  const acknowledgeMortgage = formData.get("acknowledgeMortgage") === "on";

  if (!nocId) throw new Error("NOC id required");

  const existing = await prisma.noc.findUnique({
    where: { id: nocId },
    include: { plot: true, ownership: true },
  });
  if (!existing) throw new Error("NOC not found");
  if (existing.status === "ISSUED") throw new Error("NOC already issued");
  if (!["SUBMITTED", "UNDER_REVIEW", "APPROVED"].includes(existing.status)) {
    throw new Error("NOC cannot be issued in current status");
  }

  if (existing.plot.hasActiveMortgage && existing.purpose === "CONSTRUCTION" && !acknowledgeMortgage) {
    throw new Error("Active mortgage warning must be acknowledged before issuing construction NOC");
  }

  const issueDate = issueDateRaw ? new Date(issueDateRaw) : new Date();
  const expiryDate = expiryDateRaw ? new Date(expiryDateRaw) : null;
  const nocNumber =
    existing.nocNumber || (await nextNocNumber(existing.plot.sector));

  const updated = await prisma.noc.update({
    where: { id: nocId },
    data: {
      status: "ISSUED",
      nocNumber,
      issueDate,
      expiryDate,
      documentPath: existing.documentPath,
      remarks: remarks ?? existing.remarks,
      approvedById: session.user.id,
    },
  });

  if (file instanceof File && file.size > 0) {
    const doc = await createDocumentWithUpload({
      plotId: existing.plotId,
      ownershipId: existing.ownershipId,
      documentType: "NOC",
      title: `NOC ${nocNumber}`,
      documentNumber: nocNumber,
      issueDate,
      expiryDate,
      uploadedById: session.user.id,
      file,
    });
    await prisma.noc.update({
      where: { id: nocId },
      data: { documentPath: doc.filePath },
    });
  }

  await writeAuditLog({
    userId: session.user.id,
    action: "NOC_ISSUED",
    module: "noc",
    recordId: nocId,
    plotId: existing.plotId,
    newValue: {
      nocNumber,
      issueDate: issueDate.toISOString(),
      expiryDate: expiryDate?.toISOString() ?? null,
      purpose: existing.purpose,
    },
    reason: remarks,
  });

  revalidatePath("/noc");
  revalidatePath(`/noc/${nocId}`);
  revalidatePath(`/plots/${existing.plotId}`);
}
