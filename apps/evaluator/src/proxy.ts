import { NextRequest, NextResponse } from "next/server";

/** Reachable only when signed out; a signed-in visitor is sent to the dashboard. */
const PUBLIC_PATHS = ["/login", "/register"];

/**
 * Reachable either way. Google Play requires the account-deletion path to work
 * for someone who has already uninstalled the app, so it must not redirect a
 * signed-out visitor - and a signed-in one needs it to actually delete.
 */
const OPEN_PATHS = ["/delete-account"];

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get("access_token");

  if (OPEN_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  if (PUBLIC_PATHS.includes(pathname)) {
    if (token) return NextResponse.redirect(new URL("/dashboard", request.url));
    return NextResponse.next();
  }

  if (!token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
