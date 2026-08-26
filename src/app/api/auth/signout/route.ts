import { NextResponse } from "next/server";
import { signOut } from "@/lib/auth";

export async function POST() {
  await signOut({ redirect: false });
  return NextResponse.redirect(new URL("/login", process.env.NEXTAUTH_URL || "http://127.0.0.1:43127"), {
    status: 303,
  });
}
