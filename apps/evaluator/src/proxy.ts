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
 * Device-based routing (18.4, revised): every browser - phone or desktop - gets the
 * mobile-web build (Expo static export) by default; this app's own page-by-page pages
 * still exist but are only reachable via the manual override below. The desktop-native
 * pages predate the deck's swipe/drag/tutorial system and never got it, which is the
 * whole reason for this flip - one gesture engine and tutorial implementation instead of
 * two. Neither app links to `/api/switch-device` anymore (both "switch version" buttons
 * were removed once mobile-web became the default everywhere) - it's still live as a
 * manual/dev-only escape hatch (`/api/switch-device?to=desktop`) back to this app's own
 * pages, just not surfaced in either UI.
 */
const DEVICE_OVERRIDE_COOKIE = "testx_device";

/**
 * Where the mobile-web build is actually served from, for this app to fetch and pass
 * through. Deliberately not the same variable as apps/api's `MOBILE_WEB_URL`: that one is
 * the origin a *browser* sees mobile-web on (it feeds CORS and the OAuth return), which
 * on a same-domain deployment is this app's own public domain. This one is the upstream
 * behind it. They only coincide in dev, where both default to the Expo dev server.
 */
const MOBILE_WEB_PROXY_TARGET = process.env.MOBILE_WEB_PROXY_TARGET ?? "http://localhost:8081";

/** This app's own API routes (including /api/switch-device itself) must always reach
 * this app's backend, never the mobile-web proxy target. */
const NEVER_PROXIED_PREFIXES = ["/api/"];

function wantsMobileWeb(request: NextRequest): boolean {
  const override = request.cookies.get(DEVICE_OVERRIDE_COOKIE)?.value;
  if (override === "desktop") return false;
  // "mobile" (explicit) and unset (the new default for every device) land the same way -
  // there is no longer a user-agent check to fall back on.
  return true;
}

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  if (NEVER_PROXIED_PREFIXES.some((prefix) => pathname.startsWith(prefix))) {
    return NextResponse.next();
  }

  // Checked ahead of the mobile-web rewrite, not after: mobile-web has no equivalent
  // route, and this one has to keep working for a visitor who has already uninstalled the
  // app (Google Play's requirement, see OPEN_PATHS' own doc) regardless of which device
  // class they're on.
  if (OPEN_PATHS.includes(pathname)) {
    return NextResponse.next();
  }

  if (wantsMobileWeb(request)) {
    return NextResponse.rewrite(new URL(`${pathname}${search}`, MOBILE_WEB_PROXY_TARGET));
  }

  const token = request.cookies.get("access_token");

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
