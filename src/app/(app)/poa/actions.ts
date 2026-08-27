"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { canRegisterPoa } from "@/lib/rbac";
import { nextPoaNumber } from "@/lib/numbering";
import { writeAuditLog } from "@/lib/audit";
import { createDocumentWithUpload } from "@/lib/documents";
import { softCheckCnic } from "@/lib/validation";
import {
  getErrorMessage,
  isNextNavigationError,
  redirectWithError,
} from "@/lib/action-result";
import { foreignOfficeRequired } from "@/lib/poa";
import {
  POA_EXECUTION_PLACES,
  POA_KINDS,
  POA_PURPOSES,
  PRINCIPAL_ABSENCE_REASONS,
} from "@/lib/poa-shared";
import type {
  PoaExecutionPlace,
  PowerOfAttorneyKind,
  PowerOfAttorneyPurpose,
  PrincipalAbsenceReason,
} from "@/generated/prisma/client";

function asFile(value: FormDataEntryValue | null): File | null {
  if (value instanceof File && value.size > 0) return value;
  return null;
}

function revalidatePoa(poaId: string, plotId: string) {
  revalidatePath("/poa");
  revalidatePath(`/poa/${poaId}`);
  revalidatePath(`/poa/new`);
  revalidatePath(`/plots/${plotId}`);
}

