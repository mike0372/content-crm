import { NextRequest, NextResponse } from "next/server";
import { syncAll } from "@/lib/sync";

export const dynamic = "force-dynamic";

// Full sync: Meta/Graph API + all website CRM content -> Supabase.
async function run() {
  const result = await syncAll();
  return NextResponse.json(result);
}

// Triggered by the in-app "Sync" buttons.
export async function POST() {
  try {
    return await run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// Usable as a Vercel Cron target (optional CRON_SECRET header check).
export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret");
  const envSecret = process.env.CRON_SECRET;
  if (envSecret && secret !== envSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    return await run();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
