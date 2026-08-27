import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { nextAllotmentNumber, nextMembershipNumber, nextReceiptNumber } from "@/lib/numbering";
import { AUTO_POST_FEE_TYPES, postRevenueFromPayment } from "@/lib/finance";
import { computeAllotmentLetterDue } from "@/lib/sla";
import { validateDeathTransferReadiness } from "@/lib/death-transfer";
import type { Prisma } from "@/generated/prisma/client";
import { closeOpenFilesForTransfer } from "@/lib/open-files";

/**
 * Completes a transfer while preserving full ownership history.
 * NEVER deletes or overwrites prior ownership / membership records.
 */
export async function completeTransfer(transferId: string, userId: string) {
  const transfer = await prisma.transfer.findUnique({
    where: { id: transferId },
    include: {
      plot: {
        include: {
          ownerships: { where: { status: "ACTIVE" }, take: 1 },
          mortgages: { where: { status: "ACTIVE" } },
          physicalFile: true,
        },
      },
      payments: true,
    },
  });

  if (!transfer) throw new Error("Transfer not found");
  if (transfer.status === "COMPLETED") throw new Error("Transfer already completed");
  if (!transfer.purchaserName || !transfer.purchaserCnic) {
    throw new Error("Purchaser details are required");
  }
  if (!transfer.sellerIdentityVerified) {
    throw new Error("Seller or attorney identity must be verified before completing the transfer.");
  }
  if (!transfer.sellerPresentPersonally && !transfer.powerOfAttorneyId) {
    throw new Error(
      "Seller must appear personally, or an active sale power of attorney must be linked to this case."
    );
  }
  if (transfer.powerOfAttorneyId) {
    const poa = await prisma.powerOfAttorney.findUnique({ where: { id: transfer.powerOfAttorneyId } });
    if (!poa || poa.status !== "ACTIVE") {
      throw new Error("Linked sale PoA is not active. Activate it before completing the transfer.");
    }
  }

  if (transfer.plot.mortgages.length > 0) {
    throw new Error(
      "Active bank/mortgage restriction exists. Clear bank NOC before completing transfer."
    );
  }

  const verifiedPayment = transfer.payments.find((p) => p.status === "VERIFIED");
  if (!verifiedPayment) {
    throw new Error("Transfer payment must be verified by Finance before completion");
  }

  const activeOwner = transfer.plot.ownerships[0];
  if (!activeOwner) throw new Error("No active ownership found for plot");

  const newMembership = transfer.newMembershipNumber || (await nextMembershipNumber());
  const newAllotment = transfer.newAllotmentNumber || (await nextAllotmentNumber());
  const now = new Date();
  const allotmentLetterDueAt = await computeAllotmentLetterDue(now);

  const result = await prisma.$transaction(async (tx) => {
    // Close old ownership — preserve as historical TRANSFERRED record
    const closed = await tx.ownership.update({
      where: { id: activeOwner.id },
      data: {
        status: "TRANSFERRED",
        endDate: now,
        transferOutId: transfer.id,
      },
    });

    // Create NEW ownership record — never overwrite the old one
    const newOwnership = await tx.ownership.create({
      data: {
        plotId: transfer.plotId,
        ownerName: transfer.purchaserName!,
        cnic: transfer.purchaserCnic!,
        contact: transfer.purchaserContact,
        address: transfer.purchaserAddress,
        membershipNumber: newMembership,
        allotmentNumber: newAllotment,
        startDate: now,
        status: "ACTIVE",
        transferInId: transfer.id,
      },
    });

    const completed = await tx.transfer.update({
      where: { id: transfer.id },
      data: {
        status: "COMPLETED",
        currentStep: 14,
        completedAt: now,
        completedById: userId,
        newMembershipNumber: newMembership,
        newAllotmentNumber: newAllotment,
        sellerOwnershipId: activeOwner.id,
        allotmentLetterDueAt,
      },
    });

    await tx.plot.update({
      where: { id: transfer.plotId },
      data: {
        ownershipStatus: "ACTIVE",
      },
    });

    await closeOpenFilesForTransfer(tx, {
      plotId: transfer.plotId,
      transferId: transfer.id,
      purchaserName: transfer.purchaserName,
      purchaserCnic: transfer.purchaserCnic,
      purchaserContact: transfer.purchaserContact,
      purchaserAddress: transfer.purchaserAddress,
      closedDate: now,
    });

    return { closed, newOwnership, completed };
  });

  await writeAuditLog({
    userId,
    action: "TRANSFER_COMPLETED",
    module: "transfers",
    recordId: transfer.id,
    plotId: transfer.plotId,
    transferId: transfer.id,
    oldValue: {
      ownershipId: activeOwner.id,
      membershipNumber: activeOwner.membershipNumber,
      status: activeOwner.status,
    } as Prisma.InputJsonValue,
    newValue: {
      ownershipId: result.newOwnership.id,
      membershipNumber: result.newOwnership.membershipNumber,
      allotmentNumber: result.newOwnership.allotmentNumber,
      ownerName: result.newOwnership.ownerName,
    } as Prisma.InputJsonValue,
    reason: "Ownership transfer completed; prior membership marked TRANSFERRED",
  });

  return result;
}

