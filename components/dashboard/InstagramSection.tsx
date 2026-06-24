"use client";

import { useMemo } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Trophy,
  Film,
  Target,
} from "lucide-react";
import type { ContentItem } from "@/lib/types";
import type { InstagramCache } from "@/lib/instagram";
import { Card, Button } from "@/components/ui/controls";
import { cn } from "@/lib/utils";
import { fmt, postViews, totalViews, sourceColor } from "./helpers";

// ── IGEmptyState ───────────────────────────────────────────────────────────────

export function IGEmptyState({ onSync, syncing }: { onSync: () => void; syncing: boolean }) {
  return (
    <Card elevated className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#3b82f6]/10 ring-1 ring-[#3b82f6]/20">
        <Film className="h-7 w-7 text-[#3b82f6]" strokeWidth={1.5} />
      </div>
      <div>
        <p className="text-sm font-semibold text-zinc-200">No Instagram data yet</p>
        <p className="mt-1 text-xs text-zinc-500">Sync your account to see performance stats</p>
      </div>
      <Button variant="primary" size="sm" onClick={onSync} disabled={syncing}>
        <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} strokeWidth={2} />
        {syncing ? "Syncing…" : "Sync now"}
      </Button>
    </Card>
  );
}

// ── HeroStat ───────────────────────────────────────────────────────────────────

export function HeroStat({
  label,
  value,
  sub,
  trend,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "flat";
  accent?: string;
}) {
  const TrendIcon =
    trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor =
    trend === "up"
      ? "text-emerald-400"
      : trend === "down"
      ? "text-rose-400"
      : "text-zinc-500";
  return (
    <Card className="hover-lift flex flex-col gap-1 p-5">
      <span className="text-[11px] font-medium uppercase tracking-wider text-zinc-500">
        {label}
      </span>
      <div className="flex items-end gap-2">
        <span
          className="text-3xl font-bold leading-none tracking-tight"
          style={{ color: accent ?? "#fff" }}
        >
          {value}
        </span>
        {trend && (
          <TrendIcon className={cn("mb-0.5 h-4 w-4 shrink-0", trendColor)} strokeWidth={2} />
        )}
      </div>
      {sub && <span className="text-xs text-zinc-500">{sub}</span>}
    </Card>
  );
}

// ── ViewsTooltip ───────────────────────────────────────────────────────────────

function ViewsTooltip({ active, payload }: {
  active?: boolean;
  payload?: Array<{ payload: { caption: string; views: number; reach: number } }>;
}) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="rounded-lg border border-white/10 bg-[#0e2236] px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 max-w-[200px] truncate font-semibold text-zinc-100">{d.caption || "No caption"}</p>
      <p className="text-zinc-400">
        Views: <span className="font-mono text-zinc-200">{fmt(d.views)}</span>
      </p>
      <p className="text-zinc-500">
        Reach: <span className="font-mono text-zinc-400">{fmt(d.reach)}</span>
      </p>
    </div>
  );
}

// ── InstagramSection ───────────────────────────────────────────────────────────

