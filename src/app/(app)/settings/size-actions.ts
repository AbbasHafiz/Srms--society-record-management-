"use server";

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/rbac";
import { ALL_PLOT_TYPES } from "@/lib/plots";
import { ALL_SIZE_UNITS } from "@/lib/property-sizes";
import type { PlotType, PropertySizeUnit } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

export async function createPropertySizeOption(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "manage_settings") && !hasPermission(session.user.role, "configure_fees")) {
    throw new Error("Forbidden");
  }

  const propertyType = String(formData.get("propertyType") || "") as PlotType;
  const label = String(formData.get("label") || "").trim();
  const sizeValue = Number(formData.get("sizeValue"));
  const unit = String(formData.get("unit") || "SQ_YD") as PropertySizeUnit;
  const sizeMarlaRaw = String(formData.get("sizeMarla") || "").trim();
  const sortOrder = Number(formData.get("sortOrder") || 0);

  if (!ALL_PLOT_TYPES.includes(propertyType)) throw new Error("Invalid property type");
  if (!label || !sizeValue || sizeValue <= 0) throw new Error("Label and size are required");
  if (!ALL_SIZE_UNITS.includes(unit)) throw new Error("Invalid unit");

  const created = await prisma.propertySizeOption.create({
    data: {
      propertyType,
      label,
      sizeValue,
      unit,
      sizeMarla: sizeMarlaRaw ? Number(sizeMarlaRaw) : null,
      sortOrder: Number.isFinite(sortOrder) ? sortOrder : 0,
      isActive: true,
    },
  });

  await writeAuditLog({
    userId: session.user.id,
    action: "PROPERTY_SIZE_OPTION_CREATED",
    module: "settings",
    recordId: created.id,
    newValue: { label, propertyType, sizeValue, unit },
  });

  revalidatePath("/settings");
  revalidatePath("/plots/new");
}

export async function togglePropertySizeOption(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "manage_settings") && !hasPermission(session.user.role, "configure_fees")) {
    throw new Error("Forbidden");
  }

  const id = String(formData.get("id") || "");
  const option = await prisma.propertySizeOption.findUnique({ where: { id } });
  if (!option) throw new Error("Size option not found");

  await prisma.propertySizeOption.update({
    where: { id },
    data: { isActive: !option.isActive },
  });

  revalidatePath("/settings");
  revalidatePath("/plots/new");
}
