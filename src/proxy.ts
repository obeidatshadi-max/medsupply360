import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "sadaf_session";

/** Pages that must be reachable without a session. */
const PUBLIC_PATHS = new Set(["/login", "/signup", "/forgot-password", "/reset-password"]);

/** Same switch as src/lib/auth/open-access.ts (the proxy cannot import server-only code). */
const openAccess = () => process.env.OPEN_ACCESS === "true";

/**
 * Optimistic auth redirect: no session cookie sends the visitor to the login page. The real check
 * (signature, expiry, active user) happens in the data access layer.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();
  if (pathname === "/" || pathname === "/ar") {
    // The front page is for visitors without a session. Anyone signed in (or with open access on) goes to the dashboard,
    // unless they came back on purpose with the Home button (?home=1).
    if ((request.cookies.has(SESSION_COOKIE) || openAccess()) && request.nextUrl.searchParams.get("home") !== "1") {
      const url = request.nextUrl.clone();
      url.pathname = "/dashboard";
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }
  if (!request.cookies.has(SESSION_COOKIE) && !openAccess()) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|jpg|jpeg|webp|txt)$).*)"],
};
