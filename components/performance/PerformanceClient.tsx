"use client";

import { useMemo, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  RefreshCw, Users, Eye, Heart, MessageCircle, Bookmark,
  Share2, ExternalLink, Film, Image as ImageIcon, LayoutGrid, Video,
} from "lucide-react";
import { InstagramCache, InstagramPost } from "@/lib/instagram";
import { PageHeader } from "@/components/PageHeader";
import { Button, Card } from "@/components/ui/controls";
import { apiRefreshInstagram } from "@/lib/api";
import { cn } from "@/lib/utils";

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function engRate(p: InstagramPost): number {
  const denom = p.reach || p.impressions || 1;
  return ((p.likeCount + p.commentsCount + p.saved + p.shares) / denom) * 100;
}

function primaryViews(p: InstagramPost): number {
  // videos/reels store views in plays; images/carousels store them in impressions
  return p.plays || p.impressions || p.reach;
}

function viewsLabel(p: InstagramPost): string {
  return p.mediaType === "IMAGE" || p.mediaType === "CAROUSEL_ALBUM" ? "Impr." : "Views";
}

const TYPE_ICON: Record<InstagramPost["mediaType"], React.ReactNode> = {
  REEL: <Film className="h-3.5 w-3.5" />,
  VIDEO: <Video className="h-3.5 w-3.5" />,
  IMAGE: <ImageIcon className="h-3.5 w-3.5" />,
  CAROUSEL_ALBUM: <LayoutGrid className="h-3.5 w-3.5" />,
};

const TYPE_COLOR: Record<InstagramPost["mediaType"], string> = {
  REEL: "#a78bfa",
  VIDEO: "#60a5fa",
  IMAGE: "#34d399",
  CAROUSEL_ALBUM: "#fb923c",
};

function StatCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="hover-lift flex flex-col gap-1 p-5">
      <span className="text-xs font-medium uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="text-2xl font-bold text-zinc-100">{value}</span>
      {sub && <span className="text-xs text-zinc-500">{sub}</span>}
    </Card>
  );
}

