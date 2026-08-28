import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessModule } from "@/lib/rbac";
import { buildWorkbookBuffer, xlsxResponse } from "@/lib/excel";
import { loadPlotExcelRows, PLOT_EXCEL_COLUMNS } from "@/lib/plots-excel";
import {
  loadMembershipExcelRows,
  loadOwnershipExcelRows,
  MEMBERSHIP_EXCEL_COLUMNS,
  OWNERSHIP_EXCEL_COLUMNS,
} from "@/lib/memberships-excel";
import { EMPLOYEE_EXCEL_COLUMNS, loadEmployeeExcelRows } from "@/lib/employees-excel";
import { loadPaymentExcelRows, PAYMENT_EXCEL_COLUMNS } from "@/lib/payments-excel";
import { loadTransferExcelRows, TRANSFER_EXCEL_COLUMNS } from "@/lib/transfers-excel";
import { loadOpenFileExcelRows, OPEN_FILE_EXCEL_COLUMNS } from "@/lib/open-files-excel";
import { ATTENDANCE_EXCEL_COLUMNS, loadAttendanceExcelRows } from "@/lib/attendance-excel";
import { loadTankerExcelRows, TANKER_EXCEL_COLUMNS } from "@/lib/tankers-excel";
import { FINANCE_EXCEL_COLUMNS, buildFinanceTemplateBuffer, loadFinanceExcelRows } from "@/lib/finance-excel";

export const dynamic = "force-dynamic";

const MODULE_ACCESS: Record<string, string> = {
  plots: "plots",
  memberships: "memberships",
  owners: "plots",
  employees: "employees",
  payments: "payments",
  transfers: "transfers",
  "open-files": "open-files",
  attendance: "attendance",
  tankers: "tankers",
  finance: "finance",
};

export async function GET(req: NextRequest) {
  const session = await auth();
  const moduleKey = req.nextUrl.searchParams.get("module") ?? "";
  const accessModule = MODULE_ACCESS[moduleKey];
  if (!session?.user || !accessModule || !canAccessModule(session.user.role, accessModule)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const template = req.nextUrl.searchParams.get("template") === "1";
  const sp = Object.fromEntries(req.nextUrl.searchParams.entries());

  try {
    const built = await buildModuleWorkbook(moduleKey, sp, template);
    if (!built) {
      return NextResponse.json({ error: "Unknown register" }, { status: 400 });
    }
    return xlsxResponse(built.buffer, built.filename);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not build Excel file." },
      { status: 500 }
    );
  }
}

async function buildModuleWorkbook(
  moduleKey: string,
  sp: Record<string, string>,
  template: boolean
) {
  switch (moduleKey) {
    case "plots":
      return {
        filename: template ? "plots-import-template.xlsx" : "plots-register.xlsx",
        buffer: await buildWorkbookBuffer({
          sheetName: "Plots",
          columns: PLOT_EXCEL_COLUMNS,
          rows: template ? [] : await loadPlotExcelRows(sp),
        }),
      };
    case "memberships":
      return {
        filename: template ? "plots-import-template.xlsx" : "membership-register.xlsx",
        buffer: await buildWorkbookBuffer({
          sheetName: template ? "Plots" : "Memberships",
          columns: template ? PLOT_EXCEL_COLUMNS : MEMBERSHIP_EXCEL_COLUMNS,
          rows: template ? [] : await loadMembershipExcelRows(sp),
        }),
      };
    case "owners":
      return {
        filename: "ownership-register.xlsx",
        buffer: await buildWorkbookBuffer({
          sheetName: "Ownership",
          columns: OWNERSHIP_EXCEL_COLUMNS,
          rows: await loadOwnershipExcelRows(sp),
        }),
      };
    case "employees":
      return {
        filename: template ? "employees-import-template.xlsx" : "employees-register.xlsx",
        buffer: await buildWorkbookBuffer({
          sheetName: "Employees",
          columns: EMPLOYEE_EXCEL_COLUMNS,
          rows: template ? [] : await loadEmployeeExcelRows(sp),
        }),
      };
    case "payments":
      return {
        filename: "payments.xlsx",
        buffer: await buildWorkbookBuffer({
          sheetName: "Payments",
          columns: PAYMENT_EXCEL_COLUMNS,
          rows: await loadPaymentExcelRows(sp),
        }),
      };
    case "transfers":
      return {
        filename: "transfers.xlsx",
        buffer: await buildWorkbookBuffer({
          sheetName: "Transfers",
          columns: TRANSFER_EXCEL_COLUMNS,
          rows: await loadTransferExcelRows(sp),
        }),
      };
    case "open-files":
      return {
        filename: "open-files.xlsx",
        buffer: await buildWorkbookBuffer({
          sheetName: "Open files",
          columns: OPEN_FILE_EXCEL_COLUMNS,
          rows: await loadOpenFileExcelRows(sp),
        }),
      };
    case "attendance":
      return {
        filename: "attendance.xlsx",
        buffer: await buildWorkbookBuffer({
          sheetName: "Attendance",
          columns: ATTENDANCE_EXCEL_COLUMNS,
          rows: await loadAttendanceExcelRows(),
        }),
      };
    case "tankers":
      return {
        filename: "tanker-schedule.xlsx",
        buffer: await buildWorkbookBuffer({
          sheetName: "Tankers",
          columns: TANKER_EXCEL_COLUMNS,
          rows: await loadTankerExcelRows(sp),
        }),
      };
    case "finance":
      return {
        filename: template ? "finance-import-template.xlsx" : "finance-ledger.xlsx",
        buffer: template
          ? await buildFinanceTemplateBuffer()
          : await buildWorkbookBuffer({
              sheetName: "Ledger",
              columns: FINANCE_EXCEL_COLUMNS,
              rows: await loadFinanceExcelRows(sp),
            }),
      };
    default:
      return null;
  }
}
