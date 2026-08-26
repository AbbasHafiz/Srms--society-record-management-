"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { hasPermission } from "@/lib/rbac";
import { nextOpenFileNumber } from "@/lib/numbering";
import { writeAuditLog } from "@/lib/audit";
import { assignRegisteredOfficeToOpenFile } from "@/app/(app)/offices/actions";

export async function createOpenFile(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "create")) throw new Error("Permission denied");

  const plotId = String(formData.get("plotId") || "").trim();
  const registeredOfficeId = String(formData.get("registeredOfficeId") || "").trim() || null;
  const sellerName = String(formData.get("sellerName") || "").trim();
  const sellerCnic = String(formData.get("sellerCnic") || "").trim();
  const sellerMembershipNo = String(formData.get("sellerMembershipNo") || "").trim() || null;
  const dealerName = String(formData.get("dealerName") || "").trim();
  const dealerOffice = String(formData.get("dealerOffice") || "").trim() || null;
  const trdNumber = String(formData.get("trdNumber") || "").trim() || null;
  const openingDate = new Date(String(formData.get("openingDate") || ""));
  const periodMonths = Number(formData.get("periodMonths") || 3);
  const remarks = String(formData.get("remarks") || "").trim() || null;

  if (!plotId || !sellerName || !sellerCnic || !dealerName || Number.isNaN(openingDate.getTime())) {
    throw new Error("Plot, seller, dealer, and opening date are required");
  }

  const plot = await prisma.plot.findUnique({
    where: { id: plotId },
    include: { ownerships: { where: { status: "ACTIVE" }, take: 1 } },
  });
  if (!plot) throw new Error("Plot not found");

  const activeFee = await prisma.feeConfiguration.findFirst({
    where: { feeType: "OPEN_FILE", status: "ACTIVE" },
    orderBy: { effectiveFrom: "desc" },
  });
  if (!activeFee) throw new Error("No active open-file fee configured");

  const months = activeFee.periodMonths || periodMonths || 3;
  const expiryDate = new Date(openingDate);
  expiryDate.setMonth(expiryDate.getMonth() + months);

  let resolvedDealerName = dealerName;
  let resolvedDealerOffice = dealerOffice;
  if (registeredOfficeId) {
    const office = await prisma.registeredOffice.findUnique({ where: { id: registeredOfficeId } });
    if (!office) throw new Error("Registered office not found");
    resolvedDealerName = office.officeName;
    resolvedDealerOffice = office.address ?? office.ownerName;
  }

  const openFileNumber = await nextOpenFileNumber();
  const ownershipId = plot.ownerships[0]?.id ?? null;

  const openFile = await prisma.openFile.create({
    data: {
      openFileNumber,
      plotId,
      ownershipId,
      registeredOfficeId,
      sellerName,
      sellerCnic,
      sellerMembershipNo,
      dealerName: resolvedDealerName,
      dealerOffice: resolvedDealerOffice,
      trdNumber,
      openingDate,
      expiryDate,
      periodMonths: months,
      feeAmount: activeFee.amount,
      feeConfigId: activeFee.id,
      paymentStatus: "PENDING",
      status: "ACTIVE",
      remarks,
    },
  });

  await prisma.plot.update({
    where: { id: plotId },
    data: { hasOpenFile: true },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "OPEN_FILE_CREATED",
    module: "open-files",
    recordId: openFile.id,
    plotId,
    newValue: { openFileNumber, registeredOfficeId, dealerName: resolvedDealerName },
  });

  revalidatePath("/open-files");
  revalidatePath(`/plots/${plotId}`);
  redirect(`/open-files/${openFile.id}`);
}

export { assignRegisteredOfficeToOpenFile };
