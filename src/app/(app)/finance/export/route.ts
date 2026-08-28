import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessModule } from "@/lib/rbac";
import { buildWorkbookBuffer, xlsxResponse } from "@/lib/excel";
import { FINANCE_EXCEL_COLUMNS, loadFinanceExcelRows } from "@/lib/finance-excel";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !canAccessModule(session.user.role, "finance")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const sp = req.nextUrl.searchParams;
  const buffer = await buildWorkbookBuffer({
    sheetName: "Ledger",
    columns: FINANCE_EXCEL_COLUMNS,
    rows: await loadFinanceExcelRows({
      tab: sp.get("tab") ?? undefined,
      status: sp.get("status") ?? undefined,
      categoryId: sp.get("categoryId") ?? undefined,
      from: sp.get("from") ?? undefined,
      to: sp.get("to") ?? undefined,
    }),
  });

  const stamp = new Date().toISOString().slice(0, 10);
  return xlsxResponse(buffer, `finance-ledger-${stamp}.xlsx`);
}
