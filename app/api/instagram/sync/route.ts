import { NextRequest, NextResponse } from "next/server";
import { syncInstagram } from "@/lib/instagram";

export const dynamic = "force-dynamic";

// Called by Vercel Cron daily — also usable as a manual trigger
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  const envSecret = process.env.CRON_SECRET;
  if (envSecret && secret !== envSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const cache = await syncInstagram();
    return NextResponse.json({ ok: true, posts: cache.posts.length, lastSync: cache.lastSync });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
