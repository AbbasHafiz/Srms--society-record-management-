import { auth } from "@/lib/auth";
import { canAccessPath } from "@/lib/rbac";
import { getPostLoginPath } from "@/lib/auth-redirect";
import { NextResponse } from "next/server";

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  if (pathname.startsWith("/login")) {
    if (session?.user) {
      return NextResponse.redirect(new URL(getPostLoginPath(session.user.role), req.url));
    }
    return NextResponse.next();
  }

  if (!session?.user) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (!canAccessPath(session.user.role, pathname)) {
    return NextResponse.redirect(new URL(getPostLoginPath(session.user.role), req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
