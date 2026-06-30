import { NextRequest, NextResponse } from "next/server";
import { buildExportBundle, buildReelsCsv } from "@/lib/export";

export const dynamic = "force-dynamic";

// Downloads a full JSON snapshot (or ?format=csv for a reels spreadsheet).
// Gated by the app auth proxy like every other route.
export async function GET(req: NextRequest) {
  const date = new Date().toISOString().slice(0, 10);
  const format = new URL(req.url).searchParams.get("format");

  try {
    if (format === "csv") {
      const csv = await buildReelsCsv();
      return new NextResponse(csv, {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="autopilot-reels-${date}.csv"`,
        },
      });
    }

    const bundle = await buildExportBundle();
    return new NextResponse(JSON.stringify(bundle, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="autopilot-export-${date}.json"`,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
