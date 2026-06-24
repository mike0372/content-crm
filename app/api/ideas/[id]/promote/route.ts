import { NextRequest, NextResponse } from "next/server";
import {
  getContentItem,
  saveContentItem,
  getCalendar,
  saveCalendar,
  defaultScript,
  defaultCaptions,
  defaultChecklist,
} from "@/lib/data";
import { DAY_KEYS, DayKey, ContentItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await getContentItem(id);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (item.stage !== "idea")
    return NextResponse.json({ error: "already promoted" }, { status: 400 });

  const ts = new Date().toISOString();
  const promoted: ContentItem = {
    ...item,
    stage: "production",
    status: "TO_SHOOT",
    // Fill in production defaults if not already set
    format: item.format || "Talking head",
    postingWindow: item.postingWindow || "Evening (6-8pm)",
    lengthTarget: item.lengthTarget || "30s",
    script: item.script?.length ? item.script : defaultScript(),
    captions: item.captions?.length ? item.captions : defaultCaptions(),
    checklist: item.checklist?.length ? item.checklist : defaultChecklist(),
    statusHistory: [
      ...(item.statusHistory ?? []),
      { status: "TO_SHOOT", timestamp: ts },
    ],
    updatedAt: ts,
  };

  await saveContentItem(promoted);

  // Auto-slot into next empty calendar day
  const cal = await getCalendar();
  let placedDay: DayKey | null = null;
  for (const d of DAY_KEYS) {
    if ((cal.days[d] ?? []).length === 0) {
      cal.days[d] = [promoted.id];
      placedDay = d;
      break;
    }
  }
  await saveCalendar(cal);

  return NextResponse.json({ item: promoted, calendar: cal, day: placedDay });
}
