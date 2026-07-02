// Client-side fetch helpers for the JSON data API
import { ContentItem, CalendarWeek } from "./types";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// ---- Videos (production-stage items) ----------------------------------------

// Fetch all production-stage items (used by live-sync polling on the Board).
export async function apiGetVideos(): Promise<ContentItem[]> {
  return j<ContentItem[]>(await fetch("/api/videos", { cache: "no-store" }));
}

// Thrown by apiSaveVideo when the server rejects a write because the row
// changed on another device since the version the caller based its edit on.
export class ConflictError extends Error {
  constructor(public current: ContentItem) {
    super("conflict");
    this.name = "ConflictError";
  }
}

// `expectedUpdatedAt` opts into optimistic-concurrency checking — the board
// passes the version it last saw so a stale cross-device write is rejected (409)
// instead of silently clobbering. Callers that omit it (e.g. editor autosave)
// keep last-write-wins behaviour unchanged.
export async function apiSaveVideo(
  item: ContentItem,
  expectedUpdatedAt?: string
): Promise<ContentItem> {
  const body = expectedUpdatedAt ? { ...item, expectedUpdatedAt } : item;
  const res = await fetch(`/api/videos/${item.id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 409) {
    const data = (await res.json().catch(() => ({}))) as { current?: ContentItem };
    throw new ConflictError(data.current as ContentItem);
  }
  return j<ContentItem>(res);
}

export async function apiCreateVideo(
  partial?: Partial<ContentItem>
): Promise<ContentItem> {
  return j<ContentItem>(
    await fetch(`/api/videos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial ?? {}),
    })
  );
}

export async function apiDeleteVideo(id: string): Promise<void> {
  await fetch(`/api/videos/${id}`, { method: "DELETE" });
}

// ---- Scheduled date (calendar placement) --------------------------------------

// Which calendar day the video sits on ("YYYY-MM-DD" or null).
export async function apiGetVideoSchedule(id: string): Promise<string | null> {
  const { date } = await j<{ date: string | null }>(
    await fetch(`/api/videos/${id}/schedule`, { cache: "no-store" })
  );
  return date;
}

// Move the video to a calendar day (null = remove from calendar).
export async function apiSetVideoSchedule(
  id: string,
  date: string | null
): Promise<string | null> {
  const res = await j<{ date: string | null }>(
    await fetch(`/api/videos/${id}/schedule`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date }),
    })
  );
  return res.date;
}

// ---- Calendar ---------------------------------------------------------------

export async function apiGetCalendar(week: string): Promise<CalendarWeek> {
  return j<CalendarWeek>(
    await fetch(`/api/calendar?week=${encodeURIComponent(week)}`, {
      cache: "no-store",
    })
  );
}

export async function apiSaveCalendar(
  cal: CalendarWeek
): Promise<CalendarWeek> {
  return j<CalendarWeek>(
    await fetch(`/api/calendar`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(cal),
    })
  );
}

// ---- Ideas ------------------------------------------------------------------

// Fetch all idea-stage items (used by live-sync polling on the Ideas page).
export async function apiGetIdeas(): Promise<ContentItem[]> {
  return j<ContentItem[]>(await fetch("/api/ideas", { cache: "no-store" }));
}

// Save a single idea item (used by IdeaEditor autosave)
export async function apiSaveIdea(idea: ContentItem): Promise<ContentItem> {
  return j<ContentItem>(
    await fetch(`/api/ideas/${idea.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(idea),
    })
  );
}

// Bulk-save all ideas (used by IdeasClient list persistence)
export async function apiSaveIdeas(
  ideas: ContentItem[]
): Promise<ContentItem[]> {
  return j<ContentItem[]>(
    await fetch(`/api/ideas`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ideas),
    })
  );
}

// Create a new blank idea. Accepts Partial<ContentItem> plus factory-level
// shorthand fields (hookLine1, contentType) that are resolved server-side.
export async function apiCreateIdea(
  partial?: Partial<ContentItem> & { hookLine1?: string }
): Promise<ContentItem> {
  return j<ContentItem>(
    await fetch(`/api/ideas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(partial ?? {}),
    })
  );
}

// Delete a single idea
export async function apiDeleteIdea(id: string): Promise<void> {
  await fetch(`/api/ideas/${id}`, { method: "DELETE" });
}

// Promote idea → production (flips stage in place, returns same item)
export async function apiPromoteIdea(ideaId: string): Promise<{
  item: ContentItem;
  calendar: CalendarWeek;
  day: string | null;
}> {
  return j(await fetch(`/api/ideas/${ideaId}/promote`, { method: "POST" }));
}

// Import ideas from a file
export async function apiImportIdeas(
  file: File
): Promise<{ imported: number; ideas: ContentItem[] }> {
  const body = new FormData();
  body.append("file", file);
  return j<{ imported: number; ideas: ContentItem[] }>(
    await fetch("/api/ideas/import", { method: "POST", body })
  );
}

// Extracted idea fields from a single document (in-editor autofill). The shape
// mirrors the comprehensive extraction prompt — every field (and nested field)
// may be null when the AI couldn't find it in the document.
export interface AutofillScorecard {
  recognition: boolean | null;
  openLoop: boolean | null;
  firstTwoS: boolean | null;
  specificity: boolean | null;
  identity: boolean | null;
}

export interface AutofillBeat {
  timestamp: string | null;
  label: string | null;
  content: string | null;
  retentionNote: string | null;
}

export interface AutofillCaption {
  text: string | null;
  hashtags: string | null;
  recommended: boolean | null;
}

