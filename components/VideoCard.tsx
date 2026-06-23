"use client";

import Link from "next/link";
import { Film, GripVertical, Trash2 } from "lucide-react";
import { Video } from "@/lib/types";
import { PillarBadge, StatusBadge } from "@/components/ui/Badge";
import { PostingWindowBadge, ScorecardChip } from "@/components/ui/CardChips";
import { cn } from "@/lib/utils";

export function VideoCard({
  video,
  day,
  dragHandle,
  dragging,
  compact,
  onDelete,
}: {
  video: Video;
  day?: string;
  dragHandle?: React.HTMLAttributes<HTMLButtonElement> & {
    ref?: React.Ref<HTMLButtonElement>;
  };
  dragging?: boolean;
  compact?: boolean;
  onDelete?: (id: string) => void;
}) {
  const hook = video.hook.line1 || video.title;
  return (
    <div
      className={cn(
        "group relative rounded-xl border border-white/[0.06] bg-elevated p-3 transition-[transform,box-shadow,border-color] duration-150",
        "shadow-[0_2px_8px_-2px_rgba(0,0,0,0.5)] hover:-translate-y-0.5 hover:border-white/[0.12] hover:shadow-[0_0_0_1px_rgba(59,130,246,0.18),0_10px_30px_-12px_rgba(59,130,246,0.30)]",
        dragging && "rotate-[1.5deg] border-accent/40 shadow-[0_0_0_1px_rgba(59,130,246,0.25),0_20px_40px_-12px_rgba(59,130,246,0.45)]"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <PillarBadge pillar={video.pillar} />
        <div className="flex items-center gap-0.5">
          {onDelete && (
            <button
              onClick={(e) => { e.preventDefault(); onDelete(video.id); }}
              aria-label="Delete reel"
              className="-mt-0.5 rounded-md p-1 text-zinc-600 opacity-0 transition-[opacity,color] hover:text-red-400 group-hover:opacity-100"
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </button>
          )}
          {dragHandle && (
            <button
              {...dragHandle}
              aria-label="Drag card"
              className="-mr-1 -mt-0.5 cursor-grab touch-none rounded-md p-1 text-zinc-600 opacity-0 transition-opacity hover:text-zinc-300 group-hover:opacity-100 active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" strokeWidth={1.75} />
            </button>
          )}
        </div>
      </div>

      <Link href={`/video/${video.id}`} className="mt-2.5 block outline-none">
        {day && (
          <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.15em] text-zinc-600">
            {day}
          </div>
        )}
        <p className="line-clamp-2 text-sm font-medium leading-snug text-zinc-100 transition-colors group-hover:text-white">
          {hook}
        </p>
      </Link>

      {!compact && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-zinc-500">
          <span className="inline-flex items-center gap-1">
            <Film className="h-3 w-3" strokeWidth={1.75} /> {video.format}
          </span>
          <PostingWindowBadge window={video.postingWindow} />
        </div>
      )}
      {compact && (
        <div className="mt-2.5">
          <PostingWindowBadge window={video.postingWindow} />
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-2.5">
        <ScorecardChip video={video} />
        <div className="flex items-center gap-2">
          <StatusBadge status={video.status} />
          <span className="font-mono text-[10px] text-zinc-600">{video.lengthTarget}</span>
        </div>
      </div>
    </div>
  );
}
