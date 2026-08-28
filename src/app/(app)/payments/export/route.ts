import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessModule } from "@/lib/rbac";
import { buildWorkbookBuffer, xlsxResponse } from "@/lib/excel";
import { loadPaymentExcelRows, PAYMENT_EXCEL_COLUMNS } from "@/lib/payments-excel";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !canAccessModule(session.user.role, "payments")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const status = req.nextUrl.searchParams.get("status") ?? undefined;
  const buffer = await buildWorkbookBuffer({
    sheetName: "Payments",
    columns: PAYMENT_EXCEL_COLUMNS,
    rows: await loadPaymentExcelRows({ status }),
  });
  const stamp = new Date().toISOString().slice(0, 10);
  return xlsxResponse(buffer, `payments-${stamp}.xlsx`);
}
