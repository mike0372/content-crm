import "server-only";
import { syncInstagram, InstagramCache } from "./instagram";
import { getAllContent, getCalendar, rebuildPerformanceLog } from "./data";

// Result of a full sync — Meta data + a snapshot of the CRM content state,
// all of which now lives in Supabase.
export interface SyncResult {
  instagram: InstagramCache;
  counts: {
    videos: number;
    ideas: number;
    performanceRows: number;
    instagramPosts: number;
  };
  calendarWeek: string;
  syncedAt: string;
}

// One "Sync" = pull live Meta/Graph API data into Supabase AND reconcile the
// website's own data (video ideas, videos, calendar, performance) in Supabase.
// Content is already persisted on every edit; here we additionally rebuild the
// derived performance log and report exactly what is stored.
export async function syncAll(): Promise<SyncResult> {
  const [instagram, content] = await Promise.all([
    syncInstagram(),
    getAllContent(),
  ]);

  const videos = content.filter((c) => c.stage === "production").length;
  const ideas = content.filter((c) => c.stage === "idea").length;

  const performanceRows = await rebuildPerformanceLog();
  const calendar = await getCalendar();

  return {
    instagram,
    counts: {
      videos,
      ideas,
      performanceRows,
      instagramPosts: instagram.posts.length,
    },
    calendarWeek: calendar.week,
    syncedAt: new Date().toISOString(),
  };
}
