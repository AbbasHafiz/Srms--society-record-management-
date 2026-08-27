import { handlers } from "@/lib/auth";
import { withPublicRequestUrl } from "@/lib/request-origin";
import type { NextRequest } from "next/server";

export async function GET(req: NextRequest) {
  return handlers.GET(withPublicRequestUrl(req));
}

export async function POST(req: NextRequest) {
  return handlers.POST(withPublicRequestUrl(req));
}
