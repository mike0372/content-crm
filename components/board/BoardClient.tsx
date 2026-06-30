"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Plus, RotateCcw, X } from "lucide-react";
import { Video, Status, STATUSES, STATUS_LABELS, STATUS_COLORS } from "@/lib/types";
import { VideoCard } from "@/components/VideoCard";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/controls";
import { LiveIndicator, ConnectionBar } from "@/components/ui/LiveIndicator";
import { Toast, useToast } from "@/components/ui/Toast";
import { useLiveSync } from "@/lib/useLiveSync";
import {
  apiSaveVideo,
  apiCreateVideo,
  apiDeleteVideo,
  apiGetVideos,
  ConflictError,
} from "@/lib/api";
import { cn } from "@/lib/utils";

function SortableCard({ video, onDelete }: { video: Video; onDelete: (id: string) => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: video.id });
  const style = { transform: CSS.Translate.toString(transform), transition };
  return (
    <div ref={setNodeRef} style={style} className={cn(isDragging && "opacity-40")}>
      <VideoCard
        video={video}
        dragHandle={{ ref: setActivatorNodeRef, ...listeners, ...attributes }}
        onDelete={onDelete}
      />
    </div>
  );
}

const PAGE_SIZE = 10;

function Column({
  status,
  videos,
  onDelete,
  index = 0,
}: {
  status: Status;
  videos: Video[];
  onDelete: (id: string) => void;
  index?: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const c = STATUS_COLORS[status];
  // Per-column, independent reveal state. Resets on refresh (no persistence).
  const [visible, setVisible] = useState(PAGE_SIZE);

  const shown = videos.slice(0, visible);
  const remaining = videos.length - shown.length;
  const expanded = visible > PAGE_SIZE && videos.length > PAGE_SIZE;

  return (
    <div
      id={`col-${status}`}
      className="flex min-w-0 animate-fade-in-up flex-col"
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="mb-2.5 flex items-center gap-2 px-0.5">
        <span className={cn("h-2 w-2 rounded-full", c.dot)} />
        <h2 className="text-[15px] font-bold tracking-tight text-zinc-100">
          {STATUS_LABELS[status]}
        </h2>
        <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs font-semibold tabular-nums text-zinc-400">
          {videos.length}
        </span>
      </div>
      <div
        ref={setNodeRef}
        className={cn(
          "flex min-h-[120px] flex-col gap-2 rounded-xl border border-dashed border-white/[0.05] bg-surface/40 p-2 transition-colors duration-150",
          isOver && "border-accent/40 bg-accent/[0.06]"
        )}
      >
        <SortableContext items={shown.map((v) => v.id)} strategy={verticalListSortingStrategy}>
          {shown.map((v, i) => (
            <div
              key={v.id}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 70 + i * 35}ms` }}
            >
              <SortableCard video={v} onDelete={onDelete} />
            </div>
          ))}
        </SortableContext>

        {videos.length === 0 && (
          <div className="grid place-items-center py-3 text-[11px] text-zinc-600">
            Drop here
          </div>
        )}

        {remaining > 0 && (
          <button
            onClick={() => setVisible((v) => v + PAGE_SIZE)}
            className="mt-0.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[11px] font-medium text-zinc-400 outline-none transition-colors hover:border-white/[0.12] hover:bg-white/[0.07] hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 active:scale-[0.98]"
          >
            View more ({remaining} remaining)
          </button>
        )}

        {expanded && (
          <button
            onClick={() => setVisible(PAGE_SIZE)}
            className="self-center rounded-md px-2 py-1 text-[11px] font-medium text-zinc-600 outline-none transition-colors hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40"
          >
            Show less
          </button>
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
  const { message: toast, show: showToast } = useToast();

  // Live sync: poll the server so changes from other tabs/devices appear here.
  // Excludes any item pending local undo-delete (server still has it briefly).
  const { status, mute } = useLiveSync<Video[]>(apiGetVideos, (server) => {
    if (activeId) return; // never reshuffle mid-drag
    setVideos(server.filter((v) => v.id !== undoItem?.video.id));
  });

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
    for (const s of STATUSES) map[s].sort((a, b) => a.priority - b.priority);
    return map;
  }, [videos]);

  const active = videos.find((v) => v.id === activeId) ?? null;

  function onDragStart(e: DragStartEvent) {
    mute(15000); // hold off live updates while the user is dragging
    setActiveId(String(e.active.id));
  }

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const { active, over } = e;
    if (!over) return;
    const id = String(active.id);
    const overId = String(over.id);
    const current = videos.find((v) => v.id === id);
    if (!current) return;

    // `over` is either a column (status) when dropped on empty space, or a card.
    const overCard = videos.find((v) => v.id === overId);
    const newStatus: Status = overCard
      ? overCard.status
      : (overId as Status);
    if (!STATUSES.includes(newStatus)) return;

    // Target column ordered by priority, excluding the dragged card.
    const column = byStatus[newStatus].filter((v) => v.id !== id);
    const index =
      overCard && overCard.id !== id
        ? column.findIndex((v) => v.id === overCard.id)
        : column.length;
    const insertAt = index < 0 ? column.length : index;

    // Bail out if nothing actually moved.
    const oldOrder = byStatus[newStatus].map((v) => v.id).join();
    const next = [...column];
    next.splice(insertAt, 0, current);
    if (current.status === newStatus && next.map((v) => v.id).join() === oldOrder) {
      return;
    }

    // New fractional priority = midpoint between the neighbors at the drop slot.
    const before = column[insertAt - 1];
    const after = column[insertAt];

    // When repeated reorders between the same neighbors shrink the gap to float
    // precision, the midpoint stops separating cards. Detect that and re-space
    // the whole target column to clean integers (persisting every card whose
    // priority changed). Rare, self-healing — ordering never gets stuck.
    const EPS = 1e-6;
    const SPACING = 1000;
    let priority: number;
    let extraUpdates: Video[] = [];

    if (before && after && after.priority - before.priority < EPS) {
      const spaced = next.map((v, i) => ({ ...v, priority: (i + 1) * SPACING }));
      priority = spaced.find((v) => v.id === id)!.priority;
      extraUpdates = spaced.filter((v) => {
        if (v.id === id) return false;
        const orig = videos.find((o) => o.id === v.id);
        return !!orig && orig.priority !== v.priority;
      });
    } else if (!before && !after) priority = Date.now();
    else if (!before) priority = after.priority - 1;
    else if (!after) priority = before.priority + 1;
    else priority = (before.priority + after.priority) / 2;

    const statusChanged = current.status !== newStatus;
    const updated: Video = {
      ...current,
      status: newStatus,
      priority,
      statusHistory: statusChanged
        ? [
            ...current.statusHistory,
            { status: newStatus, timestamp: new Date().toISOString() },
          ]
        : current.statusHistory,
    };

    const changed = [updated, ...extraUpdates];
    setVideos((prev) => prev.map((v) => changed.find((c) => c.id === v.id) ?? v));
    mute();
    try {
      // Guard only the dragged card against cross-device conflicts; refresh the
      // saved versions back into state so a quick second drag isn't a false
      // conflict against our own previous write.
      const results = await Promise.all(
        changed.map((c) => apiSaveVideo(c, c.id === id ? current.updatedAt : undefined))
      );
      setVideos((prev) =>
        prev.map((v) => {
          const saved = results.find((r) => r.id === v.id);
          return saved ? { ...v, updatedAt: saved.updatedAt } : v;
        })
      );
    } catch (err) {
      // Revert every card we optimistically changed back to its pre-drag value.
      setVideos((prev) =>
        prev.map((v) => {
          const orig = videos.find((o) => o.id === v.id);
          return changed.some((c) => c.id === v.id) && orig ? orig : v;
        })
      );
      showToast(
        err instanceof ConflictError
          ? "Card changed on another device — refreshed"
          : "Sync failed — retrying"
      );
      return;
    }

    // Dropped into Analyzed with no results yet → prompt to add them
    if (statusChanged && newStatus === "ANALYZED" && isResultsEmpty(updated)) {
      const go = window.confirm(
        "This reel has no results yet.\n\nAdd results now?"
      );
      if (go) router.push(`/video/${id}?tab=RESULTS`);
    }
  }

  async function addVideo() {
    mute();
    try {
      const v = await apiCreateVideo({ title: "Untitled Reel" });
      setVideos((prev) => [...prev, v]);
    } catch {
      showToast("Sync failed — retrying");
    }
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
    mute(UNDO_MS + 4000); // keep the row hidden through the undo window + save

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
      <ConnectionBar status={status} />
      <PageHeader
        title="Board"
        subtitle="Drag reels through the production pipeline"
      >
        <LiveIndicator status={status} />
        <Button variant="primary" onClick={addVideo}>
          <Plus className="h-4 w-4" strokeWidth={1.75} /> New Reel
        </Button>
      </PageHeader>

      {/* Stage quick-nav */}
      <div className="flex items-center gap-1.5 px-7 pb-1 pt-0">
        {STATUSES.map((s, i) => {
          const c = STATUS_COLORS[s];
          return (
            <button
              key={s}
              onClick={() => scrollToColumn(s)}
              style={{ animationDelay: `${i * 45}ms` }}
              className="flex animate-fade-in-down items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-zinc-500 outline-none transition-[colors,transform] duration-200 hover:-translate-y-px hover:border-white/[0.12] hover:bg-white/[0.07] hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 active:scale-95"
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
        <div ref={scrollRef} className="grid grid-cols-5 items-start gap-4 px-7 py-5">
          {STATUSES.map((s, i) => (
            <Column key={s} status={s} videos={byStatus[s]} onDelete={deleteVideo} index={i} />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {active ? (
            <div className="w-[240px]">
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

      <Toast message={toast} />
    </>
  );
}