export function PerformanceClient({ initialData }: { initialData: InstagramCache | null }) {
  const [data, setData] = useState<InstagramCache | null>(initialData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    setRefreshing(true);
    setError(null);
    try {
      const next = (await apiRefreshInstagram()) as InstagramCache;
      setData(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setRefreshing(false);
    }
  }

  const sorted = useMemo(
    () => data ? [...data.posts].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) : [],
    [data]
  );

  const avgReach = useMemo(() => {
    if (!sorted.length) return 0;
    return Math.round(sorted.slice(0, 25).reduce((s, p) => s + p.reach, 0) / Math.min(sorted.length, 25));
  }, [sorted]);

  const avgEng = useMemo(() => {
    if (!sorted.length) return 0;
    return sorted.slice(0, 25).reduce((s, p) => s + engRate(p), 0) / Math.min(sorted.length, 25);
  }, [sorted]);

  const chartData = useMemo(
    () =>
      sorted.slice(0, 25).map((p) => ({
        name: new Date(p.timestamp).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
        views: primaryViews(p),
        fill: TYPE_COLOR[p.mediaType],
      })),
    [sorted]
  );

  const lastSync = data?.lastSync
    ? new Date(data.lastSync).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <>
      <PageHeader
        title="Performance"
        subtitle={data ? `@${data.username} · synced ${lastSync}` : "No data yet"}
      >
        <Button variant="ghost" onClick={refresh} disabled={refreshing}>
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} strokeWidth={1.75} />
          {refreshing ? "Syncing…" : "Sync now"}
        </Button>
      </PageHeader>

      {error && (
        <div className="mx-7 mt-5 rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
          {error}
        </div>
      )}

      {!data ? (
        <div className="flex flex-col items-center gap-4 px-7 py-20 text-center">
          <p className="text-zinc-300">No Instagram data yet.</p>
          <Button variant="primary" onClick={refresh} disabled={refreshing}>
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} strokeWidth={1.75} />
            {refreshing ? "Syncing…" : "Sync Instagram"}
          </Button>
        </div>
      ) : (
        <div className="space-y-6 px-7 py-7">
          {/* Stats row */}
          <div className="grid animate-fade-in-up grid-cols-2 gap-4 md:grid-cols-4">
            <StatCard label="Followers" value={fmt(data.followersCount)} sub={`${data.mediaCount} posts total`} />
            <StatCard label="Avg reach" value={fmt(avgReach)} sub="last 25 posts" />
            <StatCard label="Avg eng. rate" value={`${avgEng.toFixed(2)}%`} sub="likes+comments+saves+shares" />
            <StatCard label="Posts tracked" value={String(sorted.length)} sub="from this account" />
          </div>

          {/* Chart */}
          {chartData.length > 0 && (
            <Card elevated className="animate-fade-in-up p-6 [animation-delay:80ms]">
              <h2 className="mb-4 text-sm font-semibold text-zinc-200">Views / plays · last 25 posts</h2>
              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 8 }}>
                    <XAxis
                      dataKey="name"
                      tick={{ fill: "#71717a", fontSize: 10 }}
                      axisLine={{ stroke: "#27272a" }}
                      tickLine={false}
                      interval={2}
                    />
                    <YAxis
                      tick={{ fill: "#71717a", fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      width={44}
                      tickFormatter={fmt}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                      contentStyle={{
                        background: "#1b1b27",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10,
                        color: "#e4e4e7",
                        fontSize: 12,
                      }}
                      formatter={(v) => [fmt(Number(v ?? 0)), "views"]}
                    />
                    <Bar dataKey="views" radius={[5, 5, 0, 0]}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.fill} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              {/* Legend */}
              <div className="mt-3 flex flex-wrap gap-4">
                {(["REEL", "VIDEO", "IMAGE", "CAROUSEL_ALBUM"] as const).map((t) => (
                  <span key={t} className="flex items-center gap-1.5 text-[11px] text-zinc-500">
                    <span className="h-2 w-2 rounded-full" style={{ background: TYPE_COLOR[t] }} />
                    {t === "CAROUSEL_ALBUM" ? "Carousel" : t.charAt(0) + t.slice(1).toLowerCase()}
                  </span>
                ))}
              </div>
            </Card>
          )}

          {/* Posts table */}
          <Card className="animate-fade-in-up overflow-hidden [animation-delay:160ms]">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/[0.06] text-left text-[11px] uppercase tracking-wider text-zinc-500">
                    <th className="px-4 py-3 font-semibold">Post</th>
                    <th className="px-4 py-3 font-semibold">Type</th>
                    <th className="px-4 py-3 font-semibold">Date</th>
                    <th className="px-4 py-3 text-right font-semibold">
                      <span className="inline-flex items-center gap-1"><Eye className="h-3 w-3" /> Views/Impr.</span>
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      <span className="inline-flex items-center gap-1"><Users className="h-3 w-3" /> Reach</span>
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      <span className="inline-flex items-center gap-1"><Heart className="h-3 w-3" /></span>
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      <span className="inline-flex items-center gap-1"><MessageCircle className="h-3 w-3" /></span>
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      <span className="inline-flex items-center gap-1"><Bookmark className="h-3 w-3" /></span>
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">
                      <span className="inline-flex items-center gap-1"><Share2 className="h-3 w-3" /></span>
                    </th>
                    <th className="px-4 py-3 text-right font-semibold">Eng%</th>
                    <th className="px-4 py-3 font-semibold"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/[0.04]">
                  {sorted.map((p, i) => (
                    <tr
                      key={p.id}
                      className="animate-fade-in transition-colors hover:bg-white/[0.02]"
                      style={{ animationDelay: `${Math.min(i, 18) * 25}ms` }}
                    >
                      <td className="max-w-[220px] px-4 py-3">
                        <p className="truncate font-medium text-zinc-200">
                          {p.caption ? p.caption.slice(0, 60) + (p.caption.length > 60 ? "…" : "") : "—"}
                        </p>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                          style={{
                            background: TYPE_COLOR[p.mediaType] + "22",
                            color: TYPE_COLOR[p.mediaType],
                          }}
                        >
                          {TYPE_ICON[p.mediaType]}
                          {p.mediaType === "CAROUSEL_ALBUM" ? "Carousel" : p.mediaType.charAt(0) + p.mediaType.slice(1).toLowerCase()}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-zinc-500">
                        {new Date(p.timestamp).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "2-digit" })}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-200">{fmt(primaryViews(p))}</td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">{fmt(p.reach)}</td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">{fmt(p.likeCount)}</td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">{fmt(p.commentsCount)}</td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">{fmt(p.saved)}</td>
                      <td className="px-4 py-3 text-right font-mono text-zinc-400">{fmt(p.shares)}</td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-zinc-400">
                        {engRate(p).toFixed(1)}%
                      </td>
                      <td className="px-4 py-3">
                        {p.permalink && (
                          <a
                            href={p.permalink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex rounded-md p-1.5 text-zinc-600 outline-none transition-colors hover:bg-white/[0.06] hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-white/20"
                            aria-label="Open on Instagram"
                          >
                            <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}
    </>
  );
}
