import { NextResponse } from "next/server";
import { createMessage } from "@/lib/ai";
import { getAllVideos } from "@/lib/data";
import { getInstagramCache, InstagramPost } from "@/lib/instagram";
import { ContentItem } from "@/lib/types";

export const dynamic = "force-dynamic";

// Performance Analyst — the first of the sub-agents. Aggregates real IG
// metrics against each reel's production metadata (pillar/format/hookType/
// contentType/posting window) entirely in code (cheap, deterministic), then
// sends only the compact aggregate table to Claude for synthesis. Never sends
// raw posts or captions — keeps the call small and grounds every insight in
// numbers instead of vibes.

const WIN_VIEWS = 1000;

interface Group {
  label: string;
  posts: number;
  totalViews: number;
  winRate: number; // % of posts that crossed WIN_VIEWS
  avgWatchTime: number; // seconds, only counting posts with data
}

function primaryViews(p: InstagramPost): number {
  return p.plays || p.impressions || p.reach;
}

function aggregateBy<K extends string>(
  linked: { post: InstagramPost; item: ContentItem }[],
  keyOf: (item: ContentItem) => K | ""
): Group[] {
  const buckets = new Map<string, InstagramPost[]>();
  for (const { post, item } of linked) {
    const k = keyOf(item);
    if (!k) continue;
    const arr = buckets.get(k) ?? [];
    arr.push(post);
    buckets.set(k, arr);
  }
  return [...buckets.entries()]
    .map(([label, posts]) => {
      const views = posts.map(primaryViews);
      const watchTimes = posts.map((p) => p.avgWatchTime).filter((w) => w > 0);
      return {
        label,
        posts: posts.length,
        totalViews: views.reduce((s, v) => s + v, 0),
        winRate: Math.round((views.filter((v) => v >= WIN_VIEWS).length / posts.length) * 100),
        avgWatchTime: watchTimes.length
          ? Math.round((watchTimes.reduce((s, w) => s + w, 0) / watchTimes.length) * 10) / 10
          : 0,
      };
    })
    .filter((g) => g.posts >= 2) // ignore single-sample noise
    .sort((a, b) => b.totalViews / b.posts - a.totalViews / a.posts);
}

function dayOfWeek(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { weekday: "short" });
}

type Range = "week" | "month" | "all";

const RANGE_LABEL: Record<Range, string> = {
  week: "this week",
  month: "this month",
  all: "all time",
};

// Epoch cutoff for a range (null = no lower bound). Week = current ISO week
// (Mon 00:00); month = 1st of the current calendar month.
function rangeStart(range: Range): number | null {
  const now = new Date();
  if (range === "week") {
    const d = new Date(now);
    const dow = (d.getDay() + 6) % 7; // Monday = 0
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - dow);
    return d.getTime();
  }
  if (range === "month") {
    return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  }
  return null;
}

const PROMPT = `You are a data-driven performance analyst for a solo Instagram Reels creator in the AI/dev-tools niche. You are given REAL aggregated stats — every number is measured, not guessed. Do not invent numbers or mention anything not in the data.

PILLAR PERFORMANCE (avg views/post, win rate = % crossing {winViews} views):
{byPillar}

FORMAT PERFORMANCE:
{byFormat}

HOOK TYPE PERFORMANCE:
{byHookType}

CONTENT TYPE PERFORMANCE:
{byContentType}

POSTING DAY PERFORMANCE:
{byDay}

Time window: {rangeLabel}.
Sample size: {sampleSize} linked reels out of {totalPosts} synced posts.

Return raw JSON only, no markdown fences, no preamble:
{
  "doubleDown": [{"finding": string (max 15 words, cite the number), "why": string (max 20 words)}],
  "stopDoing": [{"finding": string (max 15 words, cite the number), "why": string (max 20 words)}],
  "nextReel": string (one concrete recommendation combining the strongest pillar+format+day, max 25 words)
}
2-3 items max per array. If sample size is too small (<5) for a category, omit it rather than guessing. Be blunt and specific — no generic advice like "post consistently."`;

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  const body = await req.json().catch(() => ({}));
  const range: Range = body?.range === "week" || body?.range === "month" ? body.range : "all";
  const since = rangeStart(range);

  try {
    const [videos, igCache] = await Promise.all([getAllVideos(), getInstagramCache()]);
    if (!igCache || igCache.posts.length === 0) {
      return NextResponse.json({ error: "No Instagram data synced yet" }, { status: 400 });
    }

    const videoByMediaId = new Map(
      videos.filter((v) => v.instagramMediaId).map((v) => [v.instagramMediaId as string, v])
    );
    const linked = igCache.posts
      .filter((p) => videoByMediaId.has(p.id))
      .filter((p) => since === null || new Date(p.timestamp).getTime() >= since)
      .map((p) => ({ post: p, item: videoByMediaId.get(p.id)! }));

    if (linked.length < 3) {
      const scope = range === "all" ? "yet" : `for ${RANGE_LABEL[range]}`;
      return NextResponse.json(
        {
          error: `Not enough linked reels ${scope} — ${range === "all"
            ? "link a few more posted reels to their production items first"
            : "widen the range or link more reels posted in this period"}`,
        },
        { status: 400 }
      );
    }

    const byPillar = aggregateBy(linked, (i) => i.pillar);
    const byFormat = aggregateBy(linked, (i) => i.format);
    const byHookType = aggregateBy(linked, (i) => i.hookType);
    const byContentType = aggregateBy(linked, (i) => i.contentType);
    const byDay = aggregateBy(linked, (i) => dayOfWeek(i.updatedAt) as never);

    const fmtGroups = (groups: Group[]) =>
      groups.length
        ? groups
            .map(
              (g) =>
                `- ${g.label}: ${g.posts} reels, avg ${Math.round(g.totalViews / g.posts)} views, ${g.winRate}% win rate${g.avgWatchTime ? `, ${g.avgWatchTime}s avg watch` : ""}`
            )
            .join("\n")
        : "(not enough data)";

    const prompt = PROMPT.replace("{winViews}", String(WIN_VIEWS))
      .replace("{rangeLabel}", RANGE_LABEL[range])
      .replace("{byPillar}", fmtGroups(byPillar))
      .replace("{byFormat}", fmtGroups(byFormat))
      .replace("{byHookType}", fmtGroups(byHookType))
      .replace("{byContentType}", fmtGroups(byContentType))
      .replace("{byDay}", fmtGroups(byDay))
      .replace("{sampleSize}", String(linked.length))
      .replace("{totalPosts}", String(igCache.posts.length));

    const msg = await createMessage(
      { max_tokens: 1024, messages: [{ role: "user", content: prompt }] },
      { route: "performance.analyze", tier: "smart" }
    );

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const raw = text.match(/\{[\s\S]*\}/)?.[0] ?? text;
    const insights = JSON.parse(raw);

    return NextResponse.json({
      insights,
      range,
      sampleSize: linked.length,
      totalPosts: igCache.posts.length,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Analysis failed: ${m}` }, { status: 500 });
  }
}
