import { NextRequest, NextResponse } from "next/server";

const DEVICE_OVERRIDE_COOKIE = "testx_device";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

/**
 * Backs both apps' "switch version" link (18.4). Setting the cookie here - rather than
 * in the client that renders the link - is what makes it stick: the very next request to
 * `/` is what `proxy.ts` reads it on, and that request only carries a cookie this endpoint
 * has already set via a `Set-Cookie` header on its own redirect response.
 */
export function GET(request: NextRequest): NextResponse {
  const to = request.nextUrl.searchParams.get("to");
  const requestedRedirect = request.nextUrl.searchParams.get("redirect");
  // Must be a same-app relative path - "redirect" is caller-supplied, so an absolute or
  // protocol-relative ("//host/...") value would otherwise be an open redirect.
  const redirectTo =
    requestedRedirect?.startsWith("/") && !requestedRedirect.startsWith("//")
      ? requestedRedirect
      : "/";

  const response = NextResponse.redirect(new URL(redirectTo, request.url));

  if (to === "mobile" || to === "desktop") {
    response.cookies.set(DEVICE_OVERRIDE_COOKIE, to, {
      path: "/",
      maxAge: COOKIE_MAX_AGE_SECONDS,
      sameSite: "lax",
    });
  }

  return response;
}
