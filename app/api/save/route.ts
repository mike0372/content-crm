import { NextResponse } from "next/server";
import { getAllContent, getCalendar } from "@/lib/data";

export const dynamic = "force-dynamic";

// Lightweight global "Save" confirmation. Content is already written to
// Supabase on every edit (and flushed by the Save button just before this
// call), so here we read it straight back from Supabase and report the counts
// — proving everything is committed. No Instagram dependency, so it can't fail
// on a missing Graph token.
export async function POST() {
  try {
    const content = await getAllContent();
    const calendar = await getCalendar();
    return NextResponse.json({
      videos: content.filter((c) => c.stage === "production").length,
      ideas: content.filter((c) => c.stage === "idea").length,
      total: content.length,
      calendarWeek: calendar.week,
      savedAt: new Date().toISOString(),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Save failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
