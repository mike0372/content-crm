import "server-only";
import { getSupabase } from "./supabase";

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
  const token = process.env.INSTAGRAM_ACCESS_TOKEN;
  const accountId = process.env.INSTAGRAM_BUSINESS_ACCOUNT_ID;
  if (!token || !accountId) throw new Error("Instagram credentials not configured");

  // Account info
  const accountRes = await fetch(
    `${BASE}/${accountId}?fields=id,name,username,followers_count,media_count&access_token=${token}`
  );
  if (!accountRes.ok) throw new Error(`Instagram account fetch failed: ${accountRes.status}`);
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
    const rows = posts.map((p) => ({
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

    // Remove posts that no longer appear in the latest 50-media window
    const keepIds = posts.map((p) => p.id);
    await sb
      .from("instagram_posts")
      .delete()
      .eq("account_id", account.id)
      .not("id", "in", `(${keepIds.join(",")})`);
  }

  return cache;
}
