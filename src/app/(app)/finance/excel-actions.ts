"use server";

import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { emptyPreview, readExcelFileFromFormData } from "@/lib/excel";
import { commitFinanceExcel, previewFinanceExcel } from "@/lib/finance-excel";
import type { ExcelCommitResult, ExcelPreviewResult } from "@/lib/excel";
import { revalidatePath } from "next/cache";

async function requireFinanceManage() {
  const session = await auth();
  if (!session?.user) throw new Error("Sign in to import the ledger.");
  if (!hasPermission(session.user.role, "manage_finance")) {
    throw new Error("You do not have permission to add ledger entries from Excel.");
  }
  return session.user;
}

export async function previewFinanceExcelAction(formData: FormData): Promise<ExcelPreviewResult> {
  try {
    await requireFinanceManage();
    const buffer = await readExcelFileFromFormData(formData);
    return await previewFinanceExcel(buffer);
  } catch (err) {
    return emptyPreview(err instanceof Error ? err.message : "Could not read that spreadsheet.");
  }
}

export async function commitFinanceExcelAction(formData: FormData): Promise<ExcelCommitResult> {
  try {
    const user = await requireFinanceManage();
    const buffer = await readExcelFileFromFormData(formData);
    const allowDuplicates = String(formData.get("allowDuplicates") ?? "") === "1";
    const result = await commitFinanceExcel(buffer, user.id, { allowDuplicates });
    if (result.imported > 0) revalidatePath("/finance");
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
