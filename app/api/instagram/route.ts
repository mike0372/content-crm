import { NextResponse } from "next/server";
import { getInstagramCache, syncInstagram } from "@/lib/instagram";

export const dynamic = "force-dynamic";

export async function GET() {
  const cache = await getInstagramCache();
  if (!cache) return NextResponse.json({ error: "No data — trigger a sync first" }, { status: 404 });
  return NextResponse.json(cache);
}

export async function POST() {
  try {
    const cache = await syncInstagram();
    return NextResponse.json(cache);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