export function InstagramSection({
  igCache,
  analyzed,
  onSync,
  syncing,
}: {
  igCache: InstagramCache;
  analyzed: ContentItem[];
  onSync: () => void;
  syncing: boolean;
}) {
  const allPostsSorted = useMemo(
    () => [...igCache.posts].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()),
    [igCache.posts]
  );

  const totalV = useMemo(
    () => igCache.posts.reduce((s, p) => s + postViews(p), 0),
    [igCache.posts]
  );

  const trendDir = useMemo((): "up" | "down" | "flat" => {
    const withPlays = allPostsSorted.filter((p) => postViews(p) > 0);
    if (withPlays.length < 4) return "flat";
    const half = Math.floor(withPlays.length / 2);
    const prev = withPlays.slice(0, half).reduce((s, p) => s + postViews(p), 0) / half;
    const curr = withPlays.slice(half).reduce((s, p) => s + postViews(p), 0) / (withPlays.length - half);
    if (curr > prev * 1.05) return "up";
    if (curr < prev * 0.95) return "down";
    return "flat";
  }, [allPostsSorted]);

  const chartData = useMemo(
    () =>
      allPostsSorted.map((p) => ({
        date: new Date(p.timestamp).toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
        }),
        views: postViews(p),
        reach: p.reach,
        caption: p.caption ? p.caption.slice(0, 60) : "",
      })),
    [allPostsSorted]
  );

  // Average watch time (seconds) pulled straight from the Graph API per reel —
  // no manual entry. Averaged across every synced reel that reports it.
  const avgWatch = useMemo(() => {
    const withTime = igCache.posts.filter((p) => (p.avgWatchTime ?? 0) > 0);
    if (!withTime.length) return null;
    return withTime.reduce((s, p) => s + (p.avgWatchTime ?? 0), 0) / withTime.length;
  }, [igCache.posts]);

  // Win rate pulled straight from synced reels — a "win" = crossed the 1K-views
  // WIN benchmark ("algorithm picked it up"). No manual verdict entry needed.
  const winRate = useMemo(() => {
    const reels = igCache.posts.filter(
      (p) => (p.mediaType === "REEL" || p.mediaType === "VIDEO") && postViews(p) > 0
    );
    if (!reels.length) return null;
    const wins = reels.filter((p) => postViews(p) >= 1000).length;
    return { wins, total: reels.length, pct: (wins / reels.length) * 100 };
  }, [igCache.posts]);

  const donutData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of analyzed) {
      const src = v.results?.topSource?.trim() || "Other";
      counts[src] = (counts[src] ?? 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [analyzed]);

  const tabReelsPct = useMemo(() => {
    const total = donutData.reduce((s, d) => s + d.value, 0);
    const tabReels = donutData.find((d) => d.name === "Tab Reels")?.value ?? 0;
    return total > 0 ? (tabReels / total) * 100 : 0;
  }, [donutData]);

  const bestPost = useMemo(
    () => [...igCache.posts].sort((a, b) => postViews(b) - postViews(a))[0] ?? null,
    [igCache.posts]
  );

  const worstAnalyzed = useMemo(() => {
    const withViews = analyzed.filter((v) => totalViews(v) >= 0 && v.results?.verdict);
    return withViews.sort((a, b) => totalViews(a) - totalViews(b))[0] ?? null;
  }, [analyzed]);

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <HeroStat
          label="Total Views"
          value={fmt(totalV)}
          trend={trendDir}
          sub={`${fmt(igCache.posts.length)} posts · from API`}
        />
        <HeroStat
          label="Avg Watch Time"
          value={avgWatch != null ? `${avgWatch.toFixed(1)}s` : "—"}
          sub={
            avgWatch != null
              ? avgWatch >= 7
                ? "▲ Strong retention"
                : "▼ Below 7s benchmark"
              : "Sync to pull from API"
          }
          accent={avgWatch == null ? undefined : avgWatch >= 7 ? "#34d399" : "#f87171"}
        />
        <HeroStat
          label="Win Rate"
          value={winRate != null ? `${Math.round(winRate.pct)}%` : "—"}
          sub={
            winRate != null
              ? `${winRate.wins} / ${winRate.total} reels ≥ 1K views`
              : "Sync to pull from API"
          }
          accent={winRate == null ? undefined : winRate.pct >= 50 ? "#34d399" : "#fbbf24"}
        />
        <HeroStat
          label="Followers"
          value={fmt(igCache.followersCount)}
          sub={`@${igCache.username}`}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card elevated className="p-5 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-200">Views over time</h3>
            <span className="text-[11px] text-zinc-600">{igCache.posts.length} posts from API</span>
          </div>
          {chartData.length === 0 ? (
            <p className="py-12 text-center text-xs text-zinc-500">
              Sync Instagram to see your views history
            </p>
          ) : (
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={chartData}
                  margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
                >
                  <defs>
                    <linearGradient id="vGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="date"
                    tick={{ fill: "#52525b", fontSize: 10 }}
                    axisLine={{ stroke: "#1e2e42" }}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tick={{ fill: "#52525b", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    width={36}
                    tickFormatter={fmt}
                  />
                  <Tooltip content={<ViewsTooltip />} />
                  <ReferenceLine
                    y={1000}
                    stroke="#3b82f6"
                    strokeDasharray="4 4"
                    strokeOpacity={0.4}
                    label={{
                      value: "1K benchmark",
                      position: "insideTopRight",
                      fill: "#3b82f6",
                      fontSize: 9,
                      opacity: 0.7,
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="views"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    fill="url(#vGrad)"
                    dot={{ fill: "#3b82f6", r: 3, strokeWidth: 0 }}
                    activeDot={{ r: 5, fill: "#60a5fa" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card className="flex flex-col p-5">
          <h3 className="mb-2 text-sm font-semibold text-zinc-200">Traffic sources</h3>
          {donutData.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
              <p className="text-xs text-zinc-500">Log top source when<br />analyzing your reels</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-center">
                <PieChart width={140} height={140}>
                  <Pie
                    data={donutData}
                    cx={65}
                    cy={65}
                    innerRadius={38}
                    outerRadius={60}
                    paddingAngle={2}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    {donutData.map((entry, i) => (
                      <Cell key={i} fill={sourceColor(entry.name)} />
                    ))}
                  </Pie>
                </PieChart>
              </div>
              <div className="mt-1 space-y-1">
                {donutData.map((d) => {
                  const total = donutData.reduce((s, x) => s + x.value, 0);
                  const pct = Math.round((d.value / total) * 100);
                  return (
                    <div key={d.name} className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs text-zinc-400">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ background: sourceColor(d.name) }}
                        />
                        {d.name}
                      </span>
                      <span className="text-xs font-mono text-zinc-300">{pct}%</span>
                    </div>
                  );
                })}
              </div>
              {tabReelsPct > 0 && (
                <p
                  className={cn(
                    "mt-2 rounded-lg px-2 py-1 text-center text-[11px] font-medium",
                    tabReelsPct >= 50
                      ? "bg-emerald-500/10 text-emerald-400"
                      : "bg-amber-500/10 text-amber-400"
                  )}
                >
                  Tab Reels {tabReelsPct >= 50 ? "≥" : "<"} 50% organic
                  {tabReelsPct >= 50 ? " ✓" : ""}
                </p>
              )}
            </>
          )}
        </Card>
      </div>

      {(bestPost || worstAnalyzed) && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {bestPost && (
            <a href={bestPost.permalink} target="_blank" rel="noopener noreferrer" className="group block">
              <Card className="hover-lift flex flex-col gap-2 p-4 hover:border-emerald-500/30 hover:bg-emerald-500/5">
                <div className="flex items-center gap-2">
                  <Trophy className="icon-pop h-4 w-4 text-emerald-400" strokeWidth={1.75} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Best reel
                  </span>
                  <span className="ml-auto text-[10px] text-zinc-600">from API</span>
                </div>
                <p className="text-sm font-semibold text-zinc-100 leading-snug line-clamp-2">
                  {bestPost.caption ? bestPost.caption.split("\n")[0].slice(0, 80) : "No caption"}
                </p>
                <div className="flex flex-wrap gap-3 mt-1">
                  <span className="text-xs text-zinc-400">
                    <span className="font-mono font-semibold text-zinc-200">{fmt(postViews(bestPost))}</span> views
                  </span>
                  <span className="text-xs text-zinc-500">
                    reach <span className="font-mono text-zinc-400">{fmt(bestPost.reach)}</span>
                  </span>
                  {bestPost.saved > 0 && (
                    <span className="text-xs text-zinc-500">
                      saves <span className="font-mono text-zinc-400">{fmt(bestPost.saved)}</span>
                    </span>
                  )}
                </div>
              </Card>
            </a>
          )}

          {worstAnalyzed ? (
            <a href={`/video/${worstAnalyzed.id}`} className="group block">
              <Card className="hover-lift flex flex-col gap-2 p-4 hover:border-rose-500/30 hover:bg-rose-500/5">
                <div className="flex items-center gap-2">
                  <Target className="icon-pop h-4 w-4 text-rose-400" strokeWidth={1.75} />
                  <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                    Biggest miss
                  </span>
                  <span className="ml-auto text-[10px] text-zinc-600">analyzed</span>
                </div>
                <p className="text-sm font-semibold text-zinc-100 leading-snug">
                  {worstAnalyzed.title || worstAnalyzed.hook?.line1 || "Untitled"}
                </p>
                <div className="flex gap-3 mt-1">
                  <span className="text-xs text-zinc-400">
                    <span className="font-mono font-semibold text-zinc-200">{fmt(totalViews(worstAnalyzed))}</span> views
                  </span>
                  {worstAnalyzed.results?.skipRate != null && (
                    <span className={cn("text-xs", worstAnalyzed.results.skipRate <= 55 ? "text-emerald-400" : "text-rose-400")}>
                      {worstAnalyzed.results.skipRate}% skip
                    </span>
                  )}
                  {worstAnalyzed.results?.verdict && (
                    <span className="text-xs font-semibold text-rose-400">{worstAnalyzed.results.verdict}</span>
                  )}
                </div>
                {worstAnalyzed.results?.lesson && (
                  <p className="mt-1 rounded-lg bg-white/[0.03] px-2 py-1.5 text-[11px] leading-relaxed text-zinc-400 italic">
                    Lesson: &ldquo;{worstAnalyzed.results.lesson}&rdquo;
                  </p>
                )}
              </Card>
            </a>
          ) : bestPost && (
            <Card className="flex flex-col gap-2 p-4 border-dashed">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-zinc-600" strokeWidth={1.75} />
                <span className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  Biggest miss
                </span>
              </div>
              <p className="text-xs text-zinc-500 italic">
                Analyze your reels to log lessons here. Mark a reel as ANALYZED in the board to see what worked and what didn&apos;t.
              </p>
            </Card>
          )}
        </div>
      )}
    </section>
  );
}
