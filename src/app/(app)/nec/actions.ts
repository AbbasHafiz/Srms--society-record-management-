"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { createDocumentWithUpload } from "@/lib/documents";
import { nextNecApplicationNumber, nextNecNumber } from "@/lib/numbering";
import { canApproveNec, canCreateNecApplication } from "@/lib/nec";
import { computeNecSlaDue } from "@/lib/sla";
import type { ApplicationStatus } from "@/generated/prisma/client";

async function getActiveNecFee() {
  return prisma.feeConfiguration.findFirst({
    where: { feeType: "NEC", status: "ACTIVE" },
    orderBy: { effectiveFrom: "desc" },
  });
}

export async function createNecApplication(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canCreateNecApplication(session.user.role)) throw new Error("Forbidden");

  const plotId = String(formData.get("plotId") || "");
  const applicantName = String(formData.get("applicantName") || "").trim();
  const remarks = String(formData.get("remarks") || "").trim() || null;

  if (!plotId) throw new Error("Plot is required");

  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    include: { ownerships: { where: { status: "ACTIVE" }, take: 1 } },
  });
  if (!plot) throw new Error("Plot not found");

  const owner = plot.ownerships[0];
  if (!owner) throw new Error("No active owner on this plot");

  const feeConfig = await getActiveNecFee();
  const applicationNumber = await nextNecApplicationNumber();
  const applicationDate = new Date();
  const slaDueAt = await computeNecSlaDue(applicationDate);

  const nec = await prisma.nec.create({
    data: {
      plotId,
      ownershipId: owner.id,
      applicationNumber,
      applicationDate,
      slaDueAt,
      applicantName: applicantName || owner.ownerName,
      fee: feeConfig?.amount,
      paymentStatus: "PENDING",
      status: "SUBMITTED",
      remarks,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "NEC_APPLICATION_SUBMITTED",
    module: "nec",
    recordId: nec.id,
    plotId,
    newValue: { applicationNumber, applicantName: nec.applicantName },
  });

  revalidatePath("/nec");
  revalidatePath(`/plots/${plotId}`);
  redirect(`/nec/${nec.id}`);
}

export async function updateNecReview(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canApproveNec(session.user.role)) throw new Error("Forbidden");

  const necId = String(formData.get("necId") || "");
  const status = String(formData.get("status") || "") as ApplicationStatus;
  const remarks = String(formData.get("remarks") || "").trim() || null;

  if (!necId) throw new Error("NEC id required");
  if (!["UNDER_REVIEW", "APPROVED", "REJECTED"].includes(status)) {
    throw new Error("Invalid review status");
  }

  const existing = await prisma.nec.findUnique({ where: { id: necId } });
  if (!existing) throw new Error("NEC not found");
  if (["ISSUED", "CANCELLED"].includes(existing.status)) {
    throw new Error("Cannot change status of issued/cancelled NEC");
  }

  await prisma.nec.update({
    where: { id: necId },
    data: {
      status,
      remarks,
      approvedById: status === "APPROVED" ? session.user.id : existing.approvedById,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "NEC_STATUS_UPDATED",
    module: "nec",
    recordId: necId,
    plotId: existing.plotId,
    oldValue: { status: existing.status },
    newValue: { status },
    reason: remarks,
  });

  revalidatePath("/nec");
  revalidatePath(`/nec/${necId}`);
  revalidatePath(`/plots/${existing.plotId}`);
}

export async function issueNec(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!canApproveNec(session.user.role)) throw new Error("Forbidden");

  const necId = String(formData.get("necId") || "");
  const issueDateRaw = String(formData.get("issueDate") || "");
  const expiryDateRaw = String(formData.get("expiryDate") || "").trim();
  const remarks = String(formData.get("remarks") || "").trim() || null;
  const file = formData.get("file");

  if (!necId) throw new Error("NEC id required");

  const existing = await prisma.nec.findUnique({
    where: { id: necId },
    include: { plot: true, ownership: true },
  });
  if (!existing) throw new Error("NEC not found");
  if (existing.status === "ISSUED") throw new Error("NEC already issued");
  if (!["SUBMITTED", "UNDER_REVIEW", "APPROVED"].includes(existing.status)) {
    throw new Error("NEC cannot be issued in current status");
  }

  const issueDate = issueDateRaw ? new Date(issueDateRaw) : new Date();
  const expiryDate = expiryDateRaw ? new Date(expiryDateRaw) : null;
  const necNumber = existing.necNumber || (await nextNecNumber(existing.plot.sector));

  await prisma.nec.update({
    where: { id: necId },
    data: {
      status: "ISSUED",
      necNumber,
      issueDate,
      expiryDate,
      remarks: remarks ?? existing.remarks,
      approvedById: session.user.id,
    },
  });

  if (file instanceof File && file.size > 0) {
    await createDocumentWithUpload({
      plotId: existing.plotId,
      ownershipId: existing.ownershipId,
      documentType: "NEC",
      title: `NEC ${necNumber}`,
      documentNumber: necNumber,
      issueDate,
      expiryDate,
      uploadedById: session.user.id,
      file,
    });
  }

  await writeAuditLog({
    userId: session.user.id,
    action: "NEC_ISSUED",
    module: "nec",
    recordId: necId,
    plotId: existing.plotId,
    newValue: {
      necNumber,
      issueDate: issueDate.toISOString(),
      expiryDate: expiryDate?.toISOString() ?? null,
    },
    reason: remarks,
  });

  revalidatePath("/nec");
  revalidatePath(`/nec/${necId}`);
  revalidatePath(`/plots/${existing.plotId}`);
  revalidatePath("/documents");
}
