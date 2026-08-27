"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/rbac";
import {
  FBR_TAX_RATE_DEFAULTS,
  FBR_TAX_RATE_KEYS,
  clearFbrTaxRatesCache,
  parseRatePercent,
} from "@/lib/fbr-tax";

export async function updateFbrTaxRates(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (
    !hasPermission(session.user.role, "manage_settings") &&
    !hasPermission(session.user.role, "configure_fees")
  ) {
    throw new Error("Forbidden");
  }

  const saved: Record<string, string> = {};
  for (const key of Object.values(FBR_TAX_RATE_KEYS)) {
    const meta = FBR_TAX_RATE_DEFAULTS[key];
    const value = parseRatePercent(formData.get(key), meta.label);
    const asText = String(value);
    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: asText, label: meta.label },
      update: { value: asText, label: meta.label },
    });
    saved[key] = asText;
  }

  clearFbrTaxRatesCache();

  await writeAuditLog({
    userId: session.user.id,
    action: "FBR_TAX_RATES_UPDATED",
    module: "settings",
    newValue: saved,
  });

  revalidatePath("/settings");
  revalidatePath("/transfers");
  revalidatePath("/open-files");
}
