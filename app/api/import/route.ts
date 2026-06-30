import { NextRequest, NextResponse } from "next/server";
import { importBundle } from "@/lib/export";

export const dynamic = "force-dynamic";

// Restores a previously exported JSON bundle. Additive (upsert by id/week),
// never destructive.
export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON file" }, { status: 400 });
  }

  try {
    const result = await importBundle(body);
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
