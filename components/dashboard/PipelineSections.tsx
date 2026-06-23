"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ChevronRight, AlertTriangle } from "lucide-react";
import {
  type ContentItem,
  STATUS_COLORS,
  STATUS_LABELS,
  calcReadiness,
  readinessLabel,
  demandFreshness,
} from "@/lib/types";
import { Card } from "@/components/ui/controls";
import { cn } from "@/lib/utils";

// ── PipelineSection ────────────────────────────────────────────────────────────

export function PipelineSection({ videos }: { videos: ContentItem[] }) {
  const counts = useMemo(() => {
    const c: Record<string, number> = {
      TO_SHOOT: 0, SHOT: 0, EDITED: 0, POSTED: 0, ANALYZED: 0,
    };
    for (const v of videos) c[v.status] = (c[v.status] ?? 0) + 1;
    return c;
  }, [videos]);

  const total = videos.length || 1;

  const bottleneck = useMemo(() => {
    const prePosted = ["TO_SHOOT", "SHOT", "EDITED"] as const;
    for (const s of prePosted) {
      if (counts[s] >= 5) return `${counts[s]} reels stuck in ${STATUS_LABELS[s]}`;
    }
    return null;
  }, [counts]);

  const statusOrder = ["TO_SHOOT", "SHOT", "EDITED", "POSTED", "ANALYZED"] as const;
  const bgMap: Record<string, string> = {
    TO_SHOOT: "bg-zinc-400",
    SHOT: "bg-[#3b82f6]",
    EDITED: "bg-cyan-400",
    POSTED: "bg-orange-400",
    ANALYZED: "bg-emerald-400",
  };

  return (
    <Link href="/board" className="block group">
      <Card className="h-full p-5 transition-colors group-hover:border-[#3b82f6]/30">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200">Pipeline Health</h3>
          <ChevronRight className="h-4 w-4 text-zinc-600 transition-colors group-hover:text-[#3b82f6]" strokeWidth={1.75} />
        </div>

        <div className="grid grid-cols-5 gap-2 mb-4">
          {statusOrder.map((s) => {
            const sc = STATUS_COLORS[s];
            return (
              <div key={s} className={cn("rounded-lg p-2.5 text-center", sc.bg)}>
                <div className={cn("text-xl font-bold", sc.text)}>{counts[s]}</div>
                <div className="mt-0.5 text-[10px] font-medium text-zinc-500 truncate">
                  {STATUS_LABELS[s]}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex h-2 overflow-hidden rounded-full">
          {statusOrder.map((s) => {
            const pct = (counts[s] / total) * 100;
            return pct > 0 ? (
              <div
                key={s}
                className={cn("transition-all", bgMap[s])}
                style={{ width: `${pct}%` }}
                title={`${STATUS_LABELS[s]}: ${counts[s]}`}
              />
            ) : null;
          })}
        </div>

        {bottleneck && (
          <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-amber-500/10 px-3 py-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-400" strokeWidth={1.75} />
            <span className="text-xs text-amber-300">{bottleneck}</span>
          </div>
        )}
      </Card>
    </Link>
  );
}

// ── IdeaBankSection ────────────────────────────────────────────────────────────

export function IdeaBankSection({ ideas }: { ideas: ContentItem[] }) {
  const { byReadiness, readyCount, staleCount } = useMemo(() => {
    const by: Record<string, number> = { Raw: 0, Developing: 0, "Ready to shoot": 0 };
    let ready = 0;
    let stale = 0;
    for (const idea of ideas) {
      const score = calcReadiness(idea);
      const label = readinessLabel(score);
      by[label] = (by[label] ?? 0) + 1;
      if (score >= 80) ready++;
      const ds = idea.demandSignal?.date;
      if (ds && demandFreshness(ds) === "red") stale++;
    }
    return { byReadiness: by, readyCount: ready, staleCount: stale };
  }, [ideas]);

  const labelColors: Record<string, { bar: string; text: string }> = {
    Raw: { bar: "bg-zinc-400", text: "text-zinc-400" },
    Developing: { bar: "bg-[#3b82f6]", text: "text-[#60a5fa]" },
    "Ready to shoot": { bar: "bg-emerald-400", text: "text-emerald-400" },
  };

  return (
    <Link href="/ideas" className="block group">
      <Card className="h-full p-5 transition-colors group-hover:border-[#3b82f6]/30">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-zinc-200">Idea Bank</h3>
          <ChevronRight className="h-4 w-4 text-zinc-600 transition-colors group-hover:text-[#3b82f6]" strokeWidth={1.75} />
        </div>

        <div className="mb-3 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-white">{ideas.length}</span>
          <span className="text-xs text-zinc-500">total ideas</span>
        </div>

        <div className="space-y-2 mb-3">
          {(["Raw", "Developing", "Ready to shoot"] as const).map((label) => {
            const count = byReadiness[label] ?? 0;
            const pct = ideas.length > 0 ? (count / ideas.length) * 100 : 0;
            const colors = labelColors[label];
            return (
              <div key={label} className="flex items-center gap-2">
                <span className="w-24 shrink-0 text-xs text-zinc-500">{label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/[0.06]">
                  <div
                    className={cn("h-full rounded-full", colors.bar)}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className={cn("w-5 text-right text-xs font-mono", colors.text)}>
                  {count}
                </span>
              </div>
            );
          })}
        </div>

        <div className="flex gap-2">
          {readyCount > 0 && (
            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
              {readyCount} ready to promote
            </span>
          )}
          {staleCount > 0 && (
            <span className="flex items-center gap-1 rounded-full bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-400 ring-1 ring-inset ring-rose-500/20">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              {staleCount} stale
            </span>
          )}
        </div>
      </Card>
    </Link>
  );
}
