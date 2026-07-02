import "server-only";
import {
  ContentItem,
  CalendarWeek,
  PerformanceRow,
  DAY_KEYS,
} from "./types";
import {
  createVideo,
  createIdeaItem,
  defaultScript,
  defaultCaptions,
  defaultChecklist,
} from "./factories";
import { isoWeek, dateOfSlot, dayKeyOf, parseYMD } from "./week";
import { getSupabase } from "./supabase";

// ============================================================================
// Supabase-backed data layer. Replaces the local /data JSON store.
// Public function signatures are unchanged so API routes and server
// components keep working without edits.
// ============================================================================

// ---- Row <-> ContentItem mapping -------------------------------------------

type ContentRow = {
  id: string;
  stage: ContentItem["stage"];
  status: ContentItem["status"];
  title: string;
  pillar: ContentItem["pillar"];
  content_type: ContentItem["contentType"] | null;
  hook_type: ContentItem["hookType"];
  format: ContentItem["format"];
  length_target: string;
  posting_window: ContentItem["postingWindow"];
  scheduled_time: string;
  duration_min: number;
  source_url: string;
  demand_signal: ContentItem["demandSignal"];
  recognition_score: number;
  hook: ContentItem["hook"];
  script: ContentItem["script"];
  captions: ContentItem["captions"];
  engagement: ContentItem["engagement"];
  checklist: ContentItem["checklist"];
  results: ContentItem["results"];
  series_name: string;
  part_number: number | null;
  instagram_media_id: string | null;
  status_history: ContentItem["statusHistory"];
  priority: number | null;
  focused: boolean | null;
  created_at: string;
  updated_at: string;
};

