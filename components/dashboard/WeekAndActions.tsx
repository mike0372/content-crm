"use client";

import type { ReactNode } from "react";
import { useMemo } from "react";
import Link from "next/link";
import {
  ChevronRight,
  Zap,
  BookOpen,
  PenLine,
  Star,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";
import {
  type ContentItem,
  type CalendarWeek,
  DAY_KEYS,
  type DayKey,
  DAY_LABELS,
  STATUS_LABELS,
  calcReadiness,
  demandFreshness,
} from "@/lib/types";
import { Card } from "@/components/ui/controls";
import { cn } from "@/lib/utils";
import { todayDayKey, hookScore, mondayFromWeek, dayDate } from "./helpers";

// ── ThisWeekSection ────────────────────────────────────────────────────────────

export function ThisWeekSection({
  calWeek,
  videos,
  inPostingWindow,
}: {
  calWeek: CalendarWeek;
  videos: ContentItem[];
  inPostingWindow: boolean;
}) {
  const videoMap = useMemo(() => {
    const m: Record<string, ContentItem> = {};
    for (const v of videos) m[v.id] = v;
    return m;
  }, [videos]);

  const monday = useMemo(() => mondayFromWeek(calWeek.week), [calWeek.week]);
  const todayKey = todayDayKey();

  const scheduledCount = useMemo(
    () => DAY_KEYS.filter((k) => (calWeek.days[k] ?? []).length > 0).length,
    [calWeek]
  );

  const todayIds = calWeek.days[todayKey] ?? [];
  const todayVideo = todayIds.map((id) => videoMap[id]).find(Boolean);

  return (
    <Link href="/calendar" className="block group">
      <Card className="h-full p-5 transition-colors group-hover:border-[#3b82f6]/30">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200">This Week</h3>
          <ChevronRight className="h-4 w-4 text-zinc-600 transition-colors group-hover:text-[#3b82f6]" strokeWidth={1.75} />
        </div>

        <div className="grid grid-cols-7 gap-1 mb-4">
          {DAY_KEYS.map((k) => {
            const ids = calWeek.days[k] ?? [];
            const hasVideo = ids.length > 0;
            const isToday = k === todayKey;
            const d = dayDate(k as DayKey, monday);
            const dayNum = d.getUTCDate();
            return (
              <div
                key={k}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg p-1.5",
                  isToday && "ring-1 ring-[#3b82f6]/50 bg-[#3b82f6]/8"
                )}
              >
                <span
                  className={cn(
                    "text-[10px] font-medium uppercase tracking-wide",
                    isToday ? "text-[#60a5fa]" : "text-zinc-600"
                  )}
                >
                  {DAY_LABELS[k].slice(0, 3)}
                </span>
                <span
                  className={cn(
                    "text-xs font-mono",
                    isToday ? "text-white font-bold" : "text-zinc-500"
                  )}
                >
                  {dayNum}
                </span>
                <div
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    hasVideo
                      ? isToday
                        ? "bg-[#3b82f6]"
                        : "bg-zinc-400"
                      : "bg-white/[0.08]"
                  )}
                />
              </div>
            );
          })}
        </div>

        {todayVideo ? (
          <div className="rounded-lg bg-white/[0.03] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-zinc-200 truncate">
                {todayVideo.title || todayVideo.hook?.line1 || "Untitled"}
              </p>
              {inPostingWindow && (
                <span className="shrink-0 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/25 animate-pulse">
                  Post now
                </span>
              )}
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              Status: {STATUS_LABELS[todayVideo.status]}
            </p>
          </div>
        ) : (
          <p className="text-xs text-zinc-500 italic">No video scheduled for today</p>
        )}

        <p className="mt-3 text-xs text-zinc-500">
          <span className="font-semibold text-zinc-300">{scheduledCount} / 7</span> posts
          scheduled this week
        </p>
      </Card>
    </Link>
  );
}

// ── NextActionsSection ─────────────────────────────────────────────────────────

interface Action {
  priority: number;
  icon: ReactNode;
  label: string;
  sub?: string;
  href: string;
  accent: string;
}

