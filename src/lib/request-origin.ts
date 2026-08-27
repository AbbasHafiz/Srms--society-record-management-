import type { NextRequest } from "next/server";

/** Preserve the browser-facing host (e.g. 127.0.0.1) instead of Next dev server's localhost. */
export function resolvePublicOrigin(req: NextRequest): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto =
    req.headers.get("x-forwarded-proto") ??
    req.nextUrl.protocol.replace(":", "") ??
    "http";

  if (host) return `${proto}://${host}`;

  return process.env.NEXTAUTH_URL ?? process.env.AUTH_URL ?? req.nextUrl.origin;
}

export function publicUrl(req: NextRequest, pathname: string, searchParams?: Record<string, string>): URL {
  const url = new URL(pathname, resolvePublicOrigin(req));
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}
