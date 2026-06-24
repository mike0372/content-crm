"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Link2,
  Loader2,
  RotateCw,
  ExternalLink,
  Unlink,
  Film,
  Search,
  X,
  Download,
  Check,
} from "lucide-react";
import { ContentItem } from "@/lib/types";
import { Button, Input } from "@/components/ui/controls";
import {
  apiGetInstagram,
  apiSyncInstagram,
  type IgCache,
  type IgPost,
} from "@/lib/api";
import { cn } from "@/lib/utils";

// ---- helpers ----------------------------------------------------------------

function fmt(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function shortDate(ts: string): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return ts;
  }
}

// Resolve a pasted reel URL/ID to a known media ID where possible.
function resolvePasted(value: string, posts: IgPost[]): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) return v; // raw numeric media ID
  // Try to match the shortcode in a /reel/<code> or /p/<code> URL
  const m = v.match(/\/(?:reel|reels|p)\/([^/?#]+)/i);
  const code = m?.[1];
  if (code) {
    const hit = posts.find((p) => p.permalink.includes(code));
    if (hit) return hit.id;
  }
  // Fall back to the raw value (will show "not in cache — refresh")
  return v;
}

// ---- metric tile ------------------------------------------------------------

function Metric({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-base px-3 py-2.5">
      <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
        {label}
      </div>
      <div
        className={cn(
          "mt-1 text-lg font-bold tabular-nums",
          accent ? "text-[#60a5fa]" : "text-zinc-100"
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ---- reel picker modal ------------------------------------------------------

function ReelPicker({
  posts,
  onPick,
  onClose,
  syncing,
  onSync,
}: {
  posts: IgPost[];
  onPick: (id: string) => void;
  onClose: () => void;
  syncing: boolean;
  onSync: () => void;
}) {
  const [paste, setPaste] = useState("");
  const reels = posts.filter(
    (p) => p.mediaType === "REEL" || p.mediaType === "VIDEO"
  );
  const list = reels.length > 0 ? reels : posts;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-[82vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-surface shadow-[0_40px_120px_rgba(0,0,0,0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div className="flex items-center gap-2">
            <Film className="h-4 w-4 text-[#60a5fa]" strokeWidth={1.75} />
            <h3 className="text-sm font-semibold text-zinc-100">
              Link Instagram reel
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-zinc-500 outline-none transition-colors hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-accent/40"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        {/* paste fallback */}
        <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-3">
          <Input
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="Paste reel URL or media ID…"
            className="flex-1"
          />
          <Button
            variant="subtle"
            onClick={() => {
              const id = resolvePasted(paste, posts);
              if (id) onPick(id);
            }}
            disabled={!paste.trim()}
          >
            <Link2 className="h-4 w-4" strokeWidth={1.75} /> Link
          </Button>
        </div>

        {/* list */}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
          {list.length === 0 ? (
            <div className="grid place-items-center gap-3 py-12 text-center">
              <Search className="h-6 w-6 text-zinc-700" strokeWidth={1.5} />
              <p className="text-sm text-zinc-500">
                No reels in the cache yet.
              </p>
              <Button variant="outline" onClick={onSync} disabled={syncing}>
                {syncing ? (
                  <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
                ) : (
                  <RotateCw className="h-4 w-4" strokeWidth={1.75} />
                )}
                Sync Instagram
              </Button>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {list.map((p) => (
                <li key={p.id}>
                  <button
                    onClick={() => onPick(p.id)}
                    className="flex w-full items-center gap-3 rounded-xl border border-transparent p-2 text-left outline-none transition-colors hover:border-white/[0.08] hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-accent/40"
                  >
                    <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-base">
                      {p.thumbnailUrl || p.mediaUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={(p.thumbnailUrl || p.mediaUrl) as string}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="grid h-full w-full place-items-center text-zinc-700">
                          <Film className="h-5 w-5" strokeWidth={1.5} />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm text-zinc-200">
                        {p.caption || (
                          <span className="text-zinc-600">No caption</span>
                        )}
                      </p>
                      <p className="mt-0.5 text-[11px] text-zinc-500">
                        {shortDate(p.timestamp)} · {fmt(p.plays)} views
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ---- main section -----------------------------------------------------------

export function LinkedReelSection({
  item,
  update,
}: {
  item: ContentItem;
  update: (p: Partial<ContentItem>) => void;
}) {
  const [cache, setCache] = useState<IgCache | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pulled, setPulled] = useState(false);

  useEffect(() => {
    let alive = true;
    apiGetInstagram()
      .then((c) => alive && setCache(c))
      .catch(() => alive && setCache(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const linkedId = item.instagramMediaId;
  const post = useMemo(
    () => cache?.posts.find((p) => p.id === linkedId) ?? null,
    [cache, linkedId]
  );

  async function refresh() {
    setSyncing(true);
    try {
      const c = await apiSyncInstagram();
      setCache(c);
    } catch {
      /* leave existing cache */
    } finally {
      setSyncing(false);
    }
  }

  function pick(id: string) {
    update({ instagramMediaId: id });
    setPickerOpen(false);
  }

  function unlink() {
    update({ instagramMediaId: null });
  }

  function pullIntoResults() {
    if (!post) return;
    const statusChanged = item.status !== "ANALYZED";
    update({
      results: {
        ...item.results,
        viewsIG: post.plays,
        likes: post.likeCount,
        comments: post.commentsCount,
        saves: post.saved,
        topSource: item.results.topSource || "Instagram",
      },
      status: "ANALYZED",
      statusHistory: statusChanged
        ? [
            ...item.statusHistory,
            { status: "ANALYZED", timestamp: new Date().toISOString() },
          ]
        : item.statusHistory,
    });
    setPulled(true);
    setTimeout(() => setPulled(false), 2500);
  }

  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="flex items-center gap-2">
          <Film className="h-4 w-4 text-[#60a5fa]" strokeWidth={1.75} />
          <span className="text-sm font-semibold text-zinc-200">
            Linked Reel
          </span>
        </div>
        {linkedId && (
          <button
            onClick={unlink}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-zinc-500 outline-none transition-colors hover:bg-white/[0.06] hover:text-rose-300 focus-visible:ring-2 focus-visible:ring-rose-500/40"
          >
            <Unlink className="h-3.5 w-3.5" strokeWidth={1.75} /> Unlink
          </button>
        )}
      </div>

      <div className="px-5 pb-5">
        {/* STATE A — not linked */}
        {!linkedId && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-white/[0.08] py-8 text-center">
            <p className="max-w-xs text-xs leading-relaxed text-zinc-500">
              Bind this idea to its posted reel so live metrics flow back here
              automatically — no manual numbers.
            </p>
            <Button
              variant="primary"
              onClick={() => setPickerOpen(true)}
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <Link2 className="h-4 w-4" strokeWidth={1.75} />
              )}
              Link Instagram reel
            </Button>
          </div>
        )}

        {/* STATE B — linked */}
        {linkedId && (
          <div className="space-y-4">
            {/* bound reel header */}
            <div className="flex items-center gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-base">
                {post && (post.thumbnailUrl || post.mediaUrl) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={(post.thumbnailUrl || post.mediaUrl) as string}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="grid h-full w-full place-items-center text-zinc-700">
                    <Film className="h-6 w-6" strokeWidth={1.5} />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm text-zinc-200">
                  {post?.caption || (
                    <span className="text-zinc-500">
                      Media {linkedId} — not in cache, hit Refresh
                    </span>
                  )}
                </p>
                <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-500">
                  {post && <span>{shortDate(post.timestamp)}</span>}
                  {post?.permalink && (
                    <a
                      href={post.permalink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[#60a5fa] outline-none transition-colors hover:text-[#93c5fd] focus-visible:ring-2 focus-visible:ring-accent/40"
                    >
                      Open on Instagram
                      <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* live metrics */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
                  Live metrics · read-only
                </span>
                <button
                  onClick={refresh}
                  disabled={syncing}
                  className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-zinc-400 outline-none transition-colors hover:bg-white/[0.06] hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-accent/40 disabled:opacity-50"
                >
                  {syncing ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
                  ) : (
                    <RotateCw className="h-3.5 w-3.5" strokeWidth={1.75} />
                  )}
                  Refresh
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Metric label="Views (IG)" value={fmt(post?.plays)} accent />
                <Metric label="Views (FB)" value="—" />
                <Metric label="Skip rate" value="—" />
                <Metric label="Top source" value={post ? "Instagram" : "—"} />
                <Metric label="Likes" value={fmt(post?.likeCount)} />
                <Metric label="Comments" value={fmt(post?.commentsCount)} />
                <Metric label="Saves" value={fmt(post?.saved)} />
                <Metric label="Follows" value="—" />
              </div>
              <p className="mt-2 text-[11px] text-zinc-600">
                Source of truth = Instagram. FB views, skip rate and follows
                aren&apos;t exposed by the Graph API.
              </p>
            </div>

            {/* pull into results */}
            <Button
              variant="primary"
              className="w-full"
              onClick={pullIntoResults}
              disabled={!post}
            >
              {pulled ? (
                <Check className="h-4 w-4" strokeWidth={1.75} />
              ) : (
                <Download className="h-4 w-4" strokeWidth={1.75} />
              )}
              {pulled ? "Pulled — status set to Analyzed" : "Pull into Results"}
            </Button>
          </div>
        )}
      </div>

      {pickerOpen && (
        <ReelPicker
          posts={cache?.posts ?? []}
          onPick={pick}
          onClose={() => setPickerOpen(false)}
          syncing={syncing}
          onSync={refresh}
        />
      )}
    </div>
  );
}
