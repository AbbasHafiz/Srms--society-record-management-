"use server";

import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { emptyPreview, readExcelFileFromFormData } from "@/lib/excel";
import { commitPlotExcel, previewPlotExcel } from "@/lib/plots-excel";
import type { ExcelCommitResult, ExcelPreviewResult } from "@/lib/excel";
import { revalidatePath } from "next/cache";

async function requirePlotCreate() {
  const session = await auth();
  if (!session?.user) throw new Error("Sign in to import the plot register.");
  if (!hasPermission(session.user.role, "create")) {
    throw new Error("You do not have permission to add plots from Excel.");
  }
  return session.user;
}

export async function previewPlotsExcelAction(formData: FormData): Promise<ExcelPreviewResult> {
  try {
    await requirePlotCreate();
    const buffer = await readExcelFileFromFormData(formData);
    return await previewPlotExcel(buffer);
  } catch (err) {
    return emptyPreview(err instanceof Error ? err.message : "Could not read that spreadsheet.");
  }
}

export async function commitPlotsExcelAction(formData: FormData): Promise<ExcelCommitResult> {
  try {
    const user = await requirePlotCreate();
    const buffer = await readExcelFileFromFormData(formData);
    const result = await commitPlotExcel(buffer, user.id);
    revalidatePath("/plots");
    revalidatePath("/memberships");
    revalidatePath("/owners");
    return result;
  } catch (err) {
    return {
      ok: false,
      imported: 0,
      skipped: 0,
      errors: [],
      message: err instanceof Error ? err.message : "Import failed.",
    };
  }
}
