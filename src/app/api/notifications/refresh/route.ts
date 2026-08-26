import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { refreshSlaNotifications } from "@/lib/notifications-sla";

export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await refreshSlaNotifications();
  return NextResponse.json(result);
}