/**
 * Completes a death / succession transfer to the nominated primary legal heir.
 * Preserves full ownership history; deceased membership is marked TRANSFERRED.
 */
export async function completeDeathSuccessionTransfer(transferId: string, userId: string) {
  const transfer = await prisma.transfer.findUnique({
    where: { id: transferId },
    include: {
      plot: {
        include: {
          ownerships: { where: { status: "ACTIVE" }, take: 1 },
          mortgages: { where: { status: "ACTIVE" } },
        },
      },
      heirs: true,
      documents: { where: { status: "ACTIVE" } },
    },
  });

  if (!transfer) throw new Error("Transfer not found");
  if (transfer.transferType !== "DEATH_SUCCESSION") {
    throw new Error("This action is only for death / succession transfers");
  }
  if (transfer.status === "COMPLETED") throw new Error("Transfer already completed");
  if (!transfer.deceasedDateOfDeath) {
    throw new Error("Date of death is required for succession case");
  }

  const readiness = validateDeathTransferReadiness({
    heirs: transfer.heirs,
    documents: transfer.documents,
  });
  if (!readiness.ok) {
    throw new Error(readiness.errors.join("; "));
  }

  const primaryHeir = transfer.heirs.find((h) => h.isPrimarySuccessor)!;

  if (transfer.plot.mortgages.length > 0) {
    throw new Error(
      "Active bank/mortgage restriction exists. Clear bank NOC before completing succession transfer."
    );
  }

  const activeOwner = transfer.plot.ownerships[0];
  if (!activeOwner) throw new Error("No active ownership found for plot");

  const newMembership = transfer.newMembershipNumber || (await nextMembershipNumber());
  const newAllotment = transfer.newAllotmentNumber || (await nextAllotmentNumber());
  const now = new Date();
  const allotmentLetterDueAt = await computeAllotmentLetterDue(now);

  const result = await prisma.$transaction(async (tx) => {
    const closed = await tx.ownership.update({
      where: { id: activeOwner.id },
      data: {
        status: "TRANSFERRED",
        endDate: now,
        transferOutId: transfer.id,
      },
    });

    const newOwnership = await tx.ownership.create({
      data: {
        plotId: transfer.plotId,
        ownerName: primaryHeir.name,
        cnic: primaryHeir.cnic,
        contact: primaryHeir.contact,
        address: primaryHeir.address,
        membershipNumber: newMembership,
        allotmentNumber: newAllotment,
        startDate: now,
        status: "ACTIVE",
        transferInId: transfer.id,
      },
    });

    const completed = await tx.transfer.update({
      where: { id: transfer.id },
      data: {
        status: "COMPLETED",
        currentStep: 14,
        completedAt: now,
        completedById: userId,
        purchaserName: primaryHeir.name,
        purchaserCnic: primaryHeir.cnic,
        purchaserContact: primaryHeir.contact,
        purchaserAddress: primaryHeir.address,
        newMembershipNumber: newMembership,
        newAllotmentNumber: newAllotment,
        sellerOwnershipId: activeOwner.id,
        allotmentLetterDueAt,
      },
    });

    await tx.plot.update({
      where: { id: transfer.plotId },
      data: {
        ownershipStatus: "ACTIVE",
      },
    });

    await closeOpenFilesForTransfer(tx, {
      plotId: transfer.plotId,
      transferId: transfer.id,
      purchaserName: primaryHeir.name,
      purchaserCnic: primaryHeir.cnic,
      purchaserContact: primaryHeir.contact,
      purchaserAddress: primaryHeir.address,
      closedDate: now,
    });

    return { closed, newOwnership, completed };
  });

  await writeAuditLog({
    userId,
    action: "DEATH_SUCCESSION_COMPLETED",
    module: "transfers",
    recordId: transfer.id,
    plotId: transfer.plotId,
    transferId: transfer.id,
    oldValue: {
      ownershipId: activeOwner.id,
      membershipNumber: activeOwner.membershipNumber,
      deceased: transfer.sellerName,
    } as Prisma.InputJsonValue,
    newValue: {
      ownershipId: result.newOwnership.id,
      membershipNumber: result.newOwnership.membershipNumber,
      successor: primaryHeir.name,
      heirsCount: transfer.heirs.length,
    } as Prisma.InputJsonValue,
    reason: `Death / succession transfer — membership transferred to primary legal heir (${primaryHeir.relationToDeceased})`,
  });

  return result;
}

