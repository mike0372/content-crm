import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_MS, signSession, verifySession } from "./lib/auth";

// Single-user auth gate. Opt-in: when AUTH_SECRET is unset the app stays open
// (first run / forgotten config). Once AUTH_SECRET + APP_ACCESS_KEY are set,
// every page and API route requires a valid session cookie (minted by
// /api/auth/login) — except the login page, the auth endpoints, and cron calls
// bearing the right secret.
//
// The session is a signed token with a 3h absolute expiry. On every authed
// request we re-mint it (sliding window), so 3h of inactivity disconnects you.

// Refresh the cookie at most this often, to avoid re-signing on every asset hit.
const REFRESH_AFTER_MS = 5 * 60 * 1000; // 5 min

function cookieOpts() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  };
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always-public paths.
  if (pathname === "/login" || pathname.startsWith("/api/auth/")) {
    return NextResponse.next();
  }

  const secret = process.env.AUTH_SECRET;
  // Not configured → leave the app open (dev / first run).
  if (!secret) return NextResponse.next();

  // Cron bypass for the sync endpoints (header-based, no cookie).
  const cron = process.env.CRON_SECRET;
  if (cron && req.headers.get("x-cron-secret") === cron) {
    return NextResponse.next();
  }

  const session = await verifySession(secret, req.cookies.get(SESSION_COOKIE)?.value);

  if (session) {
    const res = NextResponse.next();
    // Sliding window: re-mint when the token is more than 5 min old.
    const ageMs = SESSION_TTL_MS - (session.exp - Date.now());
    if (ageMs > REFRESH_AFTER_MS) {
      res.cookies.set(SESSION_COOKIE, await signSession(secret), cookieOpts());
    }
    return res;
  }

  // Unauthed: APIs get 401, pages redirect to the login screen.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  // Only preserve same-origin relative paths to avoid open-redirect on ?next=.
  const safeNext = pathname.startsWith("/") && !pathname.startsWith("//") ? pathname : "/";
  url.search = safeNext === "/" ? "" : `?next=${encodeURIComponent(safeNext)}`;
  return NextResponse.redirect(url);
}

// Run on everything except Next internals and static assets.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|fonts/|.*\\.(?:woff2?|png|jpg|jpeg|gif|svg|ico|webp)$).*)",
  ],
};
