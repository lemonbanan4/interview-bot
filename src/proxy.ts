import { auth } from "@/auth";
import { NextResponse } from "next/server";

/**
 * Next.js 16 proxy (replaces middleware) — redirects unauthenticated
 * visitors away from /dashboard and /session.
 */
export const proxy = auth((req) => {
  const { pathname } = req.nextUrl;
  const isProtected =
    pathname.startsWith("/dashboard") || pathname.startsWith("/session");

  if (isProtected && !req.auth) {
    const login = new URL("/login", req.nextUrl.origin);
    login.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(login);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/session/:path*"],
};
