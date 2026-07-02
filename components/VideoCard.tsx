"use client";

import Link from "next/link";
import { Film, GripVertical, Trash2, Link2, Check } from "lucide-react";
import { Video } from "@/lib/types";
import { PillarBadge } from "@/components/ui/Badge";
import { PostingWindowBadge } from "@/components/ui/CardChips";
import { cn } from "@/lib/utils";

export function VideoCard({
  video,
  day,
  dragHandle,
  dragging,
  onDelete,
  onToggleFocus,
}: {
  video: Video;
  day?: string;
  dragHandle?: React.HTMLAttributes<HTMLButtonElement> & {
    ref?: React.Ref<HTMLButtonElement>;
  };
  dragging?: boolean;
  compact?: boolean;
  onDelete?: (id: string) => void;
  onToggleFocus?: (id: string) => void;
}) {
  const hook = video.hook.line1 || video.title;
  const focused = !!video.focused;
  return (
    <div
      className={cn(
        "group relative rounded-lg border bg-elevated px-2.5 py-2 transition-[transform,box-shadow,border-color] duration-150",
        focused
          ? "border-orange-500/60 shadow-[0_0_0_1px_rgba(249,115,22,0.35),0_0_18px_rgba(249,115,22,0.14),0_1px_4px_-2px_rgba(0,0,0,0.5)] hover:-translate-y-0.5"
          : "border-white/[0.06] shadow-[0_1px_4px_-2px_rgba(0,0,0,0.5)] hover:-translate-y-0.5 hover:border-white/[0.12] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.18),0_8px_24px_-12px_rgba(59,130,246,0.30)]",
        dragging &&
          "rotate-[1.5deg] border-accent/40 shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_20px_40px_-12px_rgba(59,130,246,0.45)]"
      )}
    >
      {/* Top row: pillar badge + hover-only actions */}
      <div className="flex items-start justify-between gap-1.5">
        <div className="flex min-w-0 items-center gap-1.5">
          <PillarBadge pillar={video.pillar} className="px-2 py-[1px] text-[10px]" />
          {video.instagramMediaId && (
            <span
              title="Linked to an Instagram reel"
              className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#3b82f6]/15 text-[#60a5fa] ring-1 ring-inset ring-[#3b82f6]/30"
            >
              <Link2 className="h-2.5 w-2.5" strokeWidth={2} />
            </span>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {onToggleFocus && (
            <button
              onClick={(e) => {
                e.preventDefault();
                onToggleFocus(video.id);
              }}
              aria-label={focused ? "Remove focus" : "Focus on this"}
              title={focused ? "Focused — click to unfocus" : "Mark as focus"}
              className={cn(
                "-mt-0.5 flex items-center justify-center rounded-[5px] outline-none transition-[opacity,background,color,box-shadow] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-orange-500/40",
                focused
                  ? "bg-orange-500 text-white shadow-[0_0_10px_rgba(249,115,22,0.45)]"
                  : "border border-white/[0.15] text-transparent opacity-0 hover:border-orange-500/60 hover:text-orange-400/60 group-hover:opacity-100"
              )}
              style={{ width: 16, height: 16 }}
            >
              <Check className="h-3 w-3" strokeWidth={3} />
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.preventDefault();
                onDelete(video.id);
              }}
              aria-label="Delete reel"
              className="-mt-0.5 rounded-md p-0.5 text-zinc-600 opacity-0 transition-[opacity,color] hover:text-red-400 focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
          {dragHandle && (
            <button
              {...dragHandle}
              aria-label="Drag card"
              className="-mr-1 -mt-0.5 cursor-grab touch-none rounded-md p-0.5 text-zinc-600 opacity-0 transition-opacity hover:text-zinc-300 focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      <Link href={`/video/${video.id}`} className="mt-1.5 block outline-none">
        {day && (
          <div className="mb-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">
            {day}
          </div>
        )}
        <p className="truncate text-[13px] font-medium leading-snug text-zinc-100 transition-colors group-hover:text-white">
          {hook}
        </p>
      </Link>

      {/* Single compact meta row: format · length · posting-window badge */}
      <div className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[10px] text-zinc-500">
        <Film className="icon-pop h-3 w-3 shrink-0" strokeWidth={1.75} />
        <span className="truncate">{video.format}</span>
        {video.lengthTarget && (
          <>
            <span className="shrink-0 text-zinc-700">·</span>
            <span className="shrink-0 font-mono text-zinc-500">{video.lengthTarget}</span>
          </>
        )}
        <span className="ml-auto shrink-0">
          <PostingWindowBadge window={video.postingWindow} />
        </span>
      </div>

      {/* Posted but not yet linked → quick deep-link to the RESULTS linker */}
      {video.status === "POSTED" && !video.instagramMediaId && (
        <Link
          href={`/video/${video.id}?tab=results`}
          className="mt-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-[#22d3ee] outline-none transition-colors hover:bg-cyan-400/10 hover:text-cyan-300 focus-visible:ring-2 focus-visible:ring-cyan-400/40"
        >
          <Link2 className="h-2.5 w-2.5" strokeWidth={2} /> Link reel
        </Link>
      )}
    </div>
  );
}
