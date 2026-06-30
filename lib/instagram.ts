import "server-only";
import { getSupabase } from "./supabase";
import { getActiveToken } from "./instagramToken";

export interface InstagramPost {
  id: string;
  caption: string;
  mediaType: "IMAGE" | "VIDEO" | "REEL" | "CAROUSEL_ALBUM";
  timestamp: string;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  permalink: string;
  likeCount: number;
  commentsCount: number;
  // insights (lifetime cumulative)
  impressions: number;
  reach: number;
  saved: number;
  plays: number;
  shares: number;
  // average watch time in seconds (reels only; 0 when unavailable)
  avgWatchTime: number;
}

export interface InstagramCache {
  accountId: string;
  username: string;
  name: string;
  followersCount: number;
  mediaCount: number;
  lastSync: string;
  posts: InstagramPost[];
}

const BASE = "https://graph.facebook.com/v21.0";

// ---- Read cache from Supabase ----------------------------------------------

export async function getInstagramCache(): Promise<InstagramCache | null> {
  const sb = getSupabase();

  const { data: account, error: accErr } = await sb
    .from("instagram_account")
    .select("*")
    .order("last_sync", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (accErr) throw new Error(`getInstagramCache: ${accErr.message}`);
  if (!account) return null;

  const { data: posts, error: postErr } = await sb
    .from("instagram_posts")
    .select("*")
    .eq("account_id", account.account_id)
    .order("timestamp", { ascending: false });
  if (postErr) throw new Error(`getInstagramCache: ${postErr.message}`);

  return {
    accountId: account.account_id,
    username: account.username,
    name: account.name,
    followersCount: account.followers_count,
    mediaCount: account.media_count,
    lastSync: account.last_sync,
    posts: (posts ?? []).map((p) => ({
      id: p.id,
      caption: p.caption,
      mediaType: p.media_type as InstagramPost["mediaType"],
      timestamp: p.timestamp,
      thumbnailUrl: p.thumbnail_url,
      mediaUrl: p.media_url,
      permalink: p.permalink,
      likeCount: p.like_count,
      commentsCount: p.comments_count,
      impressions: p.impressions,
      reach: p.reach,
      saved: p.saved,
      plays: p.plays,
      shares: p.shares,
      avgWatchTime: Number(p.avg_watch_time ?? 0),
    })),
  };
}

// ---- Graph API insights ----------------------------------------------------

async function fetchInsights(
  mediaId: string,
  mediaType: string,
  token: string
): Promise<Pick<InstagramPost, "impressions" | "reach" | "saved" | "plays" | "shares" | "avgWatchTime">> {
  const zero = { impressions: 0, reach: 0, saved: 0, plays: 0, shares: 0, avgWatchTime: 0 };

  // VIDEO and REEL: use "views" (impressions not supported)
  // IMAGE and CAROUSEL_ALBUM: use "impressions" (views not supported)
  const isVideoType = mediaType === "VIDEO" || mediaType === "REEL";
  const metricStr = isVideoType
    ? "views,reach,saved,shares"
    : "impressions,reach,saved,shares";

  const result = { ...zero };

  try {
    const res = await fetch(
      `${BASE}/${mediaId}/insights?metric=${metricStr}&access_token=${token}`
    );
    if (res.ok) {
      const data = (await res.json()) as { data?: Array<{ name: string; values?: Array<{ value: number }> }> };
      for (const item of data.data ?? []) {
        const v = item.values?.[0]?.value ?? 0;
        if (item.name === "impressions") result.impressions = v;
        if (item.name === "reach") result.reach = v;
        if (item.name === "saved") result.saved = v;
        if (item.name === "views") result.plays = v;
        if (item.name === "shares") result.shares = v;
      }
    }
  } catch {
    /* keep zeros for the core metrics */
  }

  // Average watch time is a reels-only metric and isn't valid alongside the
  // metrics above, so it's fetched separately — a failure here must not zero
  // out the core insights. Graph returns milliseconds; we store seconds.
  if (isVideoType) {
    try {
      const res = await fetch(
        `${BASE}/${mediaId}/insights?metric=ig_reels_avg_watch_time&access_token=${token}`
      );
      if (res.ok) {
        const data = (await res.json()) as { data?: Array<{ name: string; values?: Array<{ value: number }> }> };
        const ms = data.data?.[0]?.values?.[0]?.value ?? 0;
        result.avgWatchTime = ms > 0 ? Math.round((ms / 1000) * 10) / 10 : 0;
      }
    } catch {
      /* leave avgWatchTime at 0 */
    }
  }

  return result;
}

// ---- Sync Graph API -> Supabase --------------------------------------------

export async function syncInstagram(): Promise<InstagramCache> {
  const active = await getActiveToken();
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!active?.token || !accountId) throw new Error("Instagram credentials not configured");
  const token = active.token;

  // Account info
  const accountRes = await fetch(
    `${BASE}/${accountId}?fields=id,name,username,followers_count,media_count&access_token=${token}`
  );
  if (!accountRes.ok) {
    // Meta error code 190 = token expired/revoked. Surface a typed message so
    // the UI can prompt a reconnect instead of a generic failure.
    let code: number | undefined;
    try {
      code = ((await accountRes.json()) as { error?: { code?: number } }).error?.code;
    } catch {
      /* ignore parse error */
    }
    if (accountRes.status === 401 || code === 190) {
      throw new Error(
        "INSTAGRAM_TOKEN_INVALID: Instagram token expired or revoked — reconnect Instagram."
      );
    }
    throw new Error(`Instagram account fetch failed: ${accountRes.status}`);
  }
  const account = (await accountRes.json()) as {
    id: string; name: string; username: string;
    followers_count: number; media_count: number;
  };

  // Recent media
  const mediaRes = await fetch(
    `${BASE}/${accountId}/media?fields=id,caption,media_type,timestamp,like_count,comments_count,thumbnail_url,media_url,permalink&limit=50&access_token=${token}`
  );
  if (!mediaRes.ok) throw new Error(`Instagram media fetch failed: ${mediaRes.status}`);
  const mediaData = (await mediaRes.json()) as {
    data?: Array<{
      id: string; caption?: string; media_type: string; timestamp: string;
      like_count?: number; comments_count?: number;
      thumbnail_url?: string; media_url?: string; permalink?: string;
    }>;
  };

  const posts: InstagramPost[] = [];
  for (const m of mediaData.data ?? []) {
    const insights = await fetchInsights(m.id, m.media_type, token);
    posts.push({
      id: m.id,
      caption: m.caption ?? "",
      mediaType: m.media_type as InstagramPost["mediaType"],
      timestamp: m.timestamp,
      thumbnailUrl: m.thumbnail_url ?? null,
      mediaUrl: m.media_url ?? null,
      permalink: m.permalink ?? "",
      likeCount: m.like_count ?? 0,
      commentsCount: m.comments_count ?? 0,
      ...insights,
    });
  }

  const lastSync = new Date().toISOString();
  const cache: InstagramCache = {
    accountId: account.id,
    username: account.username,
    name: account.name,
    followersCount: account.followers_count,
    mediaCount: account.media_count,
    lastSync,
    posts,
  };

  // ---- Persist to Supabase ----
  const sb = getSupabase();

  const { error: accErr } = await sb.from("instagram_account").upsert(
    {
      account_id: account.id,
      username: account.username,
      name: account.name,
      followers_count: account.followers_count,
      media_count: account.media_count,
      last_sync: lastSync,
    },
    { onConflict: "account_id" }
  );
  if (accErr) throw new Error(`syncInstagram (account): ${accErr.message}`);

  if (posts.length > 0) {
    // Zero-guard: a silently-failed insight fetch returns zeros. The insight
    // counters are lifetime-cumulative (they never legitimately drop), so keep
    // the higher of (fresh, stored); avg watch time keeps its last non-zero
    // value. This stops a transient Graph failure from corrupting good data.
    const ids = posts.map((p) => p.id);
    const { data: existingRows } = await sb
      .from("instagram_posts")
      .select("id, impressions, reach, saved, plays, shares, avg_watch_time")
      .in("id", ids);
    const existing = new Map(
      (existingRows ?? []).map((r) => [r.id as string, r as Record<string, number>])
    );

    const guarded = posts.map((p) => {
      const prev = existing.get(p.id);
      if (!prev) return { post: p, partial: false };
      const keep = (next: number, old: number) => (next >= old ? next : old);
      const merged: InstagramPost = {
        ...p,
        impressions: keep(p.impressions, Number(prev.impressions ?? 0)),
        reach: keep(p.reach, Number(prev.reach ?? 0)),
        saved: keep(p.saved, Number(prev.saved ?? 0)),
        plays: keep(p.plays, Number(prev.plays ?? 0)),
        shares: keep(p.shares, Number(prev.shares ?? 0)),
        avgWatchTime: p.avgWatchTime > 0 ? p.avgWatchTime : Number(prev.avg_watch_time ?? 0),
      };
      const partial =
        merged.plays !== p.plays ||
        merged.reach !== p.reach ||
        merged.saved !== p.saved ||
        merged.shares !== p.shares ||
        merged.impressions !== p.impressions ||
        (p.avgWatchTime === 0 && Number(prev.avg_watch_time ?? 0) > 0);
      return { post: merged, partial };
    });

    const mergedPosts = guarded.map((g) => g.post);
    cache.posts = mergedPosts;

    const rows = mergedPosts.map((p) => ({
      id: p.id,
      account_id: account.id,
      caption: p.caption,
      media_type: p.mediaType,
      timestamp: p.timestamp,
      thumbnail_url: p.thumbnailUrl,
      media_url: p.mediaUrl,
      permalink: p.permalink,
      like_count: p.likeCount,
      comments_count: p.commentsCount,
      impressions: p.impressions,
      reach: p.reach,
      saved: p.saved,
      plays: p.plays,
      shares: p.shares,
      avg_watch_time: p.avgWatchTime,
      synced_at: lastSync,
    }));
    const { error: postErr } = await sb
      .from("instagram_posts")
      .upsert(rows, { onConflict: "id" });
    if (postErr) throw new Error(`syncInstagram (posts): ${postErr.message}`);

    // Append-only history — one datapoint per post per sync. Survives the
    // 50-window prune below, so a reel that scrolls out of the live window
    // keeps its full metric history. Best-effort: a missing table must never
    // break the sync.
    try {
      const snapshots = guarded.map((g) => ({
        post_id: g.post.id,
        account_id: account.id,
        taken_at: lastSync,
        plays: g.post.plays,
        reach: g.post.reach,
        saved: g.post.saved,
        shares: g.post.shares,
        impressions: g.post.impressions,
        like_count: g.post.likeCount,
        comments_count: g.post.commentsCount,
        avg_watch_time: g.post.avgWatchTime,
        partial: g.partial,
      }));
      await sb.from("instagram_post_snapshots").insert(snapshots);
    } catch {
      /* history snapshots are best-effort */
    }

    // Live cache keeps only the latest 50-media window (permanent history lives
    // in the snapshots table above, so nothing is actually lost here).
    const keepIds = mergedPosts.map((p) => p.id);
    await sb
      .from("instagram_posts")
      .delete()
      .eq("account_id", account.id)
      .not("id", "in", `(${keepIds.join(",")})`);
  }

  return cache;
}

