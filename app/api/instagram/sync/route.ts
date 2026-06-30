import { NextRequest, NextResponse } from "next/server";
import { syncInstagram } from "@/lib/instagram";
import { getTokenHealth, refreshInstagramToken } from "@/lib/instagramToken";

export const dynamic = "force-dynamic";

// Lock the cron endpoint when CRON_SECRET is set (Vercel Cron sends it as a
// Bearer token; a manual caller can use the x-cron-secret header). When unset,
// the request still has to pass the app's middleware gate, so this fails open
// rather than silently stopping the daily sync.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.get("x-cron-secret");
  const bearer = req.headers.get("authorization");
  return header === secret || bearer === `Bearer ${secret}`;
}

// Called by Vercel Cron daily — also usable as a manual trigger.
export async function GET(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Proactively refresh the long-lived token before it lapses (no-op if app
    // credentials are missing or it isn't close to expiry).
    const health = await getTokenHealth();
    if (health.canAutoRefresh && health.daysRemaining !== null && health.daysRemaining < 10) {
      await refreshInstagramToken();
    }

    const cache = await syncInstagram();
    return NextResponse.json({ ok: true, posts: cache.posts.length, lastSync: cache.lastSync });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Manual trigger from the in-app "Refresh" buttons — runs the same Graph sync
// and returns the full cache so the UI can re-read live metrics immediately.
export async function POST() {
  try {
    const cache = await syncInstagram();
    return NextResponse.json(cache);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