export async function markAllotmentLetterPrinted(transferId: string, userId: string) {
  const transfer = await prisma.transfer.findUnique({ where: { id: transferId } });
  if (!transfer) throw new Error("Transfer not found");
  if (transfer.status !== "COMPLETED") throw new Error("Transfer must be completed first");
  if (transfer.allotmentLetterPrintedAt) throw new Error("Allotment letter already marked printed");

  const updated = await prisma.transfer.update({
    where: { id: transferId },
    data: { allotmentLetterPrintedAt: new Date() },
  });

  await writeAuditLog({
    userId,
    action: "ALLOTMENT_LETTER_PRINTED",
    module: "transfers",
    recordId: transferId,
    plotId: transfer.plotId,
    transferId,
  });

  return updated;
}

export async function verifyPayment(paymentId: string, userId: string) {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) throw new Error("Payment not found");
  if (payment.status === "VERIFIED") throw new Error("Already verified");

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      status: "VERIFIED",
      verifiedById: userId,
      verifiedAt: new Date(),
    },
  });

  await writeAuditLog({
    userId,
    action: "PAYMENT_VERIFIED",
    module: "payments",
    recordId: paymentId,
    plotId: payment.plotId,
    transferId: payment.transferId,
    oldValue: { status: payment.status },
    newValue: { status: "VERIFIED" },
  });

  if (AUTO_POST_FEE_TYPES.includes(payment.feeType)) {
    try {
      await postRevenueFromPayment(paymentId, userId);
    } catch (err) {
      // Payment is verified; ledger posting can be retried manually from Payments or Finance.
      console.warn("Auto-post revenue failed:", err);
    }
  }

  return updated;
}

export async function createFeeConfiguration(data: {
  feeType: "OPEN_FILE" | "TRANSFER" | "ANNUAL_PLOT_CHARGE" | "NOC" | "NEC" | "POSSESSION" | "WATER_TANKER" | "OTHER";
  name: string;
  amount: number;
  periodMonths?: number;
  effectiveFrom: Date;
  createdById?: string;
  remarks?: string;
}) {
  // Soft-close previous active config of same type (do not mutate historical amounts)
  await prisma.feeConfiguration.updateMany({
    where: { feeType: data.feeType, status: "ACTIVE", effectiveUntil: null },
    data: { effectiveUntil: data.effectiveFrom, status: "SUPERSEDED" },
  });

  const created = await prisma.feeConfiguration.create({
    data: {
      feeType: data.feeType,
      name: data.name,
      amount: data.amount,
      periodMonths: data.periodMonths,
      effectiveFrom: data.effectiveFrom,
      status: "ACTIVE",
      createdById: data.createdById,
      remarks: data.remarks,
    },
  });

  await writeAuditLog({
    userId: data.createdById,
    action: "FEE_CONFIGURATION_CHANGED",
    module: "settings",
    recordId: created.id,
    newValue: {
      feeType: created.feeType,
      amount: Number(created.amount),
      effectiveFrom: created.effectiveFrom.toISOString(),
    },
  });

  return created;
}

