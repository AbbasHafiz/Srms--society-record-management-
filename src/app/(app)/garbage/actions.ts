"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";
import type { GarbageCollectionStatus } from "@/generated/prisma/client";

function parseDate(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error("Invalid date");
  return d;
}

export async function createGarbageCollection(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const collectionDate = parseDate(formData.get("collectionDate") as string);
  const area = (formData.get("area") as string)?.trim();
  const street = (formData.get("street") as string)?.trim() || undefined;
  const houseNo = (formData.get("houseNo") as string)?.trim() || undefined;
  const collectorId = (formData.get("collectorId") as string)?.trim();
  const remarks = (formData.get("remarks") as string)?.trim() || undefined;

  if (!area || !collectorId) throw new Error("Area and collector are required");

  const created = await prisma.garbageCollection.create({
    data: {
      collectionDate,
      area,
      street,
      houseNo,
      collectorId,
      remarks,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "GARBAGE_COLLECTION_CREATED",
    module: "garbage",
    recordId: created.id,
    newValue: { area, street, houseNo, collectorId, collectionDate: collectionDate.toISOString() },
  });

  revalidatePath("/garbage");
}

export async function updateGarbageCollectionStatus(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const id = formData.get("id") as string;
  const status = formData.get("status") as GarbageCollectionStatus;
  if (!id || !status) throw new Error("Invalid request");

  const existing = await prisma.garbageCollection.findUnique({ where: { id } });
  if (!existing) throw new Error("Collection round not found");

  await prisma.garbageCollection.update({
    where: { id },
    data: { status },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "GARBAGE_COLLECTION_UPDATED",
    module: "garbage",
    recordId: id,
    oldValue: { status: existing.status },
    newValue: { status },
  });

  revalidatePath("/garbage");
}
