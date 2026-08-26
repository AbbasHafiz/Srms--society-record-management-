"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import { nextTankerBulkPurchaseNumber } from "@/lib/numbering";
import { getPurchaseFilledLiters } from "@/lib/tankers";
import type { PaymentStatus } from "@/generated/prisma/client";

function parseDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return d;
}

export async function createBulkPurchase(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const sourceVendor = (formData.get("sourceVendor") as string)?.trim();
  const purchaseDate = parseDate(formData.get("purchaseDate") as string);
  const volumeLiters = Number(formData.get("volumeLiters"));
  const amount = Number(formData.get("amount"));
  const paymentStatus = (formData.get("paymentStatus") as PaymentStatus) || "PENDING";
  const motherTankerId = (formData.get("motherTankerId") as string)?.trim() || undefined;
  const remarks = (formData.get("remarks") as string)?.trim() || undefined;

  if (!sourceVendor || !purchaseDate || !volumeLiters || volumeLiters <= 0 || Number.isNaN(amount)) {
    throw new Error("Source/vendor, date, volume, and amount are required");
  }

  const purchaseNumber = await nextTankerBulkPurchaseNumber();

  const purchase = await prisma.tankerBulkPurchase.create({
    data: {
      purchaseNumber,
      purchaseDate,
      sourceVendor,
      volumeLiters,
      amount,
      paymentStatus,
      motherTankerId,
      remarks,
      createdById: session.user.id,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "TANKER_BULK_PURCHASE_CREATED",
    module: "tankers",
    recordId: purchase.id,
    newValue: {
      purchaseNumber,
      sourceVendor,
      volumeLiters,
      amount,
      paymentStatus,
      motherTankerId,
    },
  });

  revalidatePath("/tankers");
  revalidatePath("/tankers/stock");
}

export async function createTankerFill(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const purchaseId = (formData.get("purchaseId") as string)?.trim();
  const toTankerId = (formData.get("toTankerId") as string)?.trim();
  const volumeLiters = Number(formData.get("volumeLiters"));
  const remarks = (formData.get("remarks") as string)?.trim() || undefined;

  if (!purchaseId || !toTankerId || !volumeLiters || volumeLiters <= 0) {
    throw new Error("Purchase, tanker, and volume are required");
  }

  const [purchase, tanker] = await Promise.all([
    prisma.tankerBulkPurchase.findUnique({ where: { id: purchaseId } }),
    prisma.waterTanker.findUnique({ where: { id: toTankerId } }),
  ]);

  if (!purchase) throw new Error("Bulk purchase not found");
  if (!tanker || !tanker.isActive) throw new Error("Distribution tanker not found");
  if (tanker.tankerClass !== "DISTRIBUTION") {
    throw new Error("Water can only be filled into distribution tankers");
  }

  const filledLiters = await getPurchaseFilledLiters(purchaseId);
  const remaining = purchase.volumeLiters - filledLiters;

  if (volumeLiters > remaining) {
    throw new Error(
      `Cannot fill ${volumeLiters.toLocaleString()}L — only ${remaining.toLocaleString()}L remaining on ${purchase.purchaseNumber}`
    );
  }

  if (volumeLiters > tanker.capacityLiters) {
    throw new Error(
      `Fill volume (${volumeLiters.toLocaleString()}L) exceeds tanker capacity (${tanker.capacityLiters.toLocaleString()}L)`
    );
  }

  const fill = await prisma.tankerFill.create({
    data: {
      purchaseId,
      toTankerId,
      volumeLiters,
      filledById: session.user.id,
      remarks,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "TANKER_FILL_CREATED",
    module: "tankers",
    recordId: fill.id,
    newValue: {
      purchaseId,
      purchaseNumber: purchase.purchaseNumber,
      toTankerId,
      tankerCode: tanker.tankerCode,
      volumeLiters,
      remainingAfter: remaining - volumeLiters,
    },
  });

  revalidatePath("/tankers");
  revalidatePath("/tankers/stock");
}
