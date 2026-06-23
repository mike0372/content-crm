"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDraggable,
  useDroppable,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Plus, RotateCcw, X } from "lucide-react";
import { Video, Status, STATUSES, STATUS_LABELS, STATUS_COLORS } from "@/lib/types";
import { VideoCard } from "@/components/VideoCard";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/controls";
import { apiSaveVideo, apiCreateVideo, apiDeleteVideo } from "@/lib/api";
import { cn } from "@/lib/utils";

function DraggableCard({ video, onDelete }: { video: Video; onDelete: (id: string) => void }) {
  const { attributes, listeners, setNodeRef, isDragging, setActivatorNodeRef } =
    useDraggable({ id: video.id });
  return (
    <div ref={setNodeRef} className={cn(isDragging && "opacity-40")}>
      <VideoCard
        video={video}
        dragHandle={{ ref: setActivatorNodeRef, ...listeners, ...attributes }}
        onDelete={onDelete}
      />
    </div>
  );
}

function Column({
  status,
  videos,
  onDelete,
}: {
  status: Status;
  videos: Video[];
  onDelete: (id: string) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const c = STATUS_COLORS[status];
  return (
    <div id={`col-${status}`} className="flex w-[300px] shrink-0 flex-col">
      <div className="mb-3 flex items-center gap-2 px-1">
        <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
        <h2 className="font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-400">
          {STATUS_LABELS[status]}
        </h2>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium tabular-nums text-zinc-500">
          {videos.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[140px] flex-1 flex-col gap-3 rounded-2xl border border-dashed border-white/[0.05] bg-surface/40 p-3 transition-colors duration-150",
          isOver && "border-accent/40 bg-accent/[0.06]"
        )}
      >
        {videos.map((v) => (
          <DraggableCard key={v.id} video={v} onDelete={onDelete} />
        ))}
        {videos.length === 0 && (
          <div className="grid flex-1 place-items-center rounded-lg text-xs text-zinc-600">
            Drop here
          </div>
        )}
      </div>
    </div>
  );
}

function isResultsEmpty(v: Video): boolean {
  const r = v.results;
  return (
    r.viewsIG == null &&
    r.viewsFB == null &&
    r.skipRate == null &&
    r.likes == null &&
    r.comments == null &&
    r.saves == null &&
    r.follows == null &&
    !r.topSource &&
    !r.verdict &&
    !r.lesson
  );
}

const UNDO_MS = 5000;

