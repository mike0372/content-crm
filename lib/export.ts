import "server-only";
import { getSupabase } from "./supabase";
import {
  getAllContent,
  getPerformanceLog,
  saveContentItem,
  saveCalendar,
  rebuildPerformanceLog,
} from "./data";
import { getInstagramCache } from "./instagram";
import type { ContentItem, CalendarWeek } from "./types";

// ============================================================================
// Own-your-data: full JSON export + restore, plus automated DB-side backups.
//
// The user-authored data that can't be regenerated is `content_items` and
// `calendars`; performance_log is derived (rebuilt on import) and Instagram is
// re-syncable from Meta — but the export captures everything for a true
// point-in-time snapshot.
// ============================================================================

export const EXPORT_VERSION = 1;

export interface ExportBundle {
  version: number;
  exportedAt: string;
  content: ContentItem[];
  calendars: CalendarWeek[];
  performance: Awaited<ReturnType<typeof getPerformanceLog>>;
  instagram: Awaited<ReturnType<typeof getInstagramCache>>;
}

async function getAllCalendars(): Promise<CalendarWeek[]> {
  const { data, error } = await getSupabase()
    .from("calendars")
    .select("*")
    .order("week", { ascending: true });
  if (error || !data) return [];
  return data.map((d) => ({
    week: d.week as string,
    days: (d.days ?? {}) as CalendarWeek["days"],
    notes: d.notes ?? undefined,
    theme: d.theme ?? undefined,
  }));
}

export async function buildExportBundle(): Promise<ExportBundle> {
  const [content, calendars, performance, instagram] = await Promise.all([
    getAllContent(),
    getAllCalendars(),
    getPerformanceLog().catch(() => []),
    getInstagramCache().catch(() => null),
  ]);
  return {
    version: EXPORT_VERSION,
    exportedAt: new Date().toISOString(),
    content,
    calendars,
    performance,
    instagram,
  };
}

export interface ImportResult {
  content: number;
  calendars: number;
}

// Restore is additive: it upserts content (by id) and calendars (by week) and
// rebuilds the derived performance log. It never deletes, so re-importing an
// older export brings rows back without wiping anything newer.
export async function importBundle(bundle: unknown): Promise<ImportResult> {
  if (!bundle || typeof bundle !== "object") throw new Error("Invalid backup file");
  const b = bundle as Partial<ExportBundle>;
  const content = Array.isArray(b.content) ? b.content : [];
  const calendars = Array.isArray(b.calendars) ? b.calendars : [];

  for (const item of content) {
    if (item && typeof item.id === "string") await saveContentItem(item);
  }
  for (const cal of calendars) {
    if (cal && typeof cal.week === "string") await saveCalendar(cal);
  }
  await rebuildPerformanceLog();

  return { content: content.length, calendars: calendars.length };
}

// ---- Reels CSV (spreadsheet view of synced post metrics) -------------------

function csvCell(v: string | number): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function buildReelsCsv(): Promise<string> {
  const cache = await getInstagramCache().catch(() => null);
  const header = [
    "timestamp", "media_type", "caption", "views_or_impressions", "reach",
    "likes", "comments", "saved", "shares", "avg_watch_time_s", "permalink",
  ];
  const rows = (cache?.posts ?? []).map((p) =>
    [
      p.timestamp,
      p.mediaType,
      (p.caption ?? "").replace(/\s+/g, " ").slice(0, 200),
      p.plays || p.impressions || p.reach,
      p.reach,
      p.likeCount,
      p.commentsCount,
      p.saved,
      p.shares,
      p.avgWatchTime,
      p.permalink,
    ].map(csvCell).join(",")
  );
  return [header.join(","), ...rows].join("\n");
}

// ---- Automated backup (best-effort, called from the daily cron) ------------

export async function writeBackup(keep = 14): Promise<void> {
  try {
    const sb = getSupabase();
    const bundle = await buildExportBundle();
    await sb.from("backups").insert({ bundle });
    const { data } = await sb
      .from("backups")
      .select("id, created_at")
      .order("created_at", { ascending: false });
    if (data && data.length > keep) {
      const old = data.slice(keep).map((r) => r.id);
      if (old.length) await sb.from("backups").delete().in("id", old);
    }
  } catch {
    /* backups are best-effort; never break the cron */
  }
}