export interface AutofillFields {
  title: string | null;
  pillar: string | null;
  hookType: string | null;
  format: string | null;
  lengthTarget: string | null;
  postingWindow: string | null;
  demandSignal: {
    text: string | null;
    source: string | null;
    date: string | null;
  } | null;
  recognitionScore: number | null;
  hook: {
    line1: string | null;
    line2: string | null;
    firstTwoSeconds: string | null;
    scorecard: AutofillScorecard | null;
  } | null;
  script: AutofillBeat[] | null;
  captions: AutofillCaption[] | null;
  engagement: {
    triggerType: string | null;
    triggerText: string | null;
    firstComment: string | null;
    endCard: string | null;
  } | null;
}

// Autofill: extract fields from a PDF/TXT for the currently open idea.
export async function apiAutofillIdea(file: File): Promise<AutofillFields> {
  const body = new FormData();
  body.append("file", file);
  const { fields } = await j<{ fields: AutofillFields }>(
    await fetch("/api/ideas/autofill", { method: "POST", body })
  );
  return fields;
}

// Context passed to the AI script generator (already-extracted fields).
export interface ScriptGenContext {
  title?: string;
  hookLine1?: string;
  hookLine2?: string;
  firstTwoSeconds?: string;
  pillar?: string;
  format?: string;
  lengthTarget?: string;
  demandSignal?: string;
}

// Generate a beat-by-beat script from the extracted idea context.
export async function apiGenerateScript(
  ctx: ScriptGenContext
): Promise<AutofillBeat[]> {
  const { beats } = await j<{ beats: AutofillBeat[] }>(
    await fetch("/api/ideas/generate-script", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ctx),
    })
  );
  return beats;
}

export interface ResearchSummary {
  findings: string;
  sources: string[];
}

// Complete an entire idea with AI: generates the script from the hook, then
// every other section from the hook + script. Returns the same nested field
// shape as autofill so the editor merges it the same way (never overwriting).
// Pass research: true to run a web search phase first and get researchSummary back.
export async function apiCompleteIdea(
  ctx: ScriptGenContext & { research?: boolean }
): Promise<{ fields: AutofillFields; researchSummary?: ResearchSummary }> {
  return j<{ fields: AutofillFields; researchSummary?: ResearchSummary }>(
    await fetch("/api/ideas/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(ctx),
    })
  );
}

// ---- Global save ------------------------------------------------------------

export interface SaveResult {
  videos: number;
  ideas: number;
  total: number;
  calendarWeek: string;
  savedAt: string;
}

// Confirm everything is committed to Supabase (used by the sidebar Save button,
// after it flushes any open editor's pending autosave).
export async function apiSave(): Promise<SaveResult> {
  return j<SaveResult>(await fetch("/api/save", { method: "POST" }));
}

// ---- Instagram --------------------------------------------------------------

// Client-safe shape of the Instagram cache (mirror of lib/instagram types,
// kept here so client components never import the server-only module).
export interface IgPost {
  id: string;
  caption: string;
  mediaType: "IMAGE" | "VIDEO" | "REEL" | "CAROUSEL_ALBUM";
  timestamp: string;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  permalink: string;
  likeCount: number;
  commentsCount: number;
  impressions: number;
  reach: number;
  saved: number;
  plays: number;
  shares: number;
  avgWatchTime: number;
}

export interface IgCache {
  accountId: string;
  username: string;
  name: string;
  followersCount: number;
  mediaCount: number;
  lastSync: string;
  posts: IgPost[];
}

// Read the cached Instagram data (returns null if no sync has happened yet).
export async function apiGetInstagram(): Promise<IgCache | null> {
  const res = await fetch("/api/instagram");
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<IgCache>;
}

// Trigger a fresh Graph sync and return the updated cache (Refresh button).
export async function apiSyncInstagram(): Promise<IgCache> {
  return j<IgCache>(await fetch("/api/instagram/sync", { method: "POST" }));
}

// Full sync: pulls Meta/Graph API data AND reconciles all CRM content into
// Supabase, then returns the fresh Instagram cache for the UI.
export async function apiRefreshInstagram(): Promise<unknown> {
  const res = await j<{ instagram: unknown }>(
    await fetch("/api/sync", { method: "POST" })
  );
  return res.instagram;
}

// ---- Brainstorm -------------------------------------------------------------

export interface BrainstormedIdea {
  title: string;
  notes: string;
  hookLine1: string;
  pillar: string;
  contentType: string;
}

export async function apiBrainstormIdeas(body: {
  seedIdea: string;
  contentType: string;
  count: number;
}): Promise<BrainstormedIdea[]> {
  const { ideas } = await j<{ ideas: BrainstormedIdea[] }>(
    await fetch("/api/ideas/brainstorm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    })
  );
  return ideas;
}

export async function apiRegenerateOne(body: {
  seedIdea: string;
  contentType: string;
  excludeTitles: string[];
}): Promise<BrainstormedIdea> {
  const { idea } = await j<{ idea: BrainstormedIdea }>(
    await fetch("/api/ideas/brainstorm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...body, count: 1, single: true }),
    })
  );
  return idea;
}

// ---- Results lesson ---------------------------------------------------------

// Generate a one-line "lesson learned" from the linked reel's metric verdicts.
export async function apiGenerateLesson(
  metrics: { name: string; value: string; verdict: string }[]
): Promise<string> {
  const { lesson } = await j<{ lesson: string }>(
    await fetch("/api/results/lesson", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ metrics }),
    })
  );
  return lesson;
}
