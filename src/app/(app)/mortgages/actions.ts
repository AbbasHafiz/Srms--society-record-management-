"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { createDocumentWithUpload } from "@/lib/documents";
import { hasPermission } from "@/lib/rbac";
import type { MortgageStatus } from "@/generated/prisma/client";

export async function createMortgage(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "create")) throw new Error("Forbidden");

  const plotId = String(formData.get("plotId") || "");
  const bankName = String(formData.get("bankName") || "").trim();
  const loanReference = String(formData.get("loanReference") || "").trim() || null;
  const mortgageDateRaw = String(formData.get("mortgageDate") || "").trim();
  const status = String(formData.get("status") || "PENDING") as MortgageStatus;
  const remarks = String(formData.get("remarks") || "").trim() || null;
  const file = formData.get("file");

  if (!plotId || !bankName) throw new Error("Plot and bank name are required");
  if (!["PENDING", "ACTIVE"].includes(status)) throw new Error("Invalid status for new mortgage");

  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    include: { ownerships: { where: { status: "ACTIVE" }, take: 1 } },
  });
  if (!plot) throw new Error("Plot not found");

  const owner = plot.ownerships[0];
  const mortgageDate = mortgageDateRaw ? new Date(mortgageDateRaw) : new Date();

  const mortgage = await prisma.mortgage.create({
    data: {
      plotId,
      ownershipId: owner?.id,
      bankName,
      loanReference,
      mortgageDate,
      status,
      remarks,
    },
  });

  if (status === "ACTIVE") {
    await prisma.plot.update({
      where: { id: plotId },
      data: { hasActiveMortgage: true },
    });
  }

  if (file instanceof File && file.size > 0) {
    await createDocumentWithUpload({
      plotId,
      ownershipId: owner?.id,
      mortgageId: mortgage.id,
      documentType: "MORTGAGE_LETTER",
      title: `Mortgage letter — ${bankName}`,
      uploadedById: session.user.id,
      file,
    });
  }

  await writeAuditLog({
    userId: session.user.id,
    action: "MORTGAGE_CREATED",
    module: "mortgages",
    recordId: mortgage.id,
    plotId,
    newValue: { bankName, loanReference, status },
  });

  revalidatePath("/mortgages");
  revalidatePath(`/plots/${plotId}`);
  redirect(`/mortgages/${mortgage.id}`);
}

export async function releaseMortgage(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "approve") && !hasPermission(session.user.role, "edit")) {
    throw new Error("Forbidden");
  }

  const mortgageId = String(formData.get("mortgageId") || "");
  const releaseDateRaw = String(formData.get("releaseDate") || "").trim();
  const remarks = String(formData.get("remarks") || "").trim() || null;
  const file = formData.get("file");

  if (!mortgageId) throw new Error("Mortgage id required");

  const existing = await prisma.mortgage.findUnique({ where: { id: mortgageId } });
  if (!existing) throw new Error("Mortgage not found");
  if (existing.status === "RELEASED") throw new Error("Mortgage already released");
  if (!["PENDING", "ACTIVE"].includes(existing.status)) {
    throw new Error("Mortgage cannot be released in current status");
  }

  const releaseDate = releaseDateRaw ? new Date(releaseDateRaw) : new Date();

  await prisma.mortgage.update({
    where: { id: mortgageId },
    data: {
      status: "RELEASED",
      releaseDate,
      remarks: remarks ?? existing.remarks,
    },
  });

  const otherActive = await prisma.mortgage.count({
    where: { plotId: existing.plotId, status: "ACTIVE", id: { not: mortgageId } },
  });

  if (otherActive === 0) {
    await prisma.plot.update({
      where: { id: existing.plotId },
      data: { hasActiveMortgage: false },
    });
  }

  if (file instanceof File && file.size > 0) {
    await createDocumentWithUpload({
      plotId: existing.plotId,
      ownershipId: existing.ownershipId,
      mortgageId: existing.id,
      documentType: "BANK_NOC",
      title: `Bank release / NOC — ${existing.bankName}`,
      issueDate: releaseDate,
      uploadedById: session.user.id,
      file,
    });
  }

  await writeAuditLog({
    userId: session.user.id,
    action: "MORTGAGE_RELEASED",
    module: "mortgages",
    recordId: mortgageId,
    plotId: existing.plotId,
    oldValue: { status: existing.status },
    newValue: { status: "RELEASED", releaseDate: releaseDate.toISOString() },
    reason: remarks,
  });

  revalidatePath("/mortgages");
  revalidatePath(`/mortgages/${mortgageId}`);
  revalidatePath(`/plots/${existing.plotId}`);
  revalidatePath("/documents");
}
