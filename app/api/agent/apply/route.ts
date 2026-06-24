import { NextRequest, NextResponse } from "next/server";
import {
  getContentItem,
  saveContentItem,
  deleteContentItem,
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

// Fields the agent is allowed to write. Identity/lifecycle fields (id, stage,
// createdAt, updatedAt, statusHistory) are managed by the server, never patched.
const PATCHABLE_FIELDS: ReadonlySet<keyof ContentItem> = new Set([
  "status",
  "title",
  "pillar",
  "hookType",
  "format",
  "lengthTarget",
  "postingWindow",
  "scheduledTime",
  "durationMin",
  "sourceUrl",
  "demandSignal",
  "recognitionScore",
  "hook",
  "script",
  "captions",
  "engagement",
  "checklist",
  "results",
  "seriesName",
  "partNumber",
  "instagramMediaId",
] as (keyof ContentItem)[]);

function sanitizePatch(patch: Partial<ContentItem> | undefined): Partial<ContentItem> {
  const clean: Partial<ContentItem> = {};
  if (!patch || typeof patch !== "object") return clean;
  for (const key of Object.keys(patch) as (keyof ContentItem)[]) {
    if (PATCHABLE_FIELDS.has(key)) {
      (clean as Record<string, unknown>)[key] = patch[key];
    }
  }
  return clean;
}

export async function POST(req: NextRequest) {
  let action: AgentAction;
  try {
    ({ action } = (await req.json()) as { action: AgentAction });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!action || typeof action.type !== "string") {
    return NextResponse.json({ error: "Missing action" }, { status: 400 });
  }

  switch (action.type) {
    case "patch_video": {
      const existing = await getContentItem(action.id);
      if (!existing)
        return NextResponse.json({ error: "Video not found" }, { status: 404 });
      const patch = sanitizePatch(action.patch);
      const updated: ContentItem = {
        ...existing,
        ...patch,
        id: existing.id,
        createdAt: existing.createdAt,
        stage: existing.stage,
      };
      if (patch.status && patch.status !== existing.status) {
        updated.statusHistory = [
          ...(existing.statusHistory ?? []),
          { status: patch.status, timestamp: new Date().toISOString() },
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
        ...sanitizePatch(action.patch),
        id: existing.id,
        stage: "idea",
      };
      await saveContentItem(updated);
      return NextResponse.json({ ok: true, result: updated });
    }

    case "delete_idea": {
      await deleteContentItem(action.id);
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