// ---- Metric history (append-only snapshots) --------------------------------

export interface MetricPoint {
  date: string; // YYYY-MM-DD
  views: number;
  reach: number;
}

// Daily account-level totals from the snapshot history. For each day we take
// the latest snapshot per post (so several manual syncs in a day don't
// double-count) and sum across posts. Returns [] until the snapshots table
// exists and has data — the UI then shows a "collecting history" hint.
export async function getMetricHistory(days = 90): Promise<MetricPoint[]> {
  try {
    const sb = getSupabase();
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    const { data, error } = await sb
      .from("instagram_post_snapshots")
      .select("post_id, taken_at, plays, reach, impressions")
      .gte("taken_at", since)
      .order("taken_at", { ascending: true });
    if (error || !data || data.length === 0) return [];

    const byDay = new Map<string, Map<string, { views: number; reach: number }>>();
    for (const r of data as Array<{
      post_id: string;
      taken_at: string;
      plays: number;
      reach: number;
      impressions: number;
    }>) {
      const day = r.taken_at.slice(0, 10);
      const views = Number(r.plays ?? 0) || Number(r.impressions ?? 0);
      const reach = Number(r.reach ?? 0);
      let posts = byDay.get(day);
      if (!posts) {
        posts = new Map();
        byDay.set(day, posts);
      }
      posts.set(r.post_id, { views, reach });
    }

    return [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? -1 : 1))
      .map(([date, posts]) => {
        let views = 0;
        let reach = 0;
        for (const v of posts.values()) {
          views += v.views;
          reach += v.reach;
        }
        return { date, views, reach };
      });
  } catch {
    return [];
  }
}
