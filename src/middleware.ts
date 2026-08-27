import NextAuth from "next-auth";
import { authConfig } from "@/lib/auth.config";
import { canAccessPath } from "@/lib/rbac";
import { getPostLoginPath } from "@/lib/auth-redirect";
import { publicUrl } from "@/lib/request-origin";
import { NextResponse } from "next/server";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (pathname.startsWith("/login")) {
    if (session?.user) {
      const next = req.nextUrl.searchParams.get("next");
      const safeNext =
        next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/login")
          ? next
          : getPostLoginPath(session.user.role);
      return NextResponse.redirect(publicUrl(req, safeNext));
    }
    return NextResponse.next();
  }

  if (!session?.user) {
    return NextResponse.redirect(publicUrl(req, "/login", { next: pathname }));
  }

  if (!canAccessPath(session.user.role, pathname)) {
    return NextResponse.redirect(publicUrl(req, getPostLoginPath(session.user.role)));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
