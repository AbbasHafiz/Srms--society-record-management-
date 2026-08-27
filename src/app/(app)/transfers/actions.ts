"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { nextTransferNumber, nextReceiptNumber } from "@/lib/numbering";
import {
  completeTransfer,
  completeDeathSuccessionTransfer,
  markAllotmentLetterPrinted,
  verifyPayment,
} from "@/lib/services";
import { hasPermission } from "@/lib/rbac";
import { computeTransferSlaDue } from "@/lib/sla";
import { validateDeathTransferReadiness } from "@/lib/death-transfer";
import { requireOtherDetail } from "@/lib/other-specify";
import {
  actionFail,
  actionOk,
  getErrorMessage,
  isNextNavigationError,
  redirectWithError,
  type ActionResult,
} from "@/lib/action-result";
import { softCheckCnic, transferCompleteSchema, zodFieldErrors } from "@/lib/validation";
import type { HeirRelation } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const HEIR_RELATIONS: HeirRelation[] = [
  "WIFE",
  "HUSBAND",
  "SON",
  "DAUGHTER",
  "MOTHER",
  "FATHER",
  "BROTHER",
  "SISTER",
  "OTHER",
];

export async function createTransferDraft(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "create")) throw new Error("Forbidden");

  const plotId = String(formData.get("plotId") || "");
  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    include: { ownerships: { where: { status: "ACTIVE" }, take: 1 } },
  });
  if (!plot) throw new Error("Plot not found");
  const owner = plot.ownerships[0];
  if (!owner) throw new Error("No active owner");

  const transferNumber = await nextTransferNumber();
  const now = new Date();
  const slaDueAt = await computeTransferSlaDue("SALE", now);

  const transfer = await prisma.transfer.create({
    data: {
      transferNumber,
      trdNumber: transferNumber,
      plotId,
      transferType: "SALE",
      status: "SELLER_VERIFICATION",
      currentStep: 3,
      sellerName: owner.ownerName,
      sellerCnic: owner.cnic,
      sellerMembershipNo: owner.membershipNumber,
      sellerContact: owner.contact,
      sellerAddress: owner.address,
      sellerOwnershipId: owner.id,
      slaDueAt,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "TRANSFER_DRAFT_CREATED",
    module: "transfers",
    recordId: transfer.id,
    plotId,
    transferId: transfer.id,
    newValue: { transferNumber, seller: owner.ownerName, transferType: "SALE" },
  });

  redirect(`/transfers/${transfer.id}`);
}

export async function createDeathSuccessionDraft(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "create")) throw new Error("Forbidden");

  const plotId = String(formData.get("plotId") || "");
  const dateOfDeathRaw = String(formData.get("deceasedDateOfDeath") || "");
  const deathCertificateRef = String(formData.get("deathCertificateRef") || "").trim() || null;
  const remarks = String(formData.get("remarks") || "").trim() || null;

  if (!dateOfDeathRaw) throw new Error("Date of death is required");

  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    include: { ownerships: { where: { status: "ACTIVE" }, take: 1 } },
  });
  if (!plot) throw new Error("Plot not found");
  const owner = plot.ownerships[0];
  if (!owner) throw new Error("No active owner on plot");

  const transferNumber = await nextTransferNumber();
  const now = new Date();
  const slaDueAt = await computeTransferSlaDue("DEATH_SUCCESSION", now);

  const transfer = await prisma.transfer.create({
    data: {
      transferNumber,
      trdNumber: transferNumber,
      plotId,
      transferType: "DEATH_SUCCESSION",
      status: "DOCUMENTS_PENDING",
      currentStep: 2,
      sellerName: owner.ownerName,
      sellerCnic: owner.cnic,
      sellerMembershipNo: owner.membershipNumber,
      sellerContact: owner.contact,
      sellerAddress: owner.address,
      sellerOwnershipId: owner.id,
      deceasedDateOfDeath: new Date(dateOfDeathRaw),
      deathCertificateRef,
      remarks,
      slaDueAt,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "DEATH_SUCCESSION_OPENED",
    module: "transfers",
    recordId: transfer.id,
    plotId,
    transferId: transfer.id,
    newValue: {
      transferNumber,
      deceased: owner.ownerName,
      dateOfDeath: dateOfDeathRaw,
    },
    reason: "Death / succession case opened at society office",
  });

  redirect(`/transfers/${transfer.id}`);
}