function buildActions(
  videos: ContentItem[],
  ideas: ContentItem[],
  calWeek: CalendarWeek,
  inPostingWindow: boolean
): Action[] {
  const actions: Action[] = [];
  const todayKey = todayDayKey();

  if (inPostingWindow) {
    const todayIds = calWeek.days[todayKey] ?? [];
    const pendingToday = todayIds
      .map((id) => videos.find((v) => v.id === id))
      .find((v) => v && v.status !== "POSTED" && v.status !== "ANALYZED");
    if (pendingToday) {
      actions.push({
        priority: 1,
        icon: <Zap className="h-4 w-4 text-emerald-400" strokeWidth={1.75} />,
        label: "Post your reel — you're in the window",
        sub: pendingToday.title || pendingToday.hook?.line1 || undefined,
        href: `/video/${pendingToday.id}`,
        accent: "#34d399",
      });
    }
  }

  const postedNoResults = videos.filter((v) => {
    if (v.status !== "POSTED") return false;
    if (v.results?.verdict || v.results?.viewsIG != null) return false;
    const ev = [...(v.statusHistory ?? [])].reverse().find((e) => e.status === "POSTED");
    if (!ev) return false;
    return Date.now() - new Date(ev.timestamp).getTime() > 48 * 60 * 60 * 1000;
  });
  for (const v of postedNoResults.slice(0, 2)) {
    actions.push({
      priority: 2,
      icon: <BookOpen className="h-4 w-4 text-[#60a5fa]" strokeWidth={1.75} />,
      label: `Log results for "${v.title || "Untitled"}"`,
      sub: "Posted 48h+ ago — add skip rate, views & verdict",
      href: `/video/${v.id}`,
      accent: "#3b82f6",
    });
  }

  const hookIncomplete = videos.filter((v) => v.status === "TO_SHOOT" && hookScore(v) < 4);
  for (const v of hookIncomplete.slice(0, 1)) {
    actions.push({
      priority: 3,
      icon: <PenLine className="h-4 w-4 text-amber-400" strokeWidth={1.75} />,
      label: `Hook incomplete on "${v.title || "Untitled"}"`,
      sub: `${hookScore(v)}/5 scorecard — needs ${4 - hookScore(v)} more`,
      href: `/video/${v.id}`,
      accent: "#fbbf24",
    });
  }

  const readyIdeas = ideas.filter((i) => calcReadiness(i) >= 80);
  for (const idea of readyIdeas.slice(0, 2)) {
    actions.push({
      priority: 4,
      icon: <Star className="h-4 w-4 text-emerald-400" strokeWidth={1.75} />,
      label: `Promote "${idea.title || "Untitled"}" — it's ready`,
      sub: "Readiness ≥ 80% — move to board",
      href: "/ideas",
      accent: "#34d399",
    });
  }

  const winners = videos.filter((v) => v.results?.verdict === "WIN");
  for (const w of winners.slice(0, 1)) {
    const hasContinuation =
      w.seriesName &&
      videos.some(
        (v) =>
          v.id !== w.id &&
          v.seriesName === w.seriesName &&
          (v.partNumber ?? 0) > (w.partNumber ?? 0)
      );
    if (!hasContinuation) {
      actions.push({
        priority: 5,
        icon: <TrendingUp className="h-4 w-4 text-[#60a5fa]" strokeWidth={1.75} />,
        label: `Start Part 2 of "${w.title || "Untitled"}"`,
        sub: "WIN reel with no follow-up",
        href: `/video/${w.id}`,
        accent: "#3b82f6",
      });
    }
  }

  const staleIdeas = ideas.filter((i) => demandFreshness(i.demandSignal?.date) === "red");
  if (staleIdeas.length > 0) {
    actions.push({
      priority: 6,
      icon: <AlertTriangle className="h-4 w-4 text-amber-400" strokeWidth={1.75} />,
      label: `Refresh stale ideas (${staleIdeas.length})`,
      sub: "Demand signals older than 90 days",
      href: "/ideas",
      accent: "#fbbf24",
    });
  }

  return actions.sort((a, b) => a.priority - b.priority).slice(0, 6);
}

export function NextActionsSection({
  videos,
  ideas,
  calWeek,
  inPostingWindow,
}: {
  videos: ContentItem[];
  ideas: ContentItem[];
  calWeek: CalendarWeek;
  inPostingWindow: boolean;
}) {
  const actions = useMemo(
    () => buildActions(videos, ideas, calWeek, inPostingWindow),
    [videos, ideas, calWeek, inPostingWindow]
  );

  return (
    <Card elevated className="h-full p-5">
      <div className="mb-4 flex items-center gap-2">
        <Zap className="h-4 w-4 text-[#3b82f6]" strokeWidth={1.75} />
        <h3 className="text-sm font-semibold text-zinc-200">Next Actions</h3>
      </div>

      {actions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <CheckCircle2 className="h-8 w-8 text-emerald-400" strokeWidth={1.5} />
          <p className="text-sm font-semibold text-zinc-200">You&apos;re all caught up ✅</p>
          <p className="text-xs text-zinc-500">Nothing urgent right now.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {actions.map((a, i) => (
            <Link
              key={i}
              href={a.href}
              className="flex items-start gap-3 rounded-lg border border-white/[0.05] bg-white/[0.02] p-3 transition-colors hover:border-white/10 hover:bg-white/[0.04] active:scale-[0.99]"
            >
              <div className="mt-0.5 shrink-0">{a.icon}</div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold leading-snug text-zinc-200">{a.label}</p>
                {a.sub && <p className="mt-0.5 text-[11px] text-zinc-500">{a.sub}</p>}
              </div>
              <ArrowRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-zinc-600" strokeWidth={2} />
            </Link>
          ))}
        </div>
      )}
    </Card>
  );
}