export async function movePhysicalFile(input: {
  physicalFileId: string;
  toLocationId: string;
  movedById: string;
  reason: string;
  transferId?: string;
  remarks?: string;
}) {
  const file = await prisma.physicalFile.findUnique({
    where: { id: input.physicalFileId },
  });
  if (!file) throw new Error("Physical file not found");

  const fromLocationId = file.currentLocationId;

  const movement = await prisma.$transaction(async (tx) => {
    const move = await tx.fileMovement.create({
      data: {
        physicalFileId: input.physicalFileId,
        fromLocationId: fromLocationId ?? undefined,
        toLocationId: input.toLocationId,
        movedById: input.movedById,
        reason: input.reason,
        transferId: input.transferId,
        remarks: input.remarks,
      },
    });

    await tx.physicalFile.update({
      where: { id: input.physicalFileId },
      data: {
        currentLocationId: input.toLocationId,
        status: "IN_LOCKER",
      },
    });

    return move;
  });

  await writeAuditLog({
    userId: input.movedById,
    action: "PHYSICAL_FILE_MOVED",
    module: "physical-files",
    recordId: movement.id,
    plotId: file.plotId,
    transferId: input.transferId,
    oldValue: { locationId: fromLocationId },
    newValue: { locationId: input.toLocationId },
    reason: input.reason,
  });

  return movement;
}

export async function renewOpenFile(openFileId: string, periods: number, userId?: string) {
  const openFile = await prisma.openFile.findUnique({
    where: { id: openFileId },
    include: { feeConfig: true },
  });
  if (!openFile) throw new Error("Open file not found");
  if (!["ACTIVE", "OPEN", "EXPIRED"].includes(openFile.status)) {
    throw new Error("Only an open (or expired) dealer file can be renewed");
  }

  const activeFee = await prisma.feeConfiguration.findFirst({
    where: { feeType: "OPEN_FILE", status: "ACTIVE" },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!activeFee) throw new Error("No active open-file fee configured");

  const periodMonths = activeFee.periodMonths || 3;
  const feeAmount = Number(activeFee.amount) * periods;
  const previousExpiry = openFile.expiryDate;
  const newExpiry = new Date(previousExpiry);
  newExpiry.setMonth(newExpiry.getMonth() + periodMonths * periods);

  const result = await prisma.$transaction(async (tx) => {
    const renewal = await tx.openFileRenewal.create({
      data: {
        openFileId,
        previousExpiry,
        newExpiry,
        feeAmount,
        periods,
        paymentStatus: "PENDING",
      },
    });

    const updated = await tx.openFile.update({
      where: { id: openFileId },
      data: {
        expiryDate: newExpiry,
        feeAmount: Number(openFile.feeAmount) + feeAmount,
        feeConfigId: activeFee.id,
        status: "OPEN",
        paymentStatus: "PENDING",
      },
    });

    const receipt = await nextReceiptNumber();
    await tx.payment.create({
      data: {
        receiptNumber: receipt,
        plotId: openFile.plotId,
        openFileId,
        feeConfigId: activeFee.id,
        feeType: "OPEN_FILE",
        amount: feeAmount,
        status: "PENDING",
        paymentMethod: "PO",
      },
    });

    return { renewal, updated };
  });

  await writeAuditLog({
    userId,
    action: "OPEN_FILE_RENEWED",
    module: "open-files",
    recordId: openFileId,
    plotId: openFile.plotId,
    newValue: {
      periods,
      feeAmount,
      previousExpiry: previousExpiry.toISOString(),
      newExpiry: newExpiry.toISOString(),
    },
  });

  return result;
}
