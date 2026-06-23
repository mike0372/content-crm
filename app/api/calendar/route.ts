import { NextRequest, NextResponse } from "next/server";
import { getCalendar, saveCalendar } from "@/lib/data";
import { CalendarWeek } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get("week") ?? undefined;
  return NextResponse.json(await getCalendar(week));
}

export async function PUT(req: NextRequest) {
  const cal = (await req.json()) as CalendarWeek;
  return NextResponse.json(await saveCalendar(cal));
}
