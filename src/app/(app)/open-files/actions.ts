"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { nextOpenFileNumber, nextReceiptNumber, nextTransferNumber } from "@/lib/numbering";
import { writeAuditLog } from "@/lib/audit";
import { assignRegisteredOfficeToOpenFile } from "@/app/(app)/offices/actions";
import { createDocumentWithUpload } from "@/lib/documents";
import { computeTransferSlaDue } from "@/lib/sla";
import { softCheckCnic } from "@/lib/validation";
import {
  getErrorMessage,
  isNextNavigationError,
  redirectWithError,
} from "@/lib/action-result";
import {
  LIVE_OPEN_FILE_STATUSES,
  isLiveOpenFileStatus,
  isRegisteredDealerActive,
  syncPlotHasOpenFile,
} from "@/lib/open-files";

export { assignRegisteredOfficeToOpenFile };

export async function createOpenFile(formData: FormData) {
  const plotId = String(formData.get("plotId") || "").trim();
  const returnPath = plotId ? `/open-files/new?plotId=${plotId}` : "/open-files/new";

  try {
    const session = await auth();
    if (!session?.user) redirectWithError(returnPath, "Sign in to register an open file.");
    if (!hasPermission(session.user.role, "create")) {
      redirectWithError(returnPath, "You do not have permission to register an open file.");
    }

    const registeredOfficeId = String(formData.get("registeredOfficeId") || "").trim();
    const trdNumber = String(formData.get("trdNumber") || "").trim() || null;
    const openingDate = new Date(String(formData.get("openingDate") || ""));
    const periodMonths = Number(formData.get("periodMonths") || 3);
    const remarks = String(formData.get("remarks") || "").trim() || null;
    const poNumber = String(formData.get("poNumber") || "").trim();
    const poBank = String(formData.get("poBank") || "").trim();
    const poDateRaw = String(formData.get("poDate") || "").trim();
    const letterhead = formData.get("letterhead");

    if (!plotId) redirectWithError(returnPath, "Select a plot.");
    if (!registeredOfficeId) {
      redirectWithError(returnPath, "Select a registered dealer. The dealer must already be on the property office register.");
    }
    if (Number.isNaN(openingDate.getTime())) {
      redirectWithError(returnPath, "Opening date is required.");
    }
    if (!poNumber || !poBank || !poDateRaw) {
      redirectWithError(returnPath, "Record the open-file fee as a pay order: P.O. number, issuing bank, and P.O. date are required.");
    }
    const poDate = new Date(poDateRaw);
    if (Number.isNaN(poDate.getTime())) {
      redirectWithError(returnPath, "Pay order date is invalid.");
    }
    if (!(letterhead instanceof File) || letterhead.size === 0) {
      redirectWithError(returnPath, "Upload the dealer letterhead scan. A checkbox is not enough.");
    }

    const plot = await prisma.plot.findUnique({
      where: { id: plotId },
      include: {
        ownerships: { where: { status: "ACTIVE" }, take: 1 },
        openFiles: {
          where: { status: { in: LIVE_OPEN_FILE_STATUSES } },
          take: 1,
          select: { id: true, openFileNumber: true },
        },
      },
    });
    if (!plot) redirectWithError(returnPath, "Plot not found.");
    const owner = plot.ownerships[0];
    if (!owner) {
      redirectWithError(returnPath, "This plot has no current owner. Open files stay in the seller's name.");
    }
    if (plot.openFiles[0]) {
      redirectWithError(
        returnPath,
        `Plot already has open file ${plot.openFiles[0].openFileNumber}. Close or withdraw it before opening another.`
      );
    }

    const office = await prisma.registeredOffice.findUnique({ where: { id: registeredOfficeId } });
    if (!office) redirectWithError(returnPath, "Registered dealer not found.");
    if (!isRegisteredDealerActive(office)) {
      redirectWithError(
        returnPath,
        "Dealer must be active and registered. Suspended or expired offices cannot issue an open file."
      );
    }

    const activeFee = await prisma.feeConfiguration.findFirst({
      where: { feeType: "OPEN_FILE", status: "ACTIVE" },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!activeFee) {
      redirectWithError(returnPath, "No active open-file fee is configured. Set it under Settings before registering.");
    }

    const months = activeFee.periodMonths || periodMonths || 3;
    const expiryDate = new Date(openingDate);
    expiryDate.setMonth(expiryDate.getMonth() + months);
    const feeAmount = Number(activeFee.amount);

    const openFileNumber = await nextOpenFileNumber();
    const receiptNumber = await nextReceiptNumber();

    const openFile = await prisma.$transaction(async (tx) => {
      const created = await tx.openFile.create({
        data: {
          openFileNumber,
          plotId,
          ownershipId: owner.id,
          registeredOfficeId: office.id,
          sellerName: owner.ownerName,
          sellerCnic: owner.cnic,
          sellerMembershipNo: owner.membershipNumber,
          dealerName: office.officeName,
          dealerOffice: office.address ?? office.ownerName,
          trdNumber,
          openingDate,
          expiryDate,
          periodMonths: months,
          feeAmount,
          feeConfigId: activeFee.id,
          paymentStatus: "SUBMITTED",
          status: "OPEN",
          remarks,
        },
      });

      await tx.payment.create({
        data: {
          receiptNumber,
          plotId,
          ownershipId: owner.id,
          openFileId: created.id,
          feeConfigId: activeFee.id,
          feeType: "OPEN_FILE",
          amount: feeAmount,
          poAmount: feeAmount,
          poNumber,
          bankName: poBank,
          poDate,
          paymentDate: poDate,
          paymentMethod: "PO",
          status: "SUBMITTED",
          remarks: "Open-file fee paid to society as pay order",
        },
      });

      await tx.plot.update({
        where: { id: plotId },
        data: { hasOpenFile: true },
      });

      return created;
    });

    const letterheadDoc = await createDocumentWithUpload({
      plotId,
      ownershipId: owner.id,
      openFileId: openFile.id,
      registeredOfficeId: office.id,
      documentType: "DEALER_LETTERHEAD",
      title: `Dealer letterhead — ${office.officeName}`,
      uploadedById: session.user.id,
      file: letterhead,
    });

    await prisma.openFile.update({
      where: { id: openFile.id },
      data: { letterheadDocumentId: letterheadDoc.id },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "OPEN_FILE_CREATED",
      module: "open-files",
      recordId: openFile.id,
      plotId,
      newValue: {
        openFileNumber,
        registeredOfficeId: office.id,
        dealerName: office.officeName,
        poNumber,
        poBank,
        letterheadDocumentId: letterheadDoc.id,
      },
    });

    revalidatePath("/open-files");
    revalidatePath(`/plots/${plotId}`);
    revalidatePath("/payments");
    redirect(`/open-files/${openFile.id}`);
  } catch (err) {
    if (isNextNavigationError(err)) throw err;
    redirectWithError(returnPath, getErrorMessage(err));
  }
}

export async function startCloseInPurchaserName(formData: FormData) {
  const openFileId = String(formData.get("openFileId") || "").trim();
  const returnPath = openFileId ? `/open-files/${openFileId}` : "/open-files";

  try {
    const session = await auth();
    if (!session?.user) redirectWithError(returnPath, "Sign in to close an open file.");
    if (!hasPermission(session.user.role, "create")) {
      redirectWithError(returnPath, "You do not have permission to record a purchaser.");
    }

    const purchaserName = String(formData.get("purchaserName") || "").trim();
    const purchaserCnicRaw = String(formData.get("purchaserCnic") || "").trim();
    const purchaserContact = String(formData.get("purchaserContact") || "").trim() || null;
    const purchaserAddress = String(formData.get("purchaserAddress") || "").trim() || null;

    if (!openFileId) redirectWithError(returnPath, "Open file is required.");
    if (!purchaserName) redirectWithError(returnPath, "Purchaser name is required.");
    const cnicCheck = softCheckCnic(purchaserCnicRaw);
    if (!cnicCheck.ok) redirectWithError(returnPath, cnicCheck.message);
    const purchaserCnic = cnicCheck.normalized;

    const openFile = await prisma.openFile.findUnique({
      where: { id: openFileId },
      include: {
        plot: { include: { ownerships: { where: { status: "ACTIVE" }, take: 1 } } },
        transfer: { select: { id: true, status: true, transferNumber: true } },
      },
    });
    if (!openFile) redirectWithError("/open-files", "Open file not found.");
    if (!isLiveOpenFileStatus(openFile.status) && openFile.status !== "EXPIRED") {
      redirectWithError(returnPath, "This file is already closed or cancelled.");
    }
    if (openFile.sellerCnic.replace(/\D/g, "") === purchaserCnic.replace(/\D/g, "")) {
      redirectWithError(returnPath, "Purchaser CNIC matches the seller. Record a different purchaser, or withdraw the file.");
    }

    const owner = openFile.plot.ownerships[0];
    if (!owner) {
      redirectWithError(returnPath, "Plot has no current owner. Cannot start the sale transfer.");
    }

    if (openFile.transfer && openFile.transfer.status !== "COMPLETED" && openFile.transfer.status !== "CANCELLED") {
      await prisma.openFile.update({
        where: { id: openFile.id },
        data: {
          purchaserName,
          purchaserCnic,
          purchaserContact,
          purchaserAddress,
        },
      });
      await prisma.transfer.update({
        where: { id: openFile.transfer.id },
        data: {
          purchaserName,
          purchaserCnic,
          purchaserContact,
          purchaserAddress,
        },
      });
      revalidatePath(`/open-files/${openFile.id}`);
      revalidatePath(`/transfers/${openFile.transfer.id}`);
      redirect(`/transfers/${openFile.transfer.id}`);
    }

    const transferNumber = await nextTransferNumber();
    const now = new Date();
    const slaDueAt = await computeTransferSlaDue("SALE", now);

    const transfer = await prisma.$transaction(async (tx) => {
      const created = await tx.transfer.create({
        data: {
          transferNumber,
          trdNumber: transferNumber,
          plotId: openFile.plotId,
          transferType: "SALE",
          status: "SELLER_VERIFICATION",
          currentStep: 3,
          sellerName: owner.ownerName,
          sellerCnic: owner.cnic,
          sellerMembershipNo: owner.membershipNumber,
          sellerContact: owner.contact,
          sellerAddress: owner.address,
          sellerOwnershipId: owner.id,
          purchaserName,
          purchaserCnic,
          purchaserContact,
          purchaserAddress,
          slaDueAt,
          remarks: `Opened from dealer open file ${openFile.openFileNumber}`,
        },
      });

      await tx.openFile.update({
        where: { id: openFile.id },
        data: {
          transferId: created.id,
          purchaserName,
          purchaserCnic,
          purchaserContact,
          purchaserAddress,
        },
      });

      return created;
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "OPEN_FILE_PURCHASER_RECORDED",
      module: "open-files",
      recordId: openFile.id,
      plotId: openFile.plotId,
      transferId: transfer.id,
      newValue: {
        purchaserName,
        purchaserCnic,
        transferNumber,
      },
      reason: "Purchaser recorded on open file; sale transfer started to close file in purchaser's name",
    });

    revalidatePath(`/open-files/${openFile.id}`);
    revalidatePath("/open-files");
    revalidatePath("/transfers");
    redirect(`/transfers/${transfer.id}`);
  } catch (err) {
    if (isNextNavigationError(err)) throw err;
    redirectWithError(returnPath, getErrorMessage(err));
  }
}

export async function cancelOpenFile(formData: FormData) {
  const openFileId = String(formData.get("openFileId") || "").trim();
  const returnPath = openFileId ? `/open-files/${openFileId}` : "/open-files";

  try {
    const session = await auth();
    if (!session?.user) redirectWithError(returnPath, "Sign in to withdraw an open file.");
    if (!hasPermission(session.user.role, "edit") && !hasPermission(session.user.role, "create")) {
      redirectWithError(returnPath, "You do not have permission to withdraw an open file.");
    }

    const cancellationReason = String(formData.get("cancellationReason") || "").trim();
    if (!openFileId) redirectWithError(returnPath, "Open file is required.");
    if (!cancellationReason) {
      redirectWithError(returnPath, "Give a reason (withdrawn by seller, expired without buyer, dealer cancelled, etc.).");
    }

    const openFile = await prisma.openFile.findUnique({ where: { id: openFileId } });
    if (!openFile) redirectWithError("/open-files", "Open file not found.");
    if (openFile.status === "CLOSED") {
      redirectWithError(returnPath, "This file is already closed in a purchaser's name. Ownership was changed through the sale transfer.");
    }
    if (openFile.status === "CANCELLED") {
      redirectWithError(returnPath, "This open file is already cancelled.");
    }

    const now = new Date();
    await prisma.$transaction(async (tx) => {
      await tx.openFile.update({
        where: { id: openFile.id },
        data: {
          status: "CANCELLED",
          closedDate: now,
          cancellationReason,
        },
      });
      await syncPlotHasOpenFile(openFile.plotId, tx);
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "OPEN_FILE_CANCELLED",
      module: "open-files",
      recordId: openFile.id,
      plotId: openFile.plotId,
      oldValue: { status: openFile.status },
      newValue: { status: "CANCELLED", cancellationReason },
      reason: "Open file withdrawn/cancelled without changing ownership",
    });

    revalidatePath(`/open-files/${openFile.id}`);
    revalidatePath("/open-files");
    revalidatePath(`/plots/${openFile.plotId}`);
    redirect(`/open-files/${openFile.id}`);
  } catch (err) {
    if (isNextNavigationError(err)) throw err;
    redirectWithError(returnPath, getErrorMessage(err));
  }
}