export async function createPowerOfAttorney(formData: FormData) {
  const plotId = String(formData.get("plotId") || "").trim();
  const returnPath = plotId ? `/poa/new?plotId=${plotId}` : "/poa/new";

  try {
    const session = await auth();
    if (!session?.user) redirectWithError(returnPath, "Sign in to register a power of attorney.");
    if (!canRegisterPoa(session.user.role)) {
      redirectWithError(returnPath, "Records, transfer, secretary, or admin can register a PoA. Finance is not required for this step.");
    }

    const kind = String(formData.get("kind") || "").trim() as PowerOfAttorneyKind;
    const purpose = String(formData.get("purpose") || "").trim() as PowerOfAttorneyPurpose;
    const purposeNotes = String(formData.get("purposeNotes") || "").trim() || null;
    const principalAbsenceReasonRaw = String(formData.get("principalAbsenceReason") || "").trim();
    const principalAbsenceNotes = String(formData.get("principalAbsenceNotes") || "").trim() || null;
    const attorneyName = String(formData.get("attorneyName") || "").trim();
    const attorneyCnicRaw = String(formData.get("attorneyCnic") || "").trim();
    const attorneyContact = String(formData.get("attorneyContact") || "").trim() || null;
    const attorneyAddress = String(formData.get("attorneyAddress") || "").trim() || null;
    const executedAtRaw = String(formData.get("executedAt") || "").trim();
    const executionPlace = String(formData.get("executionPlace") || "").trim() as PoaExecutionPlace;
    const executionCity = String(formData.get("executionCity") || "").trim() || null;
    const validUntilRaw = String(formData.get("validUntil") || "").trim();
    const remarks = String(formData.get("remarks") || "").trim() || null;
    const instrument = asFile(formData.get("instrument"));
    const attorneyCnicFront = asFile(formData.get("attorneyCnicFront"));
    const attorneyCnicBack = asFile(formData.get("attorneyCnicBack"));

    if (!plotId) redirectWithError(returnPath, "Select a plot. PoA is plot-scoped and linked to the owner/seller.");
    if (!POA_KINDS.includes(kind)) redirectWithError(returnPath, "Select general / sale PoA or special PoA.");
    if (!POA_PURPOSES.includes(purpose)) redirectWithError(returnPath, "Select the PoA purpose.");
    if (purpose === "OTHER" && !purposeNotes) {
      redirectWithError(returnPath, "Describe the special purpose.");
    }
    if (kind === "GENERAL_SALE" && purpose !== "SALE_OPEN_FILE_TRANSFER") {
      redirectWithError(returnPath, "A general / sale PoA is for sell / open-file / transfer.");
    }
    if (kind === "SPECIAL" && purpose === "SALE_OPEN_FILE_TRANSFER") {
      // allowed as optional special sale purpose
    }
    if (kind === "GENERAL_SALE") {
      if (!PRINCIPAL_ABSENCE_REASONS.includes(principalAbsenceReasonRaw as PrincipalAbsenceReason)) {
        redirectWithError(returnPath, "Record why the principal cannot appear: abroad or unwell.");
      }
    }
    if (!attorneyName) redirectWithError(returnPath, "Attorney holder name is required.");
    const attorneyCnicCheck = softCheckCnic(attorneyCnicRaw);
    if (!attorneyCnicCheck.ok) redirectWithError(returnPath, `Attorney CNIC: ${attorneyCnicCheck.message}`);
    if (!attorneyCnicFront || !attorneyCnicBack) {
      redirectWithError(returnPath, "Upload attorney CNIC front and back scans. Identity must be a real scan.");
    }
    if (!instrument) {
      redirectWithError(returnPath, "Upload the executed PoA instrument scan.");
    }
    if (!POA_EXECUTION_PLACES.includes(executionPlace)) {
      redirectWithError(returnPath, "Record whether the PoA was executed in Pakistan or abroad.");
    }
    const executedAt = executedAtRaw ? new Date(executedAtRaw) : null;
    if (executedAtRaw && executedAt && Number.isNaN(executedAt.getTime())) {
      redirectWithError(returnPath, "Execution date is invalid.");
    }
    const validUntil = validUntilRaw ? new Date(validUntilRaw) : null;
    if (validUntilRaw && validUntil && Number.isNaN(validUntil.getTime())) {
      redirectWithError(returnPath, "Validity end date is invalid.");
    }

    const plot = await prisma.plot.findUnique({
      where: { id: plotId },
      include: { ownerships: { where: { status: "ACTIVE" }, take: 1 } },
    });
    if (!plot) redirectWithError(returnPath, "Plot not found.");
    const owner = plot.ownerships[0];
    if (!owner) redirectWithError(returnPath, "This plot has no current owner to act as principal.");

    if (owner.cnic.replace(/\D/g, "") === attorneyCnicCheck.normalized.replace(/\D/g, "")) {
      redirectWithError(returnPath, "Attorney CNIC matches the principal. Record the attorney holder, not the owner.");
    }

    const principalAbsenceReason =
      principalAbsenceReasonRaw &&
      PRINCIPAL_ABSENCE_REASONS.includes(principalAbsenceReasonRaw as PrincipalAbsenceReason)
        ? (principalAbsenceReasonRaw as PrincipalAbsenceReason)
        : null;

    const poaNumber = await nextPoaNumber();
    const now = new Date();

    const poa = await prisma.powerOfAttorney.create({
      data: {
        poaNumber,
        plotId,
        ownershipId: owner.id,
        kind,
        purpose: kind === "GENERAL_SALE" ? "SALE_OPEN_FILE_TRANSFER" : purpose,
        purposeNotes,
        status: "DRAFT",
        principalName: owner.ownerName,
        principalCnic: owner.cnic,
        principalMembershipNo: owner.membershipNumber,
        principalAbsenceReason,
        principalAbsenceNotes,
        attorneyName,
        attorneyCnic: attorneyCnicCheck.normalized,
        attorneyContact,
        attorneyAddress,
        executedAt,
        executionPlace,
        executionCity,
        validFrom: executedAt ?? now,
        validUntil,
        remarks,
        createdById: session.user.id,
      },
    });

    if (executedAt) {
      await prisma.powerOfAttorneyStep.create({
        data: {
          powerOfAttorneyId: poa.id,
          stepType: "EXECUTED",
          occurredAt: executedAt,
          officeName: executionCity,
          notes: `Executed ${executionPlace === "ABROAD" ? "abroad" : "in Pakistan"}`,
          recordedById: session.user.id,
        },
      });
    }

    await createDocumentWithUpload({
      plotId,
      ownershipId: owner.id,
      powerOfAttorneyId: poa.id,
      documentType: "POA_INSTRUMENT",
      title: `PoA instrument — ${poaNumber}`,
      uploadedById: session.user.id,
      file: instrument,
    });
    await createDocumentWithUpload({
      plotId,
      ownershipId: owner.id,
      powerOfAttorneyId: poa.id,
      documentType: "POA_ATTORNEY_CNIC",
      title: `Attorney CNIC front — ${attorneyName}`,
      documentNumber: "FRONT",
      uploadedById: session.user.id,
      file: attorneyCnicFront,
    });
    await createDocumentWithUpload({
      plotId,
      ownershipId: owner.id,
      powerOfAttorneyId: poa.id,
      documentType: "POA_ATTORNEY_CNIC",
      title: `Attorney CNIC back — ${attorneyName}`,
      documentNumber: "BACK",
      uploadedById: session.user.id,
      file: attorneyCnicBack,
    });

    await writeAuditLog({
      userId: session.user.id,
      action: "POA_CREATED",
      module: "poa",
      recordId: poa.id,
      plotId,
      newValue: { poaNumber, kind, purpose, attorneyName },
    });

    revalidatePoa(poa.id, plotId);
    redirect(`/poa/${poa.id}`);
  } catch (err) {
    if (isNextNavigationError(err)) throw err;
    redirectWithError(returnPath, getErrorMessage(err));
  }
}

