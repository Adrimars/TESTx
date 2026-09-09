import { NextRequest, NextResponse } from "next/server";

/** Reachable only when signed out; a signed-in visitor is sent to the dashboard. */
const PUBLIC_PATHS = ["/login", "/register"];

/**
 * Reachable either way. Google Play requires the account-deletion path to work
 * for someone who has already uninstalled the app, so it must not redirect a
 * signed-out visitor - and a signed-in one needs it to actually delete.
 */
const OPEN_PATHS = ["/delete-account"];

/**
 * Device-based routing (18.4): on the same domain, phone browsers get the mobile-web
 * build (Expo static export) instead of this desktop app. Reads a manual override
 * cookie first - set by either app's "switch version" link (see /api/switch-device) -
 * so a phone that explicitly asked for the desktop experience is not immediately routed
 * straight back by its own user agent.
 */
const DEVICE_OVERRIDE_COOKIE = "testx_device";
const MOBILE_WEB_URL = process.env.MOBILE_WEB_URL ?? "http://localhost:8081";

/** This app's own API routes (including /api/switch-device itself) must always reach
 * this app's backend, never the mobile-web proxy target. */
const NEVER_PROXIED_PREFIXES = ["/api/"];

/** Phone-class user agents only (18.4) - a tablet stays on the desktop experience. */
const MOBILE_UA_PATTERN = /iPhone|iPod|Android.*Mobile|Windows Phone/i;

function wantsMobileWeb(request: NextRequest): boolean {
  const override = request.cookies.get(DEVICE_OVERRIDE_COOKIE)?.value;
  if (override === "desktop") return false;
  if (override === "mobile") return true;
  return MOBILE_UA_PATTERN.test(request.headers.get("user-agent") ?? "");
}

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (NEVER_PROXIED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  if (wantsMobileWeb(request)) {
    return NextResponse.rewrite(new URL(`${pathname}${search}`, MOBILE_WEB_URL));
  }

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