export async function addTransferHeir(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "edit")) throw new Error("Forbidden");

  const transferId = String(formData.get("transferId") || "");
  const relation = String(formData.get("relationToDeceased") || "OTHER") as HeirRelation;
  const isPrimary = formData.get("isPrimarySuccessor") === "yes";

  if (!HEIR_RELATIONS.includes(relation)) throw new Error("Invalid relation");
  const otherDetail = requireOtherDetail(formData, relation, {
    message: "Please specify the relation when Other is selected",
  });

  const cnicRaw = String(formData.get("cnic") || "").trim();
  const cnicCheck = softCheckCnic(cnicRaw);
  if (!cnicCheck.ok) throw new Error(cnicCheck.message);

  const transfer = await prisma.transfer.findUnique({ where: { id: transferId } });
  if (!transfer || transfer.transferType !== "DEATH_SUCCESSION") {
    throw new Error("Invalid death succession case");
  }
  if (transfer.status === "COMPLETED") throw new Error("Case already completed");

  if (isPrimary) {
    await prisma.transferHeir.updateMany({
      where: { transferId },
      data: { isPrimarySuccessor: false },
    });
  }

  await prisma.transferHeir.create({
    data: {
      transferId,
      name: String(formData.get("name") || "").trim(),
      cnic: cnicCheck.normalized,
      relationToDeceased: relation,
      otherDetail,
      contact: String(formData.get("contact") || "").trim() || null,
      address: String(formData.get("address") || "").trim() || null,
      isPrimarySuccessor: isPrimary,
      shareNotes: String(formData.get("shareNotes") || "").trim() || null,
    },
  });

  revalidatePath(`/transfers/${transferId}`);
}

export async function removeTransferHeir(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "edit")) throw new Error("Forbidden");

  const heirId = String(formData.get("heirId") || "");
  const heir = await prisma.transferHeir.findUnique({ where: { id: heirId } });
  if (!heir) throw new Error("Heir not found");

  await prisma.transferHeir.delete({ where: { id: heirId } });
  revalidatePath(`/transfers/${heir.transferId}`);
}

export async function submitDeathCaseForApproval(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "edit")) throw new Error("Forbidden");

  const id = String(formData.get("id") || "");
  const transfer = await prisma.transfer.findUnique({
    where: { id },
    include: { heirs: true, documents: { where: { status: "ACTIVE" } } },
  });
  if (!transfer || transfer.transferType !== "DEATH_SUCCESSION") {
    throw new Error("Invalid death succession case");
  }

  const readiness = validateDeathTransferReadiness({
    heirs: transfer.heirs,
    documents: transfer.documents,
  });
  if (!readiness.ok) {
    throw new Error(readiness.errors.join("; "));
  }

  await prisma.transfer.update({
    where: { id },
    data: { status: "APPROVAL_PENDING", currentStep: 9 },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "DEATH_CASE_SUBMITTED",
    module: "transfers",
    recordId: id,
    transferId: id,
    plotId: transfer.plotId,
  });

  revalidatePath(`/transfers/${id}`);
}

