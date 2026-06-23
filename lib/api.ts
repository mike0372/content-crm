// Client-side fetch helpers for the JSON data API
import { ContentItem, CalendarWeek } from "./types";

async function j<T>(res: Response): Promise<T> {
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

// ---- Videos (production-stage items) ----------------------------------------

export async function apiSaveVideo(item: ContentItem): Promise<ContentItem> {
  return j<ContentItem>(
    await fetch(`/api/videos/${item.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    })
  );
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

// ---- Calendar ---------------------------------------------------------------

export async function apiGetCalendar(week: string): Promise<CalendarWeek> {
  return j<CalendarWeek>(
    await fetch(`/api/calendar?week=${encodeURIComponent(week)}`)
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

// Create a new blank idea
export async function apiCreateIdea(
  partial?: Partial<ContentItem>
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

// ---- Instagram --------------------------------------------------------------

export async function apiRefreshInstagram(): Promise<unknown> {
  return j(await fetch("/api/instagram", { method: "POST" }));
}
