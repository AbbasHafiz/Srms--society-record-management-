"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { createDocumentWithUpload } from "@/lib/documents";
import { nextPossessionApplicationNumber, nextPossessionLetterNumber } from "@/lib/numbering";
import { canApprovePossession, canCreatePossessionApplication } from "@/lib/possession";
import { computePossessionSlaDue } from "@/lib/sla";
import { requireActiveSpecialPoa } from "@/lib/poa";
import type { ApplicationStatus } from "@/generated/prisma/client";

async function getActivePossessionFee() {
  return prisma.feeConfiguration.findFirst({
    where: { feeType: "POSSESSION", status: "ACTIVE" },
    orderBy: { effectiveFrom: "desc" },
  });
}

export async function createPossessionApplication(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canCreatePossessionApplication(session.user.role)) throw new Error("Forbidden");

  const plotId = String(formData.get("plotId") || "");
  const applicantName = String(formData.get("applicantName") || "").trim();
  const remarks = String(formData.get("remarks") || "").trim() || null;
  const appearingInPerson = String(formData.get("ownerAppearingInPerson") || "yes") !== "no";
  const powerOfAttorneyId = String(formData.get("powerOfAttorneyId") || "").trim() || null;

  if (!plotId) throw new Error("Plot is required");

  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    include: { ownerships: { where: { status: "ACTIVE" }, take: 1 } },
  });
  if (!plot) throw new Error("Plot not found");

  const owner = plot.ownerships[0];
  if (!owner) throw new Error("No active owner on this plot");

  let linkedPoaId: string | null = null;
  if (!appearingInPerson) {
    if (!powerOfAttorneyId) {
      throw new Error("Owner is not present. Link an active special PoA for possession / construction.");
    }
    const poa = await requireActiveSpecialPoa({
      poaId: powerOfAttorneyId,
      plotId,
      principalCnic: owner.cnic,
      for: "possession",
    });
    linkedPoaId = poa.id;
  }

  const feeConfig = await getActivePossessionFee();
  const applicationNumber = await nextPossessionApplicationNumber();
  const applicationDate = new Date();
  const slaDueAt = await computePossessionSlaDue(applicationDate);

  const possession = await prisma.possession.create({
    data: {
      plotId,
      ownershipId: owner.id,
      applicationNumber,
      applicationDate,
      slaDueAt,
      applicantName: applicantName || owner.ownerName,
      possessionFee: feeConfig?.amount,
      paymentStatus: "PENDING",
      approvalStatus: "SUBMITTED",
      remarks,
      powerOfAttorneyId: linkedPoaId,
    },
  });

  await prisma.plot.update({
    where: { id: plotId },
    data: { possessionStatus: "APPLIED" },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "POSSESSION_APPLICATION_SUBMITTED",
    module: "possession",
    recordId: possession.id,
    plotId,
    newValue: { applicationNumber, applicantName: possession.applicantName },
  });

  revalidatePath("/possession");
  revalidatePath(`/plots/${plotId}`);
  redirect(`/possession/${possession.id}`);
}

export async function updatePossessionReview(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canApprovePossession(session.user.role)) throw new Error("Forbidden");

  const possessionId = String(formData.get("possessionId") || "");
  const approvalStatus = String(formData.get("approvalStatus") || "") as ApplicationStatus;
  const remarks = String(formData.get("remarks") || "").trim() || null;

  if (!possessionId) throw new Error("Possession id required");
  if (!["UNDER_REVIEW", "APPROVED", "REJECTED"].includes(approvalStatus)) {
    throw new Error("Invalid review status");
  }

  const existing = await prisma.possession.findUnique({ where: { id: possessionId } });
  if (!existing) throw new Error("Possession not found");
  if (["ISSUED", "CANCELLED"].includes(existing.approvalStatus)) {
    throw new Error("Cannot change status of issued/cancelled possession");
  }

  await prisma.possession.update({
    where: { id: possessionId },
    data: {
      approvalStatus,
      remarks,
      approvedById: approvalStatus === "APPROVED" ? session.user.id : existing.approvedById,
    },
  });

  if (approvalStatus === "APPROVED") {
    await prisma.plot.update({
      where: { id: existing.plotId },
      data: { possessionStatus: "APPROVED" },
    });
  }

  await writeAuditLog({
    userId: session.user.id,
    action: "POSSESSION_STATUS_UPDATED",
    module: "possession",
    recordId: possessionId,
    plotId: existing.plotId,
    oldValue: { approvalStatus: existing.approvalStatus },
    newValue: { approvalStatus },
    reason: remarks,
  });

  revalidatePath("/possession");
  revalidatePath(`/possession/${possessionId}`);
  revalidatePath(`/plots/${existing.plotId}`);
}

export async function issuePossessionLetter(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canApprovePossession(session.user.role)) throw new Error("Forbidden");

  const possessionId = String(formData.get("possessionId") || "");
  const issueDateRaw = String(formData.get("issueDate") || "");
  const remarks = String(formData.get("remarks") || "").trim() || null;
  const file = formData.get("file");

  if (!possessionId) throw new Error("Possession id required");

  const existing = await prisma.possession.findUnique({
    where: { id: possessionId },
    include: { plot: true, ownership: true },
  });
  if (!existing) throw new Error("Possession not found");
  if (existing.approvalStatus === "ISSUED") throw new Error("Possession letter already issued");
  if (!["SUBMITTED", "UNDER_REVIEW", "APPROVED"].includes(existing.approvalStatus)) {
    throw new Error("Possession cannot be issued in current status");
  }

  const issueDate = issueDateRaw ? new Date(issueDateRaw) : new Date();
  const letterNumber =
    existing.letterNumber || (await nextPossessionLetterNumber(existing.plot.sector));

  await prisma.possession.update({
    where: { id: possessionId },
    data: {
      approvalStatus: "ISSUED",
      letterNumber,
      issueDate,
      remarks: remarks ?? existing.remarks,
      approvedById: session.user.id,
    },
  });

  await prisma.plot.update({
    where: { id: existing.plotId },
    data: { possessionStatus: "ISSUED" },
  });

  if (file instanceof File && file.size > 0) {
    await createDocumentWithUpload({
      plotId: existing.plotId,
      ownershipId: existing.ownershipId,
      documentType: "POSSESSION_LETTER",
      title: `Possession letter ${letterNumber}`,
      documentNumber: letterNumber,
      issueDate,
      uploadedById: session.user.id,
      file,
    });
  }

  await writeAuditLog({
    userId: session.user.id,
    action: "POSSESSION_ISSUED",
    module: "possession",
    recordId: possessionId,
    plotId: existing.plotId,
    newValue: { letterNumber, issueDate: issueDate.toISOString() },
    reason: remarks,
  });

  revalidatePath("/possession");
  revalidatePath(`/possession/${possessionId}`);
  revalidatePath(`/plots/${existing.plotId}`);
  revalidatePath("/documents");
}
