import { NextResponse, type NextRequest } from "next/server";
import { signOut } from "@/lib/auth";
import { publicUrl } from "@/lib/request-origin";

export async function POST(req: NextRequest) {
  await signOut({ redirect: false });
  return NextResponse.redirect(publicUrl(req, "/login"), {
    status: 303,
  });
}
