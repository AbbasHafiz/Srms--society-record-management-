"use server";

import { auth } from "@/lib/auth";
import { hasPermission } from "@/lib/rbac";
import { emptyPreview, readExcelFileFromFormData } from "@/lib/excel";
import { commitEmployeeExcel, previewEmployeeExcel } from "@/lib/employees-excel";
import type { ExcelCommitResult, ExcelPreviewResult } from "@/lib/excel";
import { revalidatePath } from "next/cache";

async function requireEmployeeManage() {
  const session = await auth();
  if (!session?.user) throw new Error("Sign in to import staff.");
  if (!hasPermission(session.user.role, "manage_employees")) {
    throw new Error("You do not have permission to add staff from Excel.");
  }
  return session.user;
}

export async function previewEmployeesExcelAction(formData: FormData): Promise<ExcelPreviewResult> {
  try {
    await requireEmployeeManage();
    const buffer = await readExcelFileFromFormData(formData);
    return await previewEmployeeExcel(buffer);
  } catch (err) {
    return emptyPreview(err instanceof Error ? err.message : "Could not read that spreadsheet.");
  }
}

export async function commitEmployeesExcelAction(formData: FormData): Promise<ExcelCommitResult> {
  try {
    const user = await requireEmployeeManage();
    const buffer = await readExcelFileFromFormData(formData);
    const result = await commitEmployeeExcel(buffer, user.id);
    revalidatePath("/employees");
    revalidatePath("/hr");
    revalidatePath("/attendance");
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
