"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRegisterOpenFile, hasPermission } from "@/lib/rbac";
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
  UNPAID_PLOT_CHARGE_STATUSES,
  isLiveOpenFileStatus,
  isRegisteredDealerActive,
  syncPlotHasOpenFile,
} from "@/lib/open-files";
import {
  OPEN_FILE_CONSIDERATION_METHODS,
  OPEN_FILE_HOLDER_TYPES,
  OPEN_FILE_SUPPORTING_DOC_TYPES,
} from "@/lib/open-files-shared";
import { requireActiveSalePoa } from "@/lib/poa";
import type {
  DocumentType,
  OpenFileHolderType,
  PaymentMethod,
  SellerAppearance,
} from "@/generated/prisma/client";

export { assignRegisteredOfficeToOpenFile };

function asFile(value: FormDataEntryValue | null): File | null {
  if (value instanceof File && value.size > 0) return value;
  return null;
}

export async function createOpenFile(formData: FormData) {
  const plotId = String(formData.get("plotId") || "").trim();
  const returnPath = plotId ? `/open-files/new?plotId=${plotId}` : "/open-files/new";

  try {
    const session = await auth();
    if (!session?.user) redirectWithError(returnPath, "Sign in to register an open file.");
    if (!canRegisterOpenFile(session.user.role)) {
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
    const letterhead = asFile(formData.get("letterhead"));
    const allotmentLetter = asFile(formData.get("allotmentLetter"));

    const holderTypeRaw = String(formData.get("holderType") || "").trim() as OpenFileHolderType;
    const holderName = String(formData.get("holderName") || "").trim();
    const holderCnicRaw = String(formData.get("holderCnic") || "").trim();
    const holderContact = String(formData.get("holderContact") || "").trim() || null;
    const holderAddress = String(formData.get("holderAddress") || "").trim() || null;

    const considerationAmountRaw = String(formData.get("considerationAmount") || "").trim();
    const considerationDateRaw = String(formData.get("considerationDate") || "").trim();
    const considerationMethodRaw = String(formData.get("considerationMethod") || "").trim() as PaymentMethod;
    const considerationMethodOther = String(formData.get("considerationMethodOther") || "").trim() || null;
    const considerationRemarks = String(formData.get("considerationRemarks") || "").trim() || null;

    const sellerAppearanceRaw = String(formData.get("sellerAppearance") || "IN_PERSON").trim();
    const sellerAppearance: SellerAppearance =
      sellerAppearanceRaw === "VIA_ATTORNEY" ? "VIA_ATTORNEY" : "IN_PERSON";
    const powerOfAttorneyId = String(formData.get("powerOfAttorneyId") || "").trim() || null;
    const duesOverrideReason = String(formData.get("duesOverrideReason") || "").trim() || null;
    const selectedChargeIds = formData
      .getAll("clearChargeId")
      .map((v) => String(v).trim())
      .filter(Boolean);

    if (!plotId) redirectWithError(returnPath, "Select a plot.");
    if (!OPEN_FILE_HOLDER_TYPES.includes(holderTypeRaw)) {
      redirectWithError(returnPath, "Record whether XYZ is an investor or a dealer.");
    }
    if (!holderName) {
      redirectWithError(
        returnPath,
        "Record XYZ — the investor or dealer who paid the seller. This is not the eventual end-buyer."
      );
    }
    const holderCnicCheck = softCheckCnic(holderCnicRaw);
    if (!holderCnicCheck.ok) redirectWithError(returnPath, `XYZ CNIC: ${holderCnicCheck.message}`);
    const holderCnic = holderCnicCheck.normalized;

    const considerationAmount = Number(considerationAmountRaw);
    if (!considerationAmountRaw || Number.isNaN(considerationAmount) || considerationAmount <= 0) {
      redirectWithError(returnPath, "Record the private sale consideration the seller received from XYZ.");
    }
    const considerationDate = new Date(considerationDateRaw);
    if (Number.isNaN(considerationDate.getTime())) {
      redirectWithError(returnPath, "Date the seller received payment from XYZ is required.");
    }
    if (!OPEN_FILE_CONSIDERATION_METHODS.includes(considerationMethodRaw)) {
      redirectWithError(returnPath, "Select how XYZ paid the seller.");
    }
    if (considerationMethodRaw === "OTHER" && !considerationMethodOther) {
      redirectWithError(returnPath, "Specify the consideration payment method.");
    }
    if (!allotmentLetter) {
      redirectWithError(
        returnPath,
        "Upload a scan of the allotment letter handed to XYZ. A checkbox is not enough."
      );
    }
    if (!registeredOfficeId) {
      redirectWithError(
        returnPath,
        "Select the registered dealer who issued letterhead stating this file should be made open transfer."
      );
    }
    if (Number.isNaN(openingDate.getTime())) {
      redirectWithError(returnPath, "Opening date is required.");
    }
    if (!poNumber || !poBank || !poDateRaw) {
      redirectWithError(
        returnPath,
        "Record the society open-file fee as a pay order: P.O. number, issuing bank, and P.O. date are required."
      );
    }
    const poDate = new Date(poDateRaw);
    if (Number.isNaN(poDate.getTime())) {
      redirectWithError(returnPath, "Pay order date is invalid.");
    }
    if (!letterhead) {
      redirectWithError(
        returnPath,
        "Upload the registered dealer letterhead scan stating the file should be made open transfer."
      );
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
        plotCharges: {
          where: { status: { in: UNPAID_PLOT_CHARGE_STATUSES } },
          orderBy: [{ year: "asc" }, { month: "asc" }],
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
    if (owner.cnic.replace(/\D/g, "") === holderCnic.replace(/\D/g, "")) {
      redirectWithError(
        returnPath,
        "XYZ CNIC matches the seller. Record the investor or dealer who paid the seller, not the seller."
      );
    }

    let linkedPoaId: string | null = null;
    if (sellerAppearance === "VIA_ATTORNEY") {
      if (!powerOfAttorneyId) {
        redirectWithError(
          returnPath,
          "Seller is not appearing in person. Link an active sale power of attorney for this plot / owner."
        );
      }
      const poa = await requireActiveSalePoa({
        poaId: powerOfAttorneyId,
        plotId,
        principalCnic: owner.cnic,
      });
      linkedPoaId = poa.id;
    }

    const office = await prisma.registeredOffice.findUnique({ where: { id: registeredOfficeId } });
    if (!office) redirectWithError(returnPath, "Registered dealer not found.");
    if (!isRegisteredDealerActive(office)) {
      redirectWithError(
        returnPath,
        "Dealer must be active and registered. Suspended or expired offices cannot issue an open-transfer letterhead."
      );
    }

    const chargesToClear = plot.plotCharges.filter((c) => selectedChargeIds.includes(c.id));
    const remainingCharges = plot.plotCharges.filter((c) => !selectedChargeIds.includes(c.id));
    const isSuperAdmin = session.user.role === "SUPER_ADMIN";
    if (remainingCharges.length > 0) {
      if (!isSuperAdmin || !duesOverrideReason) {
        redirectWithError(
          returnPath,
          remainingCharges.length === plot.plotCharges.length
            ? "Seller must clear pending society dues (annual charges and transfer-related plot dues) before the file can be opened. Select each outstanding charge to record payment, or a SUPER_ADMIN may override with a reason."
            : `${remainingCharges.length} plot due(s) remain uncleared. Record payment for each, or a SUPER_ADMIN may override with a reason.`
        );
      }
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
    const now = new Date();

    const openFileNumber = await nextOpenFileNumber();
    const receiptNumber = await nextReceiptNumber();
    const chargeReceiptNumbers = await Promise.all(chargesToClear.map(() => nextReceiptNumber()));

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
          holderType: holderTypeRaw,
          holderName,
          holderCnic,
          holderContact,
          holderAddress,
          sellerAppearance,
          powerOfAttorneyId: linkedPoaId,
          documentsHandedOverAt: now,
          duesClearedAt: remainingCharges.length === 0 ? now : null,
          duesOverrideReason: remainingCharges.length > 0 ? duesOverrideReason : null,
          duesOverrideById: remainingCharges.length > 0 ? session.user.id : null,
          duesOverrideAt: remainingCharges.length > 0 ? now : null,
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

      await tx.openFileConsideration.create({
        data: {
          openFileId: created.id,
          amount: considerationAmount,
          paidAt: considerationDate,
          paymentMethod: considerationMethodRaw,
          methodOther: considerationMethodRaw === "OTHER" ? considerationMethodOther : null,
          remarks: considerationRemarks ?? "Private sale consideration from XYZ to seller",
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
          remarks: "Society open-file fee paid as pay order",
        },
      });

      for (let i = 0; i < chargesToClear.length; i++) {
        const charge = chargesToClear[i];
        if (charge.status === "PAID" || charge.status === "WAIVED") continue;
        await tx.plotCharge.update({
          where: { id: charge.id },
          data: { status: "PAID", paidAt: now },
        });
        await tx.payment.create({
          data: {
            receiptNumber: chargeReceiptNumbers[i],
            plotId,
            ownershipId: owner.id,
            openFileId: created.id,
            feeConfigId: charge.feeConfigId,
            feeType: "ANNUAL_PLOT_CHARGE",
            amount: charge.amount,
            paymentDate: now,
            paymentMethod: "PO",
            status: "SUBMITTED",
            remarks: `Plot due ${charge.year}${charge.month ? `-${String(charge.month).padStart(2, "0")}` : ""} cleared for open transfer`,
          },
        });
      }

      if (chargesToClear.length > 0) {
        const pending = await tx.plotCharge.count({
          where: { plotId, status: { in: UNPAID_PLOT_CHARGE_STATUSES } },
        });
        await tx.plot.update({
          where: { id: plotId },
          data: {
            hasOpenFile: true,
            annualChargesStatus: pending > 0 ? "BILLED" : "PAID",
          },
        });
      } else {
        await tx.plot.update({
          where: { id: plotId },
          data: { hasOpenFile: true },
        });
      }

      return created;
    });

    const letterheadDoc = await createDocumentWithUpload({
      plotId,
      ownershipId: owner.id,
      openFileId: openFile.id,
      registeredOfficeId: office.id,
      documentType: "DEALER_LETTERHEAD",
      title: `Open-transfer letterhead — ${office.officeName}`,
      uploadedById: session.user.id,
      file: letterhead,
    });

    const allotmentDoc = await createDocumentWithUpload({
      plotId,
      ownershipId: owner.id,
      openFileId: openFile.id,
      documentType: "ALLOTMENT_LETTER",
      title: `Allotment letter handed to ${holderName}`,
      uploadedById: session.user.id,
      file: allotmentLetter,
    });

    for (const supporting of OPEN_FILE_SUPPORTING_DOC_TYPES) {
      const file = asFile(formData.get(supporting.key));
      if (!file) continue;
      await createDocumentWithUpload({
        plotId,
        ownershipId: owner.id,
        openFileId: openFile.id,
        documentType: supporting.documentType as DocumentType,
        title: `${supporting.label} — handed to ${holderName}`,
        uploadedById: session.user.id,
        file,
      });
    }

    await prisma.openFile.update({
      where: { id: openFile.id },
      data: {
        letterheadDocumentId: letterheadDoc.id,
        allotmentLetterDocumentId: allotmentDoc.id,
      },
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
        holderName,
        holderType: holderTypeRaw,
        poNumber,
        poBank,
        letterheadDocumentId: letterheadDoc.id,
        allotmentLetterDocumentId: allotmentDoc.id,
        powerOfAttorneyId: linkedPoaId,
        sellerAppearance,
      },
    });

    revalidatePath("/open-files");
    revalidatePath(`/plots/${plotId}`);
    revalidatePath("/payments");
    revalidatePath("/annual-charges");
    if (linkedPoaId) revalidatePath(`/poa/${linkedPoaId}`);
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
    if (!canRegisterOpenFile(session.user.role)) {
      redirectWithError(returnPath, "You do not have permission to record an end buyer.");
    }

    const purchaserName = String(formData.get("purchaserName") || "").trim();
    const purchaserCnicRaw = String(formData.get("purchaserCnic") || "").trim();
    const purchaserContact = String(formData.get("purchaserContact") || "").trim() || null;
    const purchaserAddress = String(formData.get("purchaserAddress") || "").trim() || null;
    const cnicScan = asFile(formData.get("purchaserCnicScan"));

    if (!openFileId) redirectWithError(returnPath, "Open file is required.");
    if (!purchaserName) redirectWithError(returnPath, "End-buyer name is required.");
    const cnicCheck = softCheckCnic(purchaserCnicRaw);
    if (!cnicCheck.ok) redirectWithError(returnPath, cnicCheck.message);
    const purchaserCnic = cnicCheck.normalized;
    if (!cnicScan) {
      redirectWithError(returnPath, "Upload the end-buyer's CNIC scan. Identity must be proven with a real scan.");
    }

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
      redirectWithError(
        returnPath,
        "End-buyer CNIC matches the seller. Record the person who is purchasing the open file."
      );
    }
    if (openFile.holderCnic && openFile.holderCnic.replace(/\D/g, "") === purchaserCnic.replace(/\D/g, "")) {
      // Allowed: XYZ might later be the end-buyer, but user story says a later buyer purchases. Don't block.
    }

    const owner = openFile.plot.ownerships[0];
    if (!owner) {
      redirectWithError(returnPath, "Plot has no current owner. Cannot start the sale transfer.");
    }

    const viaAttorney = openFile.sellerAppearance === "VIA_ATTORNEY" && openFile.powerOfAttorneyId;

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
      await createDocumentWithUpload({
        plotId: openFile.plotId,
        ownershipId: owner.id,
        transferId: openFile.transfer.id,
        openFileId: openFile.id,
        documentType: "CNIC",
        title: `End-buyer CNIC — ${purchaserName}`,
        uploadedById: session.user.id,
        file: cnicScan,
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
          sellerPresentPersonally: !viaAttorney,
          powerOfAttorneyId: viaAttorney ? openFile.powerOfAttorneyId : null,
          purchaserName,
          purchaserCnic,
          purchaserContact,
          purchaserAddress,
          slaDueAt,
          remarks: `Opened from open file ${openFile.openFileNumber} (sold to ${openFile.holderName ?? "investor/dealer"}; end purchaser now named)`,
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

    await createDocumentWithUpload({
      plotId: openFile.plotId,
      ownershipId: owner.id,
      transferId: transfer.id,
      openFileId: openFile.id,
      documentType: "CNIC",
      title: `End-buyer CNIC — ${purchaserName}`,
      uploadedById: session.user.id,
      file: cnicScan,
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
      reason:
        "End buyer recorded on open file; sale transfer started. Completing the transfer (including society transfer fee) closes the file in the buyer's name.",
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
    if (!hasPermission(session.user.role, "edit") && !canRegisterOpenFile(session.user.role)) {
      redirectWithError(returnPath, "You do not have permission to withdraw an open file.");
    }

    const cancellationReason = String(formData.get("cancellationReason") || "").trim();
    if (!openFileId) redirectWithError(returnPath, "Open file is required.");
    if (!cancellationReason) {
      redirectWithError(
        returnPath,
        "Give a reason (withdrawn by seller, expired without buyer, dealer cancelled, etc.)."
      );
    }

    const openFile = await prisma.openFile.findUnique({ where: { id: openFileId } });
    if (!openFile) redirectWithError("/open-files", "Open file not found.");
    if (openFile.status === "CLOSED") {
      redirectWithError(
        returnPath,
        "This file is already closed in a purchaser's name. Ownership was changed through the sale transfer."
      );
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
