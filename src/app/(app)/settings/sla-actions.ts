"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAuditLog } from "@/lib/audit";
import { hasPermission } from "@/lib/rbac";
import { SLA_DEFAULTS, clearSlaCache } from "@/lib/sla";

export async function updateSlaSettings(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (
    !hasPermission(session.user.role, "manage_settings") &&
    !hasPermission(session.user.role, "configure_fees")
  ) {
    throw new Error("Forbidden");
  }

  for (const [key, meta] of Object.entries(SLA_DEFAULTS)) {
    const raw = formData.get(key);
    if (raw == null || raw === "") continue;
    const value = Number(raw);
    if (!Number.isFinite(value) || value < 1) {
      throw new Error(`Invalid SLA days for ${meta.label}`);
    }

    await prisma.systemSetting.upsert({
      where: { key },
      create: { key, value: String(value), label: meta.label },
      update: { value: String(value), label: meta.label },
    });
  }

  clearSlaCache();

  await writeAuditLog({
    userId: session.user.id,
    action: "SLA_SETTINGS_UPDATED",
    module: "settings",
    newValue: Object.fromEntries(
      Object.entries(SLA_DEFAULTS).map(([key]) => [key, String(formData.get(key) ?? "")])
    ),
  });

  revalidatePath("/settings");
  revalidatePath("/dashboard");
  revalidatePath("/transfers");
}