export function BoardClient({ initialVideos }: { initialVideos: Video[] }) {
  const router = useRouter();
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [undoItem, setUndoItem] = useState<{ video: Video; progress: number } | null>(null);
  const undoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const undoRaf = useRef<number | null>(null);
  const undoStart = useRef<number>(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToColumn = useCallback((status: Status) => {
    const col = document.getElementById(`col-${status}`);
    if (!col || !scrollRef.current) return;
    const container = scrollRef.current;
    const colLeft = col.offsetLeft;
    container.scrollTo({ left: colLeft - 28, behavior: "smooth" });
  }, []);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const byStatus = useMemo(() => {
    const map: Record<Status, Video[]> = {
      TO_SHOOT: [],
      SHOT: [],
      EDITED: [],
      POSTED: [],
      ANALYZED: [],
    };
    for (const v of videos) map[v.status].push(v);
    return map;
  }, [videos]);

  const active = videos.find((v) => v.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const id = String(active.id);
    const newStatus = String(over.id) as Status;
    if (!STATUSES.includes(newStatus)) return;
    const current = videos.find((v) => v.id === id);
    if (!current || current.status === newStatus) return;

    const updated: Video = {
      ...current,
      status: newStatus,
      statusHistory: [
        ...current.statusHistory,
        { status: newStatus, timestamp: new Date().toISOString() },
      ],
    };
    setVideos((prev) => prev.map((v) => (v.id === id ? updated : v)));
    try {
      await apiSaveVideo(updated);
    } catch {
      setVideos((prev) => prev.map((v) => (v.id === id ? current : v)));
      return;
    }

    // Dropped into Analyzed with no results yet → prompt to add them
    if (newStatus === "ANALYZED" && isResultsEmpty(updated)) {
      const go = window.confirm(
        "This reel has no results yet.\n\nAdd results now?"
      );
      if (go) router.push(`/video/${id}?tab=RESULTS`);
    }
  }

  async function addVideo() {
    const v = await apiCreateVideo({ title: "Untitled Reel" });
    setVideos((prev) => [...prev, v]);
  }

  function clearUndo() {
    if (undoTimer.current) clearTimeout(undoTimer.current);
    if (undoRaf.current) cancelAnimationFrame(undoRaf.current);
    undoTimer.current = null;
    undoRaf.current = null;
  }

  function deleteVideo(id: string) {
    const target = videos.find((v) => v.id === id);
    if (!target) return;

    // If there's already a pending undo, commit it now before starting a new one
    if (undoItem) {
      clearUndo();
      apiDeleteVideo(undoItem.video.id).catch(() => {});
    }

    setVideos((prev) => prev.filter((v) => v.id !== id));
    setUndoItem({ video: target, progress: 1 });
    undoStart.current = performance.now();

    function tick() {
      const elapsed = performance.now() - undoStart.current;
      const remaining = Math.max(0, 1 - elapsed / UNDO_MS);
      setUndoItem((prev) => (prev ? { ...prev, progress: remaining } : null));
      if (remaining > 0) {
        undoRaf.current = requestAnimationFrame(tick);
      }
    }
    undoRaf.current = requestAnimationFrame(tick);

    undoTimer.current = setTimeout(() => {
      clearUndo();
      setUndoItem(null);
      apiDeleteVideo(id).catch(() => {});
    }, UNDO_MS);
  }

  function restoreVideo() {
    if (!undoItem) return;
    clearUndo();
    setVideos((prev) => [...prev, undoItem.video]);
    setUndoItem(null);
  }

  function dismissUndo() {
    if (!undoItem) return;
    clearUndo();
    apiDeleteVideo(undoItem.video.id).catch(() => {});
    setUndoItem(null);
  }

  return (
    <>
      <PageHeader
        title="Board"
        subtitle="Drag reels through the production pipeline"
      >
        <Button variant="primary" onClick={addVideo}>
          <Plus className="h-4 w-4" strokeWidth={1.75} /> New Reel
        </Button>
      </PageHeader>

      {/* Stage quick-nav */}
      <div className="flex items-center gap-1.5 px-7 pb-1 pt-0">
        {STATUSES.map((s) => {
          const c = STATUS_COLORS[s];
          return (
            <button
              key={s}
              onClick={() => scrollToColumn(s)}
              className="flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-zinc-500 outline-none transition-colors hover:border-white/[0.12] hover:bg-white/[0.07] hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 active:scale-95"
            >
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", c.dot)} />
              {STATUS_LABELS[s]}
              <span className="tabular-nums text-zinc-600">{byStatus[s].length}</span>
            </button>
          );
        })}
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div ref={scrollRef} className="flex gap-5 overflow-x-auto px-7 py-6">
          {STATUSES.map((s) => (
            <Column key={s} status={s} videos={byStatus[s]} onDelete={deleteVideo} />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {active ? (
            <div className="w-[276px]">
              <VideoCard video={active} dragging />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Undo toast */}
      <div
        className={cn(
          "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-[opacity,transform] duration-300",
          undoItem ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center gap-3 rounded-2xl border border-white/[0.10] bg-[rgba(15,23,36,0.88)] px-4 py-3 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-xl">
          {/* Progress bar */}
          <div className="relative h-[3px] w-32 overflow-hidden rounded-full bg-white/[0.08]">
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-red-500/70 transition-none"
              style={{ width: `${(undoItem?.progress ?? 0) * 100}%` }}
            />
          </div>
          <span className="text-sm text-zinc-300">Reel deleted</span>
          <button
            onClick={restoreVideo}
            className="flex items-center gap-1.5 rounded-lg bg-white/[0.07] px-3 py-1.5 text-xs font-semibold text-white outline-none transition-colors hover:bg-white/[0.13] focus-visible:ring-2 focus-visible:ring-white/30 active:scale-95"
          >
            <RotateCcw className="h-3 w-3" strokeWidth={2.5} /> Restore
          </button>
          <button
            onClick={dismissUndo}
            aria-label="Dismiss"
            className="rounded-md p-1 text-zinc-500 outline-none transition-colors hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-white/20"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
          </button>
        </div>
      </div>
    </>
  );
}
