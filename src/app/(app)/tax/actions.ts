"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/rbac";
import {
  createImmutableTaxAssessment,
  markTaxAssessmentPaid,
  parseDcValue,
  parseTaxForm,
  resolvePlotDcValue,
} from "@/lib/fbr-tax";
import { TAX_FORM_FIELDS } from "@/lib/fbr-tax-shared";
import { actionFail, actionOk, getErrorMessage, type ActionResult } from "@/lib/action-result";
import type { TaxSection } from "@/generated/prisma/client";

function revalidateTaxSurfaces(paths: { plotId?: string | null; transferId?: string | null; openFileId?: string | null }) {
  revalidatePath("/settings");
  if (paths.plotId) revalidatePath(`/plots/${paths.plotId}`);
  if (paths.transferId) revalidatePath(`/transfers/${paths.transferId}`);
  if (paths.openFileId) revalidatePath(`/open-files/${paths.openFileId}`);
  revalidatePath("/transfers");
  revalidatePath("/open-files");
}

export async function updatePlotDcValue(formData: FormData): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return actionFail("Unauthorized");
    if (!hasPermission(session.user.role, "edit") && !hasPermission(session.user.role, "configure_fees")) {
      return actionFail("Forbidden");
    }

    const plotId = String(formData.get("plotId") || "").trim();
    if (!plotId) return actionFail("Plot is required.");
    const dcValue = parseDcValue(formData.get("dcValue"));

    const plot = await prisma.plot.findUnique({ where: { id: plotId }, select: { id: true, dcValue: true } });
    if (!plot) return actionFail("Plot not found.");

    await prisma.plot.update({
      where: { id: plotId },
      data: { dcValue },
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "PLOT_DC_VALUE_SET",
      module: "plots",
      recordId: plotId,
      plotId,
      oldValue: { dcValue: plot.dcValue ? Number(plot.dcValue) : null },
      newValue: { dcValue },
    });

    revalidateTaxSurfaces({ plotId });
    return actionOk();
  } catch (err) {
    return actionFail(getErrorMessage(err));
  }
}

export async function recordFbrTaxAssessment(formData: FormData): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return actionFail("Unauthorized");
    if (!hasPermission(session.user.role, "create") && !hasPermission(session.user.role, "edit")) {
      return actionFail("Forbidden");
    }

    const plotId = String(formData.get(TAX_FORM_FIELDS.plotId) || "").trim();
    const transferId = String(formData.get(TAX_FORM_FIELDS.transferId) || "").trim() || null;
    const openFileId = String(formData.get(TAX_FORM_FIELDS.openFileId) || "").trim() || null;
    const taxSection = String(formData.get(TAX_FORM_FIELDS.taxSection) || "").trim() as TaxSection;
    if (!plotId) return actionFail("Plot is required.");
    if (taxSection !== "SECTION_236C" && taxSection !== "SECTION_236K") {
      return actionFail("Select 236C (seller) or 236K (purchaser).");
    }
    if (taxSection === "SECTION_236K" && openFileId && !transferId) {
      return actionFail("Purchaser 236K is not recorded on an open file. Record it when the end buyer transfers into their name.");
    }

    const parsed = parseTaxForm(formData);
    const { dcValue } = await resolvePlotDcValue(prisma, plotId, parsed.dcValueRaw);

    let partyName = "";
    let partyCnic: string | null = null;

    if (transferId) {
      const transfer = await prisma.transfer.findUnique({ where: { id: transferId } });
      if (!transfer) return actionFail("Transfer not found.");
      if (transfer.plotId !== plotId) return actionFail("Transfer does not belong to this plot.");
      if (transfer.status === "COMPLETED") {
        return actionFail("This transfer is completed. Existing tax snapshots cannot be replaced.");
      }
      if (taxSection === "SECTION_236C") {
        partyName = transfer.sellerName;
        partyCnic = transfer.sellerCnic;
      } else {
        if (!transfer.purchaserName || !transfer.purchaserCnic) {
          return actionFail("Save purchaser details before recording FBR 236K.");
        }
        partyName = transfer.purchaserName;
        partyCnic = transfer.purchaserCnic;
      }
    } else if (openFileId) {
      const openFile = await prisma.openFile.findUnique({ where: { id: openFileId } });
      if (!openFile) return actionFail("Open file not found.");
      if (openFile.plotId !== plotId) return actionFail("Open file does not belong to this plot.");
      if (taxSection !== "SECTION_236C") {
        return actionFail("Open files record seller 236C only. Purchaser 236K is recorded at name transfer.");
      }
      partyName = openFile.sellerName;
      partyCnic = openFile.sellerCnic;
    } else {
      return actionFail("A transfer or open file is required.");
    }

    const created = await createImmutableTaxAssessment(prisma, {
      plotId,
      transferId,
      openFileId,
      taxSection,
      partyRole: taxSection === "SECTION_236C" ? "SELLER" : "PURCHASER",
      partyName,
      partyCnic,
      filerStatus: parsed.filerStatus,
      dcValue,
      paymentStatus: parsed.paymentStatus,
      challanNumber: parsed.challanNumber,
      cprNumber: parsed.cprNumber,
      remarks: parsed.remarks,
      recordedById: session.user.id,
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "FBR_TAX_ASSESSED",
      module: taxSection === "SECTION_236C" ? "open-files" : "transfers",
      recordId: created.id,
      plotId,
      transferId: transferId ?? undefined,
      newValue: {
        assessmentNumber: created.assessmentNumber,
        taxSection,
        filerStatus: created.filerStatus,
        dcValue: Number(created.dcValueSnapshot),
        ratePercent: Number(created.ratePercent),
        amount: Number(created.amount),
        paymentStatus: created.paymentStatus,
      },
    });

    revalidateTaxSurfaces({ plotId, transferId, openFileId });
    return actionOk();
  } catch (err) {
    return actionFail(getErrorMessage(err));
  }
}

export async function markFbrTaxPaid(formData: FormData): Promise<ActionResult> {
  try {
    const session = await auth();
    if (!session?.user) return actionFail("Unauthorized");
    if (
      !hasPermission(session.user.role, "verify_payment") &&
      !hasPermission(session.user.role, "edit") &&
      !hasPermission(session.user.role, "complete_transfer")
    ) {
      return actionFail("Forbidden");
    }

    const assessmentId = String(formData.get("assessmentId") || "").trim();
    if (!assessmentId) return actionFail("Tax assessment is required.");
    const challanNumber = String(formData.get("challanNumber") || "").trim() || null;
    const cprNumber = String(formData.get("cprNumber") || "").trim() || null;

    const updated = await markTaxAssessmentPaid(prisma, {
      assessmentId,
      challanNumber,
      cprNumber,
      userId: session.user.id,
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "FBR_TAX_MARKED_PAID",
      module: "transfers",
      recordId: updated.id,
      plotId: updated.plotId,
      transferId: updated.transferId ?? undefined,
      newValue: {
        assessmentNumber: updated.assessmentNumber,
        taxSection: updated.taxSection,
        challanNumber: updated.challanNumber,
        cprNumber: updated.cprNumber,
      },
    });

    revalidateTaxSurfaces({
      plotId: updated.plotId,
      transferId: updated.transferId,
      openFileId: updated.openFileId,
    });
    return actionOk();
  } catch (err) {
    return actionFail(getErrorMessage(err));
  }
}
