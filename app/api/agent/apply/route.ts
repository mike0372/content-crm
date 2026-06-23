import { NextRequest, NextResponse } from "next/server";
import {
  getContentItem,
  saveContentItem,
  deleteContentItem,
  getIdeas,
  saveIdeas,
  getCalendar,
  saveCalendar,
} from "@/lib/data";
import { ContentItem, CalendarWeek } from "@/lib/types";

export const dynamic = "force-dynamic";

type AgentAction =
  | { type: "patch_video"; id: string; patch: Partial<ContentItem> }
  | { type: "delete_video"; id: string }
  | { type: "patch_idea"; id: string; patch: Partial<ContentItem> }
  | { type: "delete_idea"; id: string }
  | { type: "patch_calendar"; patch: Partial<CalendarWeek> };

export async function POST(req: NextRequest) {
  const { action } = (await req.json()) as { action: AgentAction };

  switch (action.type) {
    case "patch_video": {
      const existing = await getContentItem(action.id);
      if (!existing)
        return NextResponse.json({ error: "Video not found" }, { status: 404 });
      const updated: ContentItem = {
        ...existing,
        ...action.patch,
        id: existing.id,
        createdAt: existing.createdAt,
        stage: existing.stage,
      };
      if (action.patch.status && action.patch.status !== existing.status) {
        updated.statusHistory = [
          ...(existing.statusHistory ?? []),
          { status: action.patch.status, timestamp: new Date().toISOString() },
        ];
      }
      await saveContentItem(updated);
      return NextResponse.json({ ok: true, result: updated });
    }

    case "delete_video": {
      await deleteContentItem(action.id);
      return NextResponse.json({ ok: true });
    }

    case "patch_idea": {
      const existing = await getContentItem(action.id);
      if (!existing)
        return NextResponse.json({ error: "Idea not found" }, { status: 404 });
      const updated: ContentItem = {
        ...existing,
        ...action.patch,
        id: existing.id,
        stage: "idea",
      };
      await saveContentItem(updated);
      return NextResponse.json({ ok: true, result: updated });
    }

    case "delete_idea": {
      const ideas = await getIdeas();
      const filtered = ideas.filter((i) => i.id !== action.id);
      await saveIdeas(filtered);
      return NextResponse.json({ ok: true });
    }

    case "patch_calendar": {
      const cal = await getCalendar();
      const updated = { ...cal, ...action.patch };
      await saveCalendar(updated);
      return NextResponse.json({ ok: true, result: updated });
    }

    default:
      return NextResponse.json({ error: "Unknown action type" }, { status: 400 });
  }
}
