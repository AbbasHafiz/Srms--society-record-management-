import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { canAccessModule } from "@/lib/rbac";
import { xlsxResponse } from "@/lib/excel";
import { buildFinanceTemplateBuffer } from "@/lib/finance-excel";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || !canAccessModule(session.user.role, "finance")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const buffer = await buildFinanceTemplateBuffer();
  return xlsxResponse(buffer, "finance-import-template.xlsx");
}