export async function submitPowerOfAttorney(formData: FormData) {
  const poaId = String(formData.get("poaId") || "").trim();
  const returnPath = poaId ? `/poa/${poaId}` : "/poa";
  try {
    const session = await auth();
    if (!session?.user) redirectWithError(returnPath, "Sign in.");
    if (!canRegisterPoa(session.user.role)) redirectWithError(returnPath, "Not permitted.");
    const poa = await prisma.powerOfAttorney.findUnique({ where: { id: poaId } });
    if (!poa) redirectWithError("/poa", "PoA not found.");
    if (poa.status !== "DRAFT") redirectWithError(returnPath, "Only a draft PoA can be submitted.");

    const instrument = await prisma.document.findFirst({
      where: { powerOfAttorneyId: poa.id, documentType: "POA_INSTRUMENT", status: "ACTIVE" },
    });
    if (!instrument) redirectWithError(returnPath, "Upload the executed PoA instrument scan before submitting.");

    await prisma.powerOfAttorney.update({
      where: { id: poa.id },
      data: { status: "SUBMITTED" },
    });
    await writeAuditLog({
      userId: session.user.id,
      action: "POA_SUBMITTED",
      module: "poa",
      recordId: poa.id,
      plotId: poa.plotId,
    });
    revalidatePoa(poa.id, poa.plotId);
    redirect(returnPath);
  } catch (err) {
    if (isNextNavigationError(err)) throw err;
    redirectWithError(returnPath, getErrorMessage(err));
  }
}

