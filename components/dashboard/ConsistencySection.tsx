"use client";

import { useState, useMemo } from "react";
import { Flame } from "lucide-react";
import type { ContentItem } from "@/lib/types";
import { Card } from "@/components/ui/controls";
import { cn } from "@/lib/utils";
import { buildPostedDateSet, calcStreak, last30Days } from "./helpers";

export function ConsistencySection({ videos }: { videos: ContentItem[] }) {
  const [target, setTarget] = useState(30);

  const { postedDates, streak, thisMonthCount, heatmap } = useMemo(() => {
    const dates = buildPostedDateSet(videos);
    const days30 = last30Days();
    const today = new Date();
    const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      .toISOString()
      .slice(0, 10);
    let monthCount = 0;
    for (const d of dates) {
      if (d >= monthStart) monthCount++;
    }
    return {
      postedDates: dates,
      streak: calcStreak(dates),
      thisMonthCount: monthCount,
      heatmap: days30,
    };
  }, [videos]);

  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Flame
              className={cn("h-5 w-5", streak > 0 ? "text-orange-400" : "text-zinc-600")}
              strokeWidth={1.75}
            />
            <span className="text-2xl font-bold text-white">{streak}</span>
            <span className="text-sm text-zinc-500">
              day{streak !== 1 ? "s" : ""} streak
            </span>
          </div>
          <span className="text-zinc-700">·</span>
          <span className="text-sm text-zinc-400">
            <span className="font-semibold text-zinc-200">{thisMonthCount}</span> posted
            this month
            <span className="mx-1 text-zinc-600">vs target</span>
            <button
              onClick={() => setTarget((t) => (t === 30 ? 4 : t === 4 ? 8 : 30))}
              className="font-semibold text-[#60a5fa] hover:text-[#93c5fd] transition-colors"
              title="Click to change target"
            >
              {target}
            </button>
          </span>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold",
            thisMonthCount >= target
              ? "bg-emerald-500/10 text-emerald-400"
              : "bg-amber-500/10 text-amber-400"
          )}
        >
          {thisMonthCount >= target ? "On track" : `${target - thisMonthCount} to go`}
        </span>
      </div>

      <div className="flex flex-wrap gap-1">
        {heatmap.map((d) => {
          const isPosted = postedDates.has(d);
          const isToday = d === today;
          return (
            <div
              key={d}
              title={d}
              className={cn(
                "h-5 w-5 rounded-sm transition-colors",
                isToday && "ring-1 ring-offset-1 ring-offset-[#091828]",
                isPosted
                  ? "bg-[#3b82f6] ring-[#3b82f6]/60"
                  : isToday
                  ? "bg-white/[0.06] ring-[#3b82f6]/40"
                  : "bg-white/[0.04]"
              )}
            />
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-zinc-600">
        30-day activity — each square is one day (blue = posted)
      </p>
    </Card>
  );
}
