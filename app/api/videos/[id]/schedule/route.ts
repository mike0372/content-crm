import { NextRequest, NextResponse } from "next/server";
import { findScheduledDate, scheduleItemOnDate, getContentItem } from "@/lib/data";

export const dynamic = "force-dynamic";

// GET → { date: "YYYY-MM-DD" | null } — where this item sits on the calendar.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const date = await findScheduledDate(id);
  return NextResponse.json({ date });
}

// PUT { date: "YYYY-MM-DD" | null } → moves the item to that calendar day
// (null unschedules). Single source of truth: the calendars table.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await getContentItem(id);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });

  let date: string | null;
  try {
    const body = (await req.json()) as { date?: unknown };
    date = typeof body.date === "string" && body.date ? body.date : null;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const placed = await scheduleItemOnDate(id, date);
    return NextResponse.json({ date: placed });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