export async function recordTehsildarVerification(formData: FormData) {
  const poaId = String(formData.get("poaId") || "").trim();
  const returnPath = poaId ? `/poa/${poaId}` : "/poa";
  try {
    const session = await auth();
    if (!session?.user) redirectWithError(returnPath, "Sign in.");
    if (!canRegisterPoa(session.user.role)) redirectWithError(returnPath, "Not permitted.");

    const officeName = String(formData.get("tehsildarOfficeName") || "").trim();
    const certificateNo = String(formData.get("tehsildarCertificateNo") || "").trim();
    const verifiedAtRaw = String(formData.get("tehsildarVerifiedAt") || "").trim();
    const scan = asFile(formData.get("tehsildarScan"));

    if (!officeName) redirectWithError(returnPath, "Tehsildar / tehsil office name is required.");
    if (!certificateNo) redirectWithError(returnPath, "Tehsildar certificate / diary number is required.");
    const verifiedAt = new Date(verifiedAtRaw);
    if (Number.isNaN(verifiedAt.getTime())) redirectWithError(returnPath, "Tehsildar verification date is required.");
    if (!scan) redirectWithError(returnPath, "Upload the Tehsildar attestation scan.");

    const poa = await prisma.powerOfAttorney.findUnique({ where: { id: poaId } });
    if (!poa) redirectWithError("/poa", "PoA not found.");
    if (poa.status !== "SUBMITTED") {
      redirectWithError(returnPath, "Tehsildar verification follows submission. This PoA is not in that step.");
    }

    const doc = await createDocumentWithUpload({
      plotId: poa.plotId,
      ownershipId: poa.ownershipId,
      powerOfAttorneyId: poa.id,
      documentType: "POA_TEHSILDAR_CERTIFICATE",
      title: `Tehsildar verification — ${officeName}`,
      documentNumber: certificateNo,
      uploadedById: session.user.id,
      file: scan,
    });

    await prisma.$transaction([
      prisma.powerOfAttorney.update({
        where: { id: poa.id },
        data: {
          status: "TEHSILDAR_VERIFIED",
          tehsildarOfficeName: officeName,
          tehsildarCertificateNo: certificateNo,
          tehsildarVerifiedAt: verifiedAt,
        },
      }),
      prisma.powerOfAttorneyStep.create({
        data: {
          powerOfAttorneyId: poa.id,
          stepType: "TEHSILDAR",
          occurredAt: verifiedAt,
          officeName,
          certificateNo,
          recordedById: session.user.id,
          documentId: doc.id,
        },
      }),
    ]);

    await writeAuditLog({
      userId: session.user.id,
      action: "POA_TEHSILDAR_VERIFIED",
      module: "poa",
      recordId: poa.id,
      plotId: poa.plotId,
      newValue: { officeName, certificateNo },
    });
    revalidatePoa(poa.id, poa.plotId);
    redirect(returnPath);
  } catch (err) {
    if (isNextNavigationError(err)) throw err;
    redirectWithError(returnPath, getErrorMessage(err));
  }
}

export async function recordForeignOfficeVerification(formData: FormData) {
  const poaId = String(formData.get("poaId") || "").trim();
  const returnPath = poaId ? `/poa/${poaId}` : "/poa";
  try {
    const session = await auth();
    if (!session?.user) redirectWithError(returnPath, "Sign in.");
    if (!canRegisterPoa(session.user.role)) redirectWithError(returnPath, "Not permitted.");

    const mission = String(formData.get("foreignOfficeMission") || "").trim();
    const city = String(formData.get("foreignOfficeCity") || "").trim();
    const attestationNo = String(formData.get("foreignOfficeAttestationNo") || "").trim();
    const verifiedAtRaw = String(formData.get("foreignOfficeVerifiedAt") || "").trim();
    const scan = asFile(formData.get("foreignOfficeScan"));

    if (!mission) redirectWithError(returnPath, "Foreign Office / Pakistani mission name is required.");
    if (!attestationNo) redirectWithError(returnPath, "Foreign office attestation number is required.");
    const verifiedAt = new Date(verifiedAtRaw);
    if (Number.isNaN(verifiedAt.getTime())) redirectWithError(returnPath, "Foreign office verification date is required.");
    if (!scan) redirectWithError(returnPath, "Upload the foreign office attestation scan.");

    const poa = await prisma.powerOfAttorney.findUnique({ where: { id: poaId } });
    if (!poa) redirectWithError("/poa", "PoA not found.");
    if (poa.status !== "TEHSILDAR_VERIFIED") {
      redirectWithError(returnPath, "Foreign office verification follows Tehsildar verification.");
    }
    if (!foreignOfficeRequired(poa)) {
      redirectWithError(returnPath, "Foreign office attestation is only required when the principal is abroad.");
    }

    const doc = await createDocumentWithUpload({
      plotId: poa.plotId,
      ownershipId: poa.ownershipId,
      powerOfAttorneyId: poa.id,
      documentType: "POA_FOREIGN_OFFICE_ATTESTATION",
      title: `Foreign office attestation — ${mission}`,
      documentNumber: attestationNo,
      uploadedById: session.user.id,
      file: scan,
    });

    await prisma.$transaction([
      prisma.powerOfAttorney.update({
        where: { id: poa.id },
        data: {
          status: "FOREIGN_OFFICE_VERIFIED",
          foreignOfficeMission: mission,
          foreignOfficeCity: city || null,
          foreignOfficeAttestationNo: attestationNo,
          foreignOfficeVerifiedAt: verifiedAt,
        },
      }),
      prisma.powerOfAttorneyStep.create({
        data: {
          powerOfAttorneyId: poa.id,
          stepType: "FOREIGN_OFFICE",
          occurredAt: verifiedAt,
          officeName: [mission, city].filter(Boolean).join(" · "),
          certificateNo: attestationNo,
          recordedById: session.user.id,
          documentId: doc.id,
        },
      }),
    ]);

    await writeAuditLog({
      userId: session.user.id,
      action: "POA_FOREIGN_OFFICE_VERIFIED",
      module: "poa",
      recordId: poa.id,
      plotId: poa.plotId,
      newValue: { mission, attestationNo },
    });
    revalidatePoa(poa.id, poa.plotId);
    redirect(returnPath);
  } catch (err) {
    if (isNextNavigationError(err)) throw err;
    redirectWithError(returnPath, getErrorMessage(err));
  }
}

