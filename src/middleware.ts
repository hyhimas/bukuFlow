import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get("bukuflow_session");
  const isAuthenticated = Boolean(sessionCookie?.value);

  const { pathname } = request.nextUrl;

  const isProtectedPath =
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/loans") ||
    pathname.startsWith("/returns") ||
    pathname.startsWith("/transactions") ||
    pathname.startsWith("/master");

  const isAuthPath = pathname.startsWith("/login");

  if (isProtectedPath && !isAuthenticated) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthPath && isAuthenticated) {
    const dashboardUrl = new URL("/dashboard", request.url);
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/loans/:path*",
    "/returns/:path*",
    "/transactions/:path*",
    "/master/:path*",
    "/login",
  ],
};