"use server";

import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { generateMonthlyPlotCharges, markPlotChargePaid } from "@/lib/charges";
import { revalidatePath } from "next/cache";

export async function generateChargesAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "verify_payment")) {
    throw new Error("You do not have permission to generate charges");
  }

  const year = Number(formData.get("year"));
  const month = Number(formData.get("month"));
  if (!year || !month || month < 1 || month > 12) {
    throw new Error("Valid year and month are required");
  }

  await generateMonthlyPlotCharges(year, month, session.user.id);
  revalidatePath("/annual-charges");
  revalidatePath("/dashboard");
}

export async function markChargePaidAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  if (!hasPermission(session.user.role, "verify_payment")) {
    throw new Error("You do not have permission to mark charges paid");
  }

  const chargeId = String(formData.get("chargeId") || "");
  if (!chargeId) throw new Error("Charge ID required");

  await markPlotChargePaid(chargeId, session.user.id);
  revalidatePath("/annual-charges");
  revalidatePath("/dashboard");
}
