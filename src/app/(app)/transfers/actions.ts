"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { nextTransferNumber, nextReceiptNumber } from "@/lib/numbering";
import { completeTransfer, verifyPayment } from "@/lib/services";
import { hasPermission } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

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
  const transfer = await prisma.transfer.create({
    data: {
      transferNumber,
      trdNumber: transferNumber,
      plotId,
      status: "SELLER_VERIFICATION",
      currentStep: 3,
      sellerName: owner.ownerName,
      sellerCnic: owner.cnic,
      sellerMembershipNo: owner.membershipNumber,
      sellerContact: owner.contact,
      sellerAddress: owner.address,
      sellerOwnershipId: owner.id,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "TRANSFER_DRAFT_CREATED",
    module: "transfers",
    recordId: transfer.id,
    plotId,
    transferId: transfer.id,
    newValue: { transferNumber, seller: owner.ownerName },
  });

  redirect(`/transfers/${transfer.id}`);
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

export async function completeTransferAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "complete_transfer")) throw new Error("Forbidden");

  const id = String(formData.get("id"));
  await completeTransfer(id, session.user.id);
  revalidatePath(`/transfers/${id}`);
  revalidatePath(`/plots`);
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
