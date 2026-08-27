import { NextRequest } from "next/server";
import type { NextRequest as NextRequestType } from "next/server";

/** Preserve the browser-facing host (e.g. 127.0.0.1) instead of Next dev server's localhost. */
export function resolvePublicOrigin(req: NextRequestType): string {
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const proto =
    req.headers.get("x-forwarded-proto") ??
    req.nextUrl.protocol.replace(":", "") ??
    "http";

  if (host) return `${proto}://${host}`;

  return req.nextUrl.origin;
}

/** Rewrite req.url so Auth.js callback-url cookies use the browser-facing origin. */
export function withPublicRequestUrl(req: NextRequestType): NextRequest {
  const origin = resolvePublicOrigin(req);
  const path = req.nextUrl.pathname + req.nextUrl.search;
  return new NextRequest(new URL(path, origin), req);
}

export function publicUrl(req: NextRequestType, pathname: string, searchParams?: Record<string, string>): URL {
  const url = new URL(pathname, resolvePublicOrigin(req));
  if (searchParams) {
    for (const [key, value] of Object.entries(searchParams)) {
      url.searchParams.set(key, value);
    }
  }
  return url;
}