function rowToItem(r: ContentRow): ContentItem {
  return {
    id: r.id,
    stage: r.stage,
    status: r.status,
    title: r.title,
    pillar: r.pillar,
    contentType: r.content_type ?? "reel_long",
    hookType: r.hook_type,
    format: r.format,
    lengthTarget: r.length_target,
    postingWindow: r.posting_window,
    scheduledTime: r.scheduled_time ?? "",
    durationMin: r.duration_min ?? 60,
    sourceUrl: r.source_url,
    demandSignal: r.demand_signal,
    recognitionScore: r.recognition_score,
    hook: r.hook,
    script: r.script ?? [],
    captions: r.captions ?? [],
    engagement: r.engagement,
    checklist: r.checklist ?? [],
    results: r.results,
    seriesName: r.series_name,
    partNumber: r.part_number,
    instagramMediaId: r.instagram_media_id ?? null,
    statusHistory: r.status_history ?? [],
    priority: r.priority ?? Date.parse(r.created_at),
    focused: r.focused ?? false,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

function itemToRow(i: ContentItem): ContentRow {
  return {
    id: i.id,
    stage: i.stage,
    status: i.status,
    title: i.title,
    pillar: i.pillar,
    content_type: i.contentType ?? "reel_long",
    hook_type: i.hookType,
    format: i.format,
    length_target: i.lengthTarget,
    posting_window: i.postingWindow,
    scheduled_time: i.scheduledTime ?? "",
    duration_min: i.durationMin ?? 60,
    source_url: i.sourceUrl,
    demand_signal: i.demandSignal,
    recognition_score: i.recognitionScore,
    hook: i.hook,
    script: i.script,
    captions: i.captions,
    engagement: i.engagement,
    checklist: i.checklist,
    results: i.results,
    series_name: i.seriesName,
    part_number: i.partNumber,
    instagram_media_id: i.instagramMediaId ?? null,
    status_history: i.statusHistory,
    priority: i.priority ?? Date.parse(i.createdAt),
    focused: i.focused ?? false,
    created_at: i.createdAt,
    updated_at: i.updatedAt,
  };
}

// ---- Unified Content Store --------------------------------------------------

export async function getAllContent(): Promise<ContentItem[]> {
  const { data, error } = await getSupabase()
    .from("content_items")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw new Error(`getAllContent: ${error.message}`);
  return (data as ContentRow[]).map(rowToItem);
}

export async function getContentItem(id: string): Promise<ContentItem | null> {
  const { data, error } = await getSupabase()
    .from("content_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getContentItem: ${error.message}`);
  return data ? rowToItem(data as ContentRow) : null;
}

export async function saveContentItem(item: ContentItem): Promise<ContentItem> {
  item.updatedAt = new Date().toISOString();
  const row = itemToRow(item);
  let result = await getSupabase()
    .from("content_items")
    .upsert(row, { onConflict: "id" })
    .select("*")
    .single();

  // If the upsert failed because content_type column hasn't been migrated yet,
  // retry without it. Apply the migration in the Supabase SQL editor to fix permanently:
  // ALTER TABLE content_items ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'reel_long'
  //   CHECK (content_type IN ('reel_short','reel_long','post','carousel','informative'));
  if (result.error?.message?.includes("content_type")) {
    const { content_type: _ct, ...rowWithout } = row;
    result = await getSupabase()
      .from("content_items")
      .upsert(rowWithout, { onConflict: "id" })
      .select("*")
      .single();
  }

  if (result.error) throw new Error(`saveContentItem: ${result.error.message}`);
  const saved = rowToItem(result.data as ContentRow);
  if (saved.stage === "production") {
    await syncPerformanceRow(saved);
  }
  return saved;
}

export async function deleteContentItem(id: string): Promise<void> {
  const sb = getSupabase();
  await sb.from("performance_log").delete().eq("video_id", id);
  const { error } = await sb.from("content_items").delete().eq("id", id);
  if (error) throw new Error(`deleteContentItem: ${error.message}`);
}

// ---- Videos (backward-compat wrappers) -------------------------------------

export async function getAllVideos(): Promise<ContentItem[]> {
  const all = await getAllContent();
  return all
    .filter((i) => i.stage === "production")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function getVideo(id: string): Promise<ContentItem | null> {
  return getContentItem(id);
}

export async function saveVideo(item: ContentItem): Promise<ContentItem> {
  return saveContentItem(item);
}

export async function deleteVideo(id: string): Promise<void> {
  return deleteContentItem(id);
}

// ---- Ideas ------------------------------------------------------------------

export async function getIdeas(): Promise<ContentItem[]> {
  const all = await getAllContent();
  return all
    .filter((i) => i.stage === "idea")
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function saveIdeaItem(item: ContentItem): Promise<ContentItem> {
  return saveContentItem(item);
}

// Bulk-save: saves all incoming ideas and deletes idea rows not in the list.
export async function saveIdeas(ideas: ContentItem[]): Promise<ContentItem[]> {
  const sb = getSupabase();
  const incomingIds = new Set(ideas.map((i) => i.id));

  const { data: existing, error } = await sb
    .from("content_items")
    .select("id")
    .eq("stage", "idea");
  if (error) throw new Error(`saveIdeas: ${error.message}`);

  for (const idea of ideas) {
    await saveContentItem(idea);
  }

  const toDelete = (existing as { id: string }[])
    .map((r) => r.id)
    .filter((id) => !incomingIds.has(id));
  if (toDelete.length > 0) {
    await sb.from("content_items").delete().in("id", toDelete);
  }
  return ideas;
}

// ---- Calendar ---------------------------------------------------------------

function emptyDays(): CalendarWeek["days"] {
  return { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] };
}

function normalizeDays(raw: unknown): CalendarWeek["days"] {
  const days = emptyDays();
  const obj = (raw ?? {}) as Record<string, unknown>;
  for (const k of DAY_KEYS) {
    const v = obj[k];
    if (Array.isArray(v)) days[k] = v.filter(Boolean) as string[];
    else if (typeof v === "string") days[k] = [v];
  }
  return days;
}

function emptyWeek(week = isoWeek()): CalendarWeek {
  return { week, days: emptyDays() };
}

export async function getCalendar(week?: string): Promise<CalendarWeek> {
  const wk = week ?? isoWeek();
  const { data, error } = await getSupabase()
    .from("calendars")
    .select("*")
    .eq("week", wk)
    .maybeSingle();
  if (error) throw new Error(`getCalendar: ${error.message}`);
  if (!data) return emptyWeek(wk);
  return {
    week: data.week,
    days: normalizeDays(data.days),
    notes: data.notes ?? undefined,
    theme: data.theme ?? undefined,
  };
}

export async function saveCalendar(cal: CalendarWeek): Promise<CalendarWeek> {
  const { error } = await getSupabase().from("calendars").upsert(
    {
      week: cal.week,
      days: cal.days,
      notes: cal.notes ?? null,
      theme: cal.theme ?? null,
    },
    { onConflict: "week" }
  );
  if (error) throw new Error(`saveCalendar: ${error.message}`);
  return cal;
}

// ---- Scheduled date (calendar placement) -------------------------------------
// An item's "upload date" is which calendars[week].days[day] array holds its id.
// These helpers let the video editor read and move that placement directly, so
// the editor and the calendar page always agree.

// Find the concrete date ("YYYY-MM-DD") an item is scheduled on, or null.
export async function findScheduledDate(videoId: string): Promise<string | null> {
  const { data, error } = await getSupabase().from("calendars").select("week, days");
  if (error) throw new Error(`findScheduledDate: ${error.message}`);
  for (const row of data ?? []) {
    const days = normalizeDays(row.days);
    for (const k of DAY_KEYS) {
      if (days[k].includes(videoId)) return dateOfSlot(row.week, k);
    }
  }
  return null;
}

// Move an item to a new date (or unschedule it with null). Removes the id from
// every week it currently sits in, then appends it to the target week/day.
export async function scheduleItemOnDate(
  videoId: string,
  date: string | null
): Promise<string | null> {
  const sb = getSupabase();
  const { data, error } = await sb.from("calendars").select("week, days");
  if (error) throw new Error(`scheduleItemOnDate: ${error.message}`);

  // 1. Remove from any week that currently contains the id.
  for (const row of data ?? []) {
    const days = normalizeDays(row.days);
    let changed = false;
    for (const k of DAY_KEYS) {
      if (days[k].includes(videoId)) {
        days[k] = days[k].filter((id) => id !== videoId);
        changed = true;
      }
    }
    if (changed) {
      const { error: upErr } = await sb
        .from("calendars")
        .update({ days })
        .eq("week", row.week);
      if (upErr) throw new Error(`scheduleItemOnDate: ${upErr.message}`);
    }
  }

  if (!date) return null;

  // 2. Add to the target week/day.
  const parsed = parseYMD(date);
  if (!parsed) throw new Error(`scheduleItemOnDate: invalid date "${date}"`);
  const wk = isoWeek(parsed);
  const dayKey = dayKeyOf(parsed);
  const cal = await getCalendar(wk);
  if (!cal.days[dayKey].includes(videoId)) cal.days[dayKey].push(videoId);
  await saveCalendar(cal);
  return dateOfSlot(wk, dayKey);
}

// ---- Performance log --------------------------------------------------------

type PerfRow = {
  video_id: string;
  date: string;
  hook: string;
  pillar: string;
  format: string;
  views: number;
  skip_rate: number;
  top_source: string;
  verdict: string;
  lesson: string;
};

export async function getPerformanceLog(): Promise<PerformanceRow[]> {
  const { data, error } = await getSupabase()
    .from("performance_log")
    .select("*")
    .order("date", { ascending: true });
  if (error) throw new Error(`getPerformanceLog: ${error.message}`);
  return (data as PerfRow[]).map((r) => ({
    videoId: r.video_id,
    date: r.date,
    hook: r.hook,
    pillar: r.pillar as PerformanceRow["pillar"],
    format: r.format as PerformanceRow["format"],
    views: r.views,
    skipRate: r.skip_rate,
    topSource: r.top_source,
    verdict: r.verdict as PerformanceRow["verdict"],
    lesson: r.lesson,
  }));
}

async function syncPerformanceRow(item: ContentItem) {
  const sb = getSupabase();
  if (item.status === "ANALYZED") {
    const row: PerfRow = {
      video_id: item.id,
      date: item.updatedAt.slice(0, 10),
      hook: item.hook.line1 || item.title,
      pillar: item.pillar,
      format: item.format,
      views: (item.results.viewsIG ?? 0) + (item.results.viewsFB ?? 0),
      skip_rate: item.results.skipRate ?? 0,
      top_source: item.results.topSource,
      verdict: item.results.verdict,
      lesson: item.results.lesson,
    };
    await sb.from("performance_log").upsert(row, { onConflict: "video_id" });
  } else {
    await sb.from("performance_log").delete().eq("video_id", item.id);
  }
}

// Reconciles the entire performance_log from current content_items state.
// Upserts a row for every ANALYZED production item and removes any stale rows.
// Safe to run repeatedly — derives only from the DB, never local files.
export async function rebuildPerformanceLog(): Promise<number> {
  const sb = getSupabase();
  const all = await getAllContent();
  const analyzed = all.filter(
    (i) => i.stage === "production" && i.status === "ANALYZED"
  );

  if (analyzed.length > 0) {
    const rows: PerfRow[] = analyzed.map((item) => ({
      video_id: item.id,
      date: item.updatedAt.slice(0, 10),
      hook: item.hook.line1 || item.title,
      pillar: item.pillar,
      format: item.format,
      views: (item.results.viewsIG ?? 0) + (item.results.viewsFB ?? 0),
      skip_rate: item.results.skipRate ?? 0,
      top_source: item.results.topSource,
      verdict: item.results.verdict,
      lesson: item.results.lesson,
    }));
    await sb.from("performance_log").upsert(rows, { onConflict: "video_id" });

    const keep = analyzed.map((i) => `"${i.id}"`).join(",");
    await sb.from("performance_log").delete().not("video_id", "in", `(${keep})`);
  } else {
    // No analyzed items — clear the log entirely.
    await sb.from("performance_log").delete().neq("video_id", "");
  }
  return analyzed.length;
}

// Re-export for routes that import these from here
export {
  createVideo,
  createIdeaItem,
  defaultScript,
  defaultCaptions,
  defaultChecklist,
};