export async function updateTransferStep(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const id = String(formData.get("id"));
  const step = Number(formData.get("step"));
  const action = String(formData.get("action") || "save");

  const data: Record<string, unknown> = { currentStep: step };

  if (step === 3) {
    data.sellerPresentPersonally = formData.get("sellerPresentPersonally") === "yes";
    data.sellerIdentityVerified = formData.get("sellerIdentityVerified") === "yes";
    data.sellerVerificationNotes = String(formData.get("sellerVerificationNotes") || "") || null;
    data.sellerVerifiedById = session.user.id;
    data.sellerVerificationDate = new Date();
    data.status = "DOCUMENTS_PENDING";
  }

  if (step === 5) {
    data.purchaserName = String(formData.get("purchaserName") || "");
    data.purchaserCnic = String(formData.get("purchaserCnic") || "");
    data.purchaserContact = String(formData.get("purchaserContact") || "") || null;
    data.purchaserAddress = String(formData.get("purchaserAddress") || "") || null;
    data.status = "PAYMENT_PENDING";
    data.currentStep = 7;
  }

  if (step === 7) {
    const amount = Number(formData.get("amount") || 0);
    const poNumber = String(formData.get("poNumber") || "");
    const bankName = String(formData.get("bankName") || "");
    const transfer = await prisma.transfer.findUnique({ where: { id } });
    if (!transfer) throw new Error("Transfer not found");

    const fee = await prisma.feeConfiguration.findFirst({
      where: { feeType: "TRANSFER", status: "ACTIVE" },
      orderBy: { effectiveFrom: "desc" },
    });

    const receipt = await nextReceiptNumber();
    await prisma.payment.create({
      data: {
        receiptNumber: receipt,
        plotId: transfer.plotId,
        transferId: id,
        feeConfigId: fee?.id,
        feeType: "TRANSFER",
        amount: amount || Number(fee?.amount || 0),
        poAmount: amount || Number(fee?.amount || 0),
        poNumber,
        bankName,
        poDate: new Date(),
        paymentDate: new Date(),
        status: "SUBMITTED",
        paymentMethod: "PO",
      },
    });

    data.status = "PAYMENT_VERIFICATION";
    data.currentStep = 8;
  }

  await prisma.transfer.update({ where: { id }, data });

  await writeAuditLog({
    userId: session.user.id,
    action: "TRANSFER_STEP_UPDATED",
    module: "transfers",
    recordId: id,
    transferId: id,
    newValue: { step, action },
  });

  revalidatePath(`/transfers/${id}`);
}

export async function approveTransferAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "approve")) throw new Error("Forbidden");

  const id = String(formData.get("id"));
  await prisma.transfer.update({
    where: { id },
    data: {
      status: "APPROVED",
      currentStep: 10,
      approvedById: session.user.id,
      approvedAt: new Date(),
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "TRANSFER_APPROVED",
    module: "transfers",
    recordId: id,
    transferId: id,
  });

  revalidatePath(`/transfers/${id}`);
}

export async function completeTransferAction(formData: FormData): Promise<ActionResult> {
  try {
    const parsed = transferCompleteSchema.safeParse({
      id: String(formData.get("id") || ""),
    });
    if (!parsed.success) return actionFail(zodFieldErrors(parsed.error));

    const session = await auth();
    if (!session?.user) return actionFail("Unauthorized");
    if (!hasPermission(session.user.role, "complete_transfer")) return actionFail("Forbidden");

    const { id } = parsed.data;
    const transfer = await prisma.transfer.findUnique({ where: { id } });
    if (!transfer) return actionFail("Transfer not found");

    if (transfer.transferType === "DEATH_SUCCESSION") {
      await completeDeathSuccessionTransfer(id, session.user.id);
    } else {
      await completeTransfer(id, session.user.id);
    }

    revalidatePath(`/transfers/${id}`);
    revalidatePath(`/plots`);
    return actionOk();
  } catch (err) {
    return actionFail(getErrorMessage(err));
  }
}

export async function markAllotmentPrintedAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "complete_transfer")) throw new Error("Forbidden");

  const id = String(formData.get("id"));
  await markAllotmentLetterPrinted(id, session.user.id);
  revalidatePath(`/transfers/${id}`);
}

export async function verifyTransferPaymentAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "verify_payment")) throw new Error("Forbidden");

  const paymentId = String(formData.get("paymentId"));
  await verifyPayment(paymentId, session.user.id);

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (payment?.transferId) {
    await prisma.transfer.update({
      where: { id: payment.transferId },
      data: { status: "APPROVAL_PENDING", currentStep: 9 },
    });
    revalidatePath(`/transfers/${payment.transferId}`);
  }
  revalidatePath("/payments");
}

export async function updateTransferRemarks(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "edit")) throw new Error("Forbidden");

  const id = String(formData.get("id") || "").trim();
  const remarks = String(formData.get("remarks") || "").trim() || null;
  if (!id) throw new Error("Transfer ID required");

  const transfer = await prisma.transfer.findUnique({ where: { id } });
  if (!transfer) throw new Error("Transfer not found");
  if (transfer.status === "COMPLETED") throw new Error("Completed transfers cannot be edited");

  await prisma.transfer.update({
    where: { id },
    data: { remarks },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "TRANSFER_REMARKS_UPDATED",
    module: "transfers",
    recordId: id,
    transferId: id,
    plotId: transfer.plotId,
    newValue: { remarks },
  });

  revalidatePath(`/transfers/${id}`);
}
