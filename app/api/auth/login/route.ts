import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, SESSION_TTL_MS, safeEqual, signSession } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// In-memory brute-force throttle. Keyed by client IP. Resets on cold start —
// defense-in-depth only; the real protection is the key's 256-bit entropy.
const WINDOW_MS = 10 * 60 * 1000; // 10 min
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, { count: number; first: number }>();

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(ip, { count: 0, first: now });
    return false;
  }
  return rec.count >= MAX_ATTEMPTS;
}

function recordFailure(ip: string) {
  const now = Date.now();
  const rec = attempts.get(ip);
  if (!rec || now - rec.first > WINDOW_MS) {
    attempts.set(ip, { count: 1, first: now });
  } else {
    rec.count += 1;
  }
}

export async function POST(req: NextRequest) {
  const expected = process.env.APP_ACCESS_KEY || process.env.APP_PASSWORD;
  const secret = process.env.AUTH_SECRET;
  if (!expected || !secret) {
    return NextResponse.json(
      { error: "Auth not configured — set APP_ACCESS_KEY and AUTH_SECRET" },
      { status: 500 }
    );
  }

  const ip = clientIp(req);
  if (rateLimited(ip)) {
    return NextResponse.json(
      { error: "Too many attempts — wait a few minutes and try again." },
      { status: 429 }
    );
  }

  let key = "";
  try {
    const body = (await req.json()) as { key?: string; password?: string };
    key = body.key ?? body.password ?? "";
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (typeof key !== "string" || !safeEqual(key.trim(), expected)) {
    recordFailure(ip);
    return NextResponse.json({ error: "Invalid key" }, { status: 401 });
  }

  // Success — clear the throttle and mint a fresh 3h session.
  attempts.delete(ip);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, await signSession(secret), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_TTL_MS / 1000),
  });
  return res;
}