export async function presentPowerOfAttorneyToSociety(formData: FormData) {
  const poaId = String(formData.get("poaId") || "").trim();
  const returnPath = poaId ? `/poa/${poaId}` : "/poa";
  try {
    const session = await auth();
    if (!session?.user) redirectWithError(returnPath, "Sign in.");
    if (!canRegisterPoa(session.user.role)) redirectWithError(returnPath, "Not permitted.");

    const presentedAtRaw = String(formData.get("presentedAt") || "").trim();
    const notes = String(formData.get("presentationNotes") || "").trim() || null;
    const plotDocs = asFile(formData.get("plotDocumentsScan"));
    const presentedAt = presentedAtRaw ? new Date(presentedAtRaw) : new Date();
    if (Number.isNaN(presentedAt.getTime())) redirectWithError(returnPath, "Presented date is invalid.");

    const poa = await prisma.powerOfAttorney.findUnique({
      where: { id: poaId },
      include: {
        documents: { where: { status: "ACTIVE" }, select: { documentType: true } },
      },
    });
    if (!poa) redirectWithError("/poa", "PoA not found.");

    const abroad = foreignOfficeRequired(poa);
    const expected = abroad ? "FOREIGN_OFFICE_VERIFIED" : "TEHSILDAR_VERIFIED";
    if (poa.status !== expected) {
      redirectWithError(
        returnPath,
        abroad
          ? "Present to society after Tehsildar and Foreign Office verification."
          : "Present to society after Tehsildar verification."
      );
    }

    const hasAttorneyCnic = poa.documents.some((d) => d.documentType === "POA_ATTORNEY_CNIC");
    if (!hasAttorneyCnic) {
      redirectWithError(returnPath, "Attorney CNIC scans must be on file before society can receive the PoA.");
    }

    let plotDocId: string | undefined;
    if (plotDocs) {
      const doc = await createDocumentWithUpload({
        plotId: poa.plotId,
        ownershipId: poa.ownershipId,
        powerOfAttorneyId: poa.id,
        documentType: "POA_PLOT_DOCUMENTS",
        title: `Plot documents presented with PoA ${poa.poaNumber}`,
        uploadedById: session.user.id,
        file: plotDocs,
      });
      plotDocId = doc.id;
    }

    await prisma.$transaction([
      prisma.powerOfAttorney.update({
        where: { id: poa.id },
        data: {
          status: "ACCEPTED_BY_SOCIETY",
          presentedAt,
          receivedById: session.user.id,
        },
      }),
      prisma.powerOfAttorneyStep.create({
        data: {
          powerOfAttorneyId: poa.id,
          stepType: "PRESENTED_TO_SOCIETY",
          occurredAt: presentedAt,
          notes: notes ?? "Original + scans received at society office",
          recordedById: session.user.id,
          documentId: plotDocId,
        },
      }),
    ]);

    await writeAuditLog({
      userId: session.user.id,
      action: "POA_PRESENTED_TO_SOCIETY",
      module: "poa",
      recordId: poa.id,
      plotId: poa.plotId,
      newValue: { receivedById: session.user.id, presentedAt },
    });
    revalidatePoa(poa.id, poa.plotId);
    redirect(returnPath);
  } catch (err) {
    if (isNextNavigationError(err)) throw err;
    redirectWithError(returnPath, getErrorMessage(err));
  }
}

