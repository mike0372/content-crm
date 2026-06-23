import "server-only";
import { promises as fs } from "fs";
import path from "path";

const CACHE_FILE = path.join(process.cwd(), "data", "instagram-cache.json");

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

export async function getInstagramCache(): Promise<InstagramCache | null> {
  try {
    const raw = await fs.readFile(CACHE_FILE, "utf8");
    return JSON.parse(raw) as InstagramCache;
  } catch {
    return null;
  }
}

async function fetchInsights(
  mediaId: string,
  mediaType: string,
  token: string
): Promise<Pick<InstagramPost, "impressions" | "reach" | "saved" | "plays" | "shares">> {
  const zero = { impressions: 0, reach: 0, saved: 0, plays: 0, shares: 0 };

  // VIDEO and REEL: use "views" (impressions not supported)
  // IMAGE and CAROUSEL_ALBUM: use "impressions" (views not supported)
  const isVideoType = mediaType === "VIDEO" || mediaType === "REEL";
  const metricStr = isVideoType
    ? "views,reach,saved,shares"
    : "impressions,reach,saved,shares";

  try {
    const res = await fetch(
      `${BASE}/${mediaId}/insights?metric=${metricStr}&access_token=${token}`
    );
    if (!res.ok) return zero;
    const data = (await res.json()) as { data?: Array<{ name: string; values?: Array<{ value: number }> }> };
    if (!data.data) return zero;

    const result = { ...zero };
    for (const item of data.data) {
      const v = item.values?.[0]?.value ?? 0;
      if (item.name === "impressions") result.impressions = v;
      if (item.name === "reach") result.reach = v;
      if (item.name === "saved") result.saved = v;
      if (item.name === "views") result.plays = v;
      if (item.name === "shares") result.shares = v;
    }
    return result;
  } catch {
    return zero;
  }
}

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

  const cache: InstagramCache = {
    accountId: account.id,
    username: account.username,
    name: account.name,
    followersCount: account.followers_count,
    mediaCount: account.media_count,
    lastSync: new Date().toISOString(),
    posts,
  };

  await fs.mkdir(path.dirname(CACHE_FILE), { recursive: true });
  await fs.writeFile(CACHE_FILE, JSON.stringify(cache, null, 2), "utf8");
  return cache;
}