export async function activatePowerOfAttorney(formData: FormData) {
  const poaId = String(formData.get("poaId") || "").trim();
  const returnPath = poaId ? `/poa/${poaId}` : "/poa";
  try {
    const session = await auth();
    if (!session?.user) redirectWithError(returnPath, "Sign in.");
    if (!canRegisterPoa(session.user.role)) redirectWithError(returnPath, "Not permitted.");

    const poa = await prisma.powerOfAttorney.findUnique({ where: { id: poaId } });
    if (!poa) redirectWithError("/poa", "PoA not found.");
    if (poa.status !== "ACCEPTED_BY_SOCIETY") {
      redirectWithError(returnPath, "Activate only after society has received the original and scans.");
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.powerOfAttorney.update({
        where: { id: poa.id },
        data: { status: "ACTIVE", validFrom: poa.validFrom ?? now },
      }),
      prisma.powerOfAttorneyStep.create({
        data: {
          powerOfAttorneyId: poa.id,
          stepType: "ACTIVATED",
          occurredAt: now,
          notes: "Active — attorney may appear for the stated purpose",
          recordedById: session.user.id,
        },
      }),
    ]);

    await writeAuditLog({
      userId: session.user.id,
      action: "POA_ACTIVATED",
      module: "poa",
      recordId: poa.id,
      plotId: poa.plotId,
    });
    revalidatePoa(poa.id, poa.plotId);
    redirect(returnPath);
  } catch (err) {
    if (isNextNavigationError(err)) throw err;
    redirectWithError(returnPath, getErrorMessage(err));
  }
}

export async function revokePowerOfAttorney(formData: FormData) {
  const poaId = String(formData.get("poaId") || "").trim();
  const returnPath = poaId ? `/poa/${poaId}` : "/poa";
  try {
    const session = await auth();
    if (!session?.user) redirectWithError(returnPath, "Sign in.");
    if (!canRegisterPoa(session.user.role)) redirectWithError(returnPath, "Not permitted.");

    const reason = String(formData.get("revocationReason") || "").trim();
    if (!reason) redirectWithError(returnPath, "Give a revocation reason.");

    const poa = await prisma.powerOfAttorney.findUnique({ where: { id: poaId } });
    if (!poa) redirectWithError("/poa", "PoA not found.");
    if (poa.status === "REVOKED" || poa.status === "EXPIRED") {
      redirectWithError(returnPath, "This PoA is already closed.");
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.powerOfAttorney.update({
        where: { id: poa.id },
        data: { status: "REVOKED", revokedAt: now, revocationReason: reason },
      }),
      prisma.powerOfAttorneyStep.create({
        data: {
          powerOfAttorneyId: poa.id,
          stepType: "REVOKED",
          occurredAt: now,
          notes: reason,
          recordedById: session.user.id,
        },
      }),
    ]);

    await writeAuditLog({
      userId: session.user.id,
      action: "POA_REVOKED",
      module: "poa",
      recordId: poa.id,
      plotId: poa.plotId,
      reason,
    });
    revalidatePoa(poa.id, poa.plotId);
    redirect(returnPath);
  } catch (err) {
    if (isNextNavigationError(err)) throw err;
    redirectWithError(returnPath, getErrorMessage(err));
  }
}
