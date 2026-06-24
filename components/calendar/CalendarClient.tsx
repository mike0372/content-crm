"use client";

import {
  useMemo, useState, useRef, useEffect, useCallback,
} from "react";
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable, pointerWithin,
  type DragStartEvent, type DragEndEvent,
} from "@dnd-kit/core";
import {
  CalendarPlus, FileDown, Loader2, ChevronLeft, ChevronRight,
  X, ExternalLink, Calendar, List,
} from "lucide-react";
import Link from "next/link";
import {
  Video, CalendarWeek, DayKey, DAY_KEYS, DAY_LABELS,
  PILLAR_HEX, Pillar, PILLARS,
  WINDOW_DEFAULT_START, windowForMinutes,
} from "@/lib/types";
import { Button } from "@/components/ui/controls";
import { PillarBadge, StatusBadge } from "@/components/ui/Badge";
import { LiveIndicator, ConnectionBar } from "@/components/ui/LiveIndicator";
import { Toast, useToast } from "@/components/ui/Toast";
import { useLiveSync } from "@/lib/useLiveSync";
import {
  apiSaveCalendar, apiCreateVideo, apiGetCalendar, apiSaveVideo, apiGetVideos,
} from "@/lib/api";
import {
  mondayOf, weekDates, fmtDate, weekRangeLabel, isoWeek,
  monthViewMondays,
} from "@/lib/week";
import { cn } from "@/lib/utils";

// ── Time grid constants ──────────────────────────────────────────────────────
const HOUR_HEIGHT  = 64;
const START_HOUR   = 6;
const END_HOUR     = 24;
const TOTAL_HOURS  = END_HOUR - START_HOUR;
const DAY_START_MIN = START_HOUR * 60;
const DAY_END_MIN   = END_HOUR * 60;
const SNAP_MIN     = 15;   // drag/resize snapping
const MIN_DURATION = 15;
const DEFAULT_DURATION = 60;

// ── Time helpers ──────────────────────────────────────────────────────────────
function parseHHMM(t: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(t.trim());
  if (!m) return null;
  const h = +m[1], mm = +m[2];
  if (h > 23 || mm > 59) return null;
  return h * 60 + mm;
}
function fmtHHMM(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function fmt12(min: number): string {
  const h = Math.floor(min / 60), m = min % 60;
  const ap = h < 12 || h === 24 ? "AM" : "PM";
  let hh = h % 12; if (hh === 0) hh = 12;
  return m === 0 ? `${hh} ${ap}` : `${hh}:${String(m).padStart(2, "0")} ${ap}`;
}
function startMinOf(v: Video): number {
  const p = v.scheduledTime ? parseHHMM(v.scheduledTime) : null;
  if (p !== null) return p;
  if (v.postingWindow) return WINDOW_DEFAULT_START[v.postingWindow];
  return 18 * 60;
}
function durationOf(v: Video): number {
  return v.durationMin && v.durationMin > 0 ? v.durationMin : DEFAULT_DURATION;
}
const snap = (min: number) => Math.round(min / SNAP_MIN) * SNAP_MIN;
const clampStart = (min: number, dur: number) =>
  Math.max(DAY_START_MIN, Math.min(min, DAY_END_MIN - dur));

function formatHour(h: number): string {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function emptyClientWeek(week: string): CalendarWeek {
  return { week, days: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } };
}

// ── Overlap layout ────────────────────────────────────────────────────────────
// Assigns each event a column index + total columns so overlapping blocks sit
// side-by-side. Returns events keyed by id.
interface Placed { video: Video; start: number; dur: number; col: number; cols: number; }
function layoutDay(videos: Video[]): Placed[] {
  const evs = videos
    .map(v => ({ video: v, start: startMinOf(v), dur: durationOf(v) }))
    .sort((a, b) => a.start - b.start || a.dur - b.dur);

  const placed: Placed[] = [];
  let cluster: (Placed & { end: number })[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const colEnds: number[] = []; // last end time per column
    for (const e of cluster) {
      let c = colEnds.findIndex(end => end <= e.start);
      if (c === -1) { c = colEnds.length; colEnds.push(e.end); }
      else colEnds[c] = e.end;
      e.col = c;
    }
    const total = colEnds.length;
    for (const e of cluster) { e.cols = total; placed.push(e); }
    cluster = [];
    clusterEnd = -1;
  };

  for (const e of evs) {
    const end = e.start + e.dur;
    const item = { ...e, end, col: 0, cols: 1 } as Placed & { end: number };
    if (cluster.length && e.start >= clusterEnd) flush();
    cluster.push(item);
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return placed;
}

// ── Event Popover ────────────────────────────────────────────────────────────

function EventPopover({
  video,
  anchorRect,
  onClose,
  onRemove,
}: {
  video: Video;
  anchorRect: DOMRect;
  onClose: () => void;
  onRemove: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [onClose]);

  const gap = 8;
  const popW = 260;
  let left = anchorRect.right + gap;
  if (left + popW > window.innerWidth - 16) left = anchorRect.left - popW - gap;
  const top = Math.min(anchorRect.top, window.innerHeight - 280);
  const hex = PILLAR_HEX[video.pillar];
  const hook = video.hook.line1 || video.title;
  const start = startMinOf(video);
  const dur = durationOf(video);

  return (
    <div
      ref={ref}
      style={{ position: "fixed", top, left, width: popW, zIndex: 50 }}
      className="animate-fade-in overflow-hidden rounded-xl border border-white/[0.12] bg-floating shadow-[0_8px_40px_-8px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)]"
    >
      <div style={{ background: hex, height: 4 }} />
      <div className="p-4">
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded-md p-1 text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-200 transition-colors"
        >
          <X className="h-3.5 w-3.5" />
        </button>
        <p className="pr-6 text-[13px] font-semibold leading-snug text-white">{hook}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <PillarBadge pillar={video.pillar} />
          <StatusBadge status={video.status} />
        </div>
        <p className="mt-3 text-[11px] text-zinc-500">
          {fmt12(start)} – {fmt12(start + dur)}
          {video.postingWindow && <span className="text-zinc-600"> · {video.postingWindow.replace(/ \(.*\)/, "")}</span>}
        </p>
        <div className="mt-4 flex items-center gap-2">
          <Link
            href={`/video/${video.id}`}
            onClick={onClose}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-accent/20 py-1.5 text-[12px] font-medium text-accent-foreground hover:bg-accent/30 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Open editor
          </Link>
          <button
            onClick={() => { onRemove(video.id); onClose(); }}
            className="rounded-lg px-3 py-1.5 text-[12px] text-zinc-500 hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
          >
            Remove
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Draggable + resizable event block ─────────────────────────────────────────

function DraggableEvent({
  video,
  start,
  dur,
  colIndex,
  colTotal,
  onPopover,
  onResize,
}: {
  video: Video;
  start: number;
  dur: number;
  colIndex: number;
  colTotal: number;
  onPopover: (video: Video, rect: DOMRect) => void;
  onResize: (video: Video, durationMin: number) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: video.id });
  const [liveDur, setLiveDur] = useState<number | null>(null);

  const hex = PILLAR_HEX[video.pillar];
  const hook = video.hook.line1 || video.title;
  const shownDur = liveDur ?? dur;

  const top    = ((start - DAY_START_MIN) / 60) * HOUR_HEIGHT + 1;
  const height = (shownDur / 60) * HOUR_HEIGHT - 2;

  const colWidth = 1 / colTotal;
  const leftPct  = colIndex * colWidth * 100;
  const widthPct = colWidth * 100;

  function onResizeDown(e: React.PointerEvent) {
    e.stopPropagation();
    e.preventDefault();
    const startY = e.clientY;
    const base = dur;
    const compute = (clientY: number) => {
      const deltaMin = ((clientY - startY) / HOUR_HEIGHT) * 60;
      let nd = snap(base + deltaMin);
      nd = Math.max(MIN_DURATION, Math.min(nd, DAY_END_MIN - start));
      return nd;
    };
    const move = (ev: PointerEvent) => setLiveDur(compute(ev.clientY));
    const up = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      const nd = compute(ev.clientY);
      setLiveDur(null);
      if (nd !== dur) onResize(video, nd);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  return (
    <div
      ref={setNodeRef}
      style={{
        position: "absolute",
        top,
        height,
        left: `calc(${leftPct}% + 3px)`,
        width: `calc(${widthPct}% - 6px)`,
        zIndex: isDragging ? 0 : 1,
      }}
      className="touch-none"
    >
      <div
        {...attributes}
        {...listeners}
        style={{ backgroundColor: hex, boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.15)" }}
        className={cn(
          "h-full overflow-hidden rounded-lg px-2 py-1 cursor-grab select-none transition-[opacity,filter] duration-150 active:cursor-grabbing",
          isDragging ? "opacity-40" : "hover:brightness-110"
        )}
        onClick={(e) => {
          if (!isDragging) {
            e.stopPropagation();
            onPopover(video, (e.currentTarget.parentElement as HTMLElement).getBoundingClientRect());
          }
        }}
      >
        <p className="truncate text-[11px] font-semibold leading-tight text-white">{hook}</p>
        {height >= 30 && (
          <p className="mt-0.5 truncate text-[10px] text-white/70">
            {fmt12(start)}–{fmt12(start + shownDur)}
          </p>
        )}
        {height >= 70 && colTotal === 1 && (
          <p className="mt-0.5 truncate text-[10px] text-white/55">{video.pillar}</p>
        )}
      </div>
      {/* Resize handle */}
      <div
        onPointerDown={onResizeDown}
        className="absolute inset-x-0 bottom-0 h-2 cursor-ns-resize"
      >
        <div className="mx-auto mt-0.5 h-0.5 w-6 rounded-full bg-white/40" />
      </div>
    </div>
  );
}

// Overlay shown while dragging
function DragOverlayEvent({ video }: { video: Video }) {
  const hex = PILLAR_HEX[video.pillar];
  const dur = durationOf(video);
  return (
    <div
      style={{
        width: 150,
        height: (dur / 60) * HOUR_HEIGHT - 2,
        backgroundColor: hex,
        boxShadow: `0 8px 32px -8px ${hex}99, 0 0 0 1px rgba(255,255,255,0.2)`,
        opacity: 0.9,
      }}
      className="overflow-hidden rounded-lg px-2 py-1"
    >
      <p className="truncate text-[11px] font-semibold text-white">
        {video.hook.line1 || video.title}
      </p>
    </div>
  );
}

// ── Week day column (droppable) ───────────────────────────────────────────────

function WeekDayColumn({
  dayKey, isToday, videos, onAdd, onPopover, onResize, dragJustFinished,
}: {
  dayKey: DayKey;
  isToday: boolean;
  videos: Video[];
  onAdd: (day: DayKey, startMin: number) => void;
  onPopover: (video: Video, rect: DOMRect) => void;
  onResize: (video: Video, durationMin: number) => void;
  dragJustFinished: React.MutableRefObject<boolean>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: dayKey });
  const placed = useMemo(() => layoutDay(videos), [videos]);

  function onColumnClick(e: React.MouseEvent<HTMLDivElement>) {
    if (dragJustFinished.current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const min = clampStart(snap(DAY_START_MIN + (y / HOUR_HEIGHT) * 60), DEFAULT_DURATION);
    onAdd(dayKey, min);
  }

  return (
    <div
      ref={setNodeRef}
      onClick={onColumnClick}
      className={cn(
        "group/col relative flex-1 cursor-copy border-l border-white/[0.05] transition-colors",
        isToday && "bg-blue-500/[0.025]",
        isOver && "bg-white/[0.04]"
      )}
      style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}
    >
      {/* Hour lines */}
      {Array.from({ length: TOTAL_HOURS }, (_, i) => (
        <div key={i} className="pointer-events-none absolute left-0 right-0 border-t border-white/[0.05]" style={{ top: i * HOUR_HEIGHT }} />
      ))}
      {/* Half-hour lines */}
      {Array.from({ length: TOTAL_HOURS }, (_, i) => (
        <div key={`h${i}`} className="pointer-events-none absolute left-0 right-0 border-t border-white/[0.025]" style={{ top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }} />
      ))}
      <div className="pointer-events-none absolute bottom-0 left-0 right-0 border-t border-white/[0.05]" />

      {placed.map(p => (
        <DraggableEvent
          key={p.video.id}
          video={p.video}
          start={p.start}
          dur={p.dur}
          colIndex={p.col}
          colTotal={p.cols}
          onPopover={onPopover}
          onResize={onResize}
        />
      ))}
    </div>
  );
}

// ── Month view ───────────────────────────────────────────────────────────────

function MonthView({
  baseDate,
  weekCalendars,
  videoById,
  hiddenPillars,
  onDayClick,
}: {
  baseDate: Date;
  weekCalendars: Record<string, CalendarWeek>;
  videoById: Map<string, Video>;
  hiddenPillars: Set<Pillar>;
  onDayClick: (date: Date) => void;
}) {
  const year  = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const today = new Date();
  const mondays = useMemo(() => monthViewMondays(year, month), [year, month]);

  const DAY_ABBRS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex flex-shrink-0 border-b border-white/[0.07]">
        {DAY_ABBRS.map(d => (
          <div key={d} className="flex-1 py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            {d}
          </div>
        ))}
      </div>

      <div className="flex flex-1 flex-col divide-y divide-white/[0.05] overflow-hidden">
        {mondays.map(monday => {
          const wk = isoWeek(monday);
          const cal = weekCalendars[wk];
          const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday);
            d.setDate(d.getDate() + i);
            return d;
          });

          return (
            <div key={wk} className="flex flex-1 divide-x divide-white/[0.05]">
              {days.map((date, i) => {
                const dk = DAY_KEYS[i];
                const isCurrentMonth = date.getMonth() === month;
                const isToday = date.toDateString() === today.toDateString();
                const videoIds: string[] = cal?.days[dk] ?? [];
                const dayVideos = videoIds
                  .map(id => videoById.get(id))
                  .filter((v): v is Video => !!v && !hiddenPillars.has(v.pillar))
                  .sort((a, b) => startMinOf(a) - startMinOf(b));

                return (
                  <div
                    key={dk}
                    className={cn(
                      "flex flex-1 cursor-pointer flex-col gap-1 p-1.5 transition-colors hover:bg-white/[0.02]",
                      !isCurrentMonth && "opacity-35"
                    )}
                    onClick={() => onDayClick(date)}
                  >
                    <div className="flex justify-end">
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-medium",
                          isToday ? "bg-blue-500 text-white" : "text-zinc-400"
                        )}
                      >
                        {date.getDate()}
                      </span>
                    </div>
                    {dayVideos.slice(0, 3).map(v => (
                      <div
                        key={v.id}
                        style={{ backgroundColor: PILLAR_HEX[v.pillar] }}
                        className="truncate rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                        onClick={e => e.stopPropagation()}
                      >
                        <Link href={`/video/${v.id}`} className="block truncate">
                          {fmt12(startMinOf(v))} {v.hook.line1 || v.title}
                        </Link>
                      </div>
                    ))}
                    {dayVideos.length > 3 && (
                      <div className="px-1 text-[10px] text-zinc-600">+{dayVideos.length - 3} more</div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export function CalendarClient({
  initialVideos,
  initialCalendar,
}: {
  initialVideos: Video[];
  initialCalendar: CalendarWeek;
}) {
  const [videos, setVideos] = useState<Video[]>(initialVideos);
  const [weekCalendars, setWeekCalendars] = useState<Record<string, CalendarWeek>>({
    [initialCalendar.week]: initialCalendar,
  });
  const [activeId, setActiveId]     = useState<string | null>(null);
  const [exporting, setExporting]   = useState(false);
  const [view, setView]             = useState<"week" | "month">("week");
  const [baseDate, setBaseDate]     = useState(() => new Date());
  const [hiddenPillars, setHiddenPillars] = useState<Set<Pillar>>(new Set());
  const [popover, setPopover]       = useState<{ video: Video; rect: DOMRect } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const dragJustFinished = useRef(false);
  const { message: toast, show: showToast } = useToast();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // ── Derived week data
  const monday   = useMemo(() => mondayOf(baseDate), [baseDate]);
  const weekKey  = useMemo(() => isoWeek(monday), [monday]);
  const dates    = useMemo(() => weekDates(monday), [monday]);
  const todayKey = useMemo<DayKey | null>(() => {
    const t = new Date();
    return DAY_KEYS.find(k => dates[k].toDateString() === t.toDateString()) ?? null;
  }, [dates]);

  const calendar = useMemo(
    () => weekCalendars[weekKey] ?? emptyClientWeek(weekKey),
    [weekCalendars, weekKey]
  );

  const videoById = useMemo(() => {
    const m = new Map<string, Video>();
    videos.forEach(v => m.set(v.id, v));
    return m;
  }, [videos]);

  const activeVideo = activeId ? videoById.get(activeId) ?? null : null;

  // ── Live sync: poll videos + the currently-viewed week so reels and their
  // calendar placement stay in step with edits from other tabs/devices.
  const liveFetch = useCallback(
    () => Promise.all([apiGetVideos(), apiGetCalendar(weekKey)]),
    [weekKey]
  );
  const { status, mute } = useLiveSync(liveFetch, ([vids, cal]) => {
    if (activeId) return; // never reshuffle mid-drag
    setVideos(vids as Video[]);
    setWeekCalendars((prev) => ({ ...prev, [cal.week]: cal as CalendarWeek }));
  });

  // ── Load week when navigating
  useEffect(() => {
    if (weekCalendars[weekKey]) return;
    apiGetCalendar(weekKey)
      .then(cal => setWeekCalendars(prev => ({ ...prev, [cal.week]: cal })))
      .catch(() => {});
  }, [weekKey]);

  // ── Load all weeks when entering month view
  useEffect(() => {
    if (view !== "month") return;
    const mondays = monthViewMondays(baseDate.getFullYear(), baseDate.getMonth());
    mondays.forEach(m => {
      const wk = isoWeek(m);
      if (weekCalendars[wk]) return;
      apiGetCalendar(wk)
        .then(cal => setWeekCalendars(prev => ({ ...prev, [cal.week]: cal })))
        .catch(() => {});
    });
  }, [view, baseDate.getFullYear(), baseDate.getMonth()]);

  // ── Current time indicator
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  const currentTimeTop = useMemo(() => {
    if (!todayKey) return null;
    const h = now.getHours() + now.getMinutes() / 60;
    if (h < START_HOUR || h >= END_HOUR) return null;
    return (h - START_HOUR) * HOUR_HEIGHT;
  }, [now, todayKey]);

  // ── Scroll to 8 AM on mount
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: (8 - START_HOUR) * HOUR_HEIGHT - 16 });
  }, []);

  // ── Header label
  const headerLabel = useMemo(() => {
    if (view === "month") {
      return baseDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    const sun = new Date(monday); sun.setDate(monday.getDate() + 6);
    if (monday.getMonth() === sun.getMonth()) {
      return monday.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    }
    return `${monday.toLocaleDateString("en-US", { month: "short" })} – ${sun.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
  }, [view, baseDate, monday]);

  // ── Navigation
  function goToToday() { setBaseDate(new Date()); }
  function goToPrev() {
    setBaseDate(d => {
      const n = new Date(d);
      view === "week" ? n.setDate(n.getDate() - 7) : n.setMonth(n.getMonth() - 1);
      return n;
    });
  }
  function goToNext() {
    setBaseDate(d => {
      const n = new Date(d);
      view === "week" ? n.setDate(n.getDate() + 7) : n.setMonth(n.getMonth() + 1);
      return n;
    });
  }

  // ── Persist helpers (optimistic; revert + toast on failure)
  function persistCalendar(next: CalendarWeek) {
    const prevCal = weekCalendars[next.week];
    mute();
    setWeekCalendars(prev => ({ ...prev, [next.week]: next }));
    apiSaveCalendar(next).catch(() => {
      setWeekCalendars(prev => ({
        ...prev,
        [next.week]: prevCal ?? emptyClientWeek(next.week),
      }));
      showToast("Sync failed — retrying");
    });
  }

  function patchVideo(updated: Video) {
    const prev = videoById.get(updated.id);
    mute();
    setVideos(p => p.map(v => v.id === updated.id ? updated : v));
    apiSaveVideo(updated).catch(() => {
      if (prev) setVideos(p => p.map(v => v.id === updated.id ? prev : v));
      showToast("Sync failed — retrying");
    });
  }

  function togglePillar(p: Pillar) {
    setHiddenPillars(prev => {
      const next = new Set(prev);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }

  // ── DnD handlers
  function onDragEnd(e: DragEndEvent) {
    dragJustFinished.current = true;
    setTimeout(() => { dragJustFinished.current = false; }, 0);

    setActiveId(null);
    const { active, over, delta } = e;
    if (!over) return;

    const videoId   = String(active.id);
    const targetDay = DAY_KEYS.includes(over.id as DayKey) ? (over.id as DayKey) : null;
    if (!targetDay) return;

    const video = videoById.get(videoId);
    if (!video) return;

    // Find source day in the current week
    let sourceDay: DayKey | undefined;
    for (const d of DAY_KEYS) {
      if ((weekCalendars[weekKey]?.days[d] ?? []).includes(videoId)) { sourceDay = d; break; }
    }
    if (!sourceDay) return;

    const dur      = durationOf(video);
    const oldStart = startMinOf(video);
    const newStart = clampStart(snap(oldStart + (delta.y / HOUR_HEIGHT) * 60), dur);

    const dayChanged  = sourceDay !== targetDay;
    const timeChanged = newStart !== oldStart;
    if (!dayChanged && !timeChanged) return;

    if (dayChanged) {
      const nextCal: CalendarWeek = { ...calendar, days: { ...calendar.days } };
      nextCal.days[sourceDay] = nextCal.days[sourceDay].filter(id => id !== videoId);
      nextCal.days[targetDay] = [...(nextCal.days[targetDay] ?? []), videoId];
      persistCalendar(nextCal);
    }

    if (timeChanged) {
      patchVideo({ ...video, scheduledTime: fmtHHMM(newStart), postingWindow: windowForMinutes(newStart) });
    }
  }

  async function addToDay(dayKey: DayKey, startMin: number) {
    if (dragJustFinished.current) return;
    mute();
    let v: Video;
    try {
      v = await apiCreateVideo({
        title: "Untitled Reel",
        scheduledTime: fmtHHMM(startMin),
        durationMin: DEFAULT_DURATION,
        postingWindow: windowForMinutes(startMin),
      });
    } catch {
      showToast("Sync failed — retrying");
      return;
    }
    setVideos(prev => [...prev, v]);
    const nextCal: CalendarWeek = {
      ...calendar,
      days: { ...calendar.days, [dayKey]: [...(calendar.days[dayKey] ?? []), v.id] },
    };
    persistCalendar(nextCal);
  }

  function onResize(video: Video, durationMin: number) {
    patchVideo({ ...video, durationMin });
  }

  function removeFromCalendar(videoId: string) {
    const nextCal: CalendarWeek = { ...calendar, days: { ...calendar.days } };
    for (const d of DAY_KEYS) {
      if (nextCal.days[d].includes(videoId)) {
        nextCal.days[d] = nextCal.days[d].filter(id => id !== videoId);
        break;
      }
    }
    persistCalendar(nextCal);
  }

  async function exportPdf() {
    setExporting(true);
    try {
      const { generateWeekPdf } = await import("@/components/pdf/generateWeekPdf");
      const ordered = DAY_KEYS.flatMap(k => calendar.days[k] ?? [])
        .map(id => videoById.get(id))
        .filter(Boolean) as Video[];
      await generateWeekPdf({
        weekLabel: calendar.week,
        rangeLabel: weekRangeLabel(monday),
        days: DAY_KEYS.map(k => ({
          label: DAY_LABELS[k],
          date: fmtDate(dates[k]),
          video: (calendar.days[k]?.[0]) ? videoById.get(calendar.days[k][0]) ?? null : null,
        })),
        videos: ordered,
      });
    } finally {
      setExporting(false);
    }
  }

  // ── Visible videos for a day (respect pillar filter)
  function visibleVideos(ids: string[]): Video[] {
    return ids
      .map(id => videoById.get(id))
      .filter((v): v is Video => !!v && !hiddenPillars.has(v.pillar));
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <ConnectionBar status={status} />

      {/* ── Top navigation bar ── */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-white/[0.09] bg-[rgba(5,15,30,0.55)] px-5 py-3 backdrop-blur-[40px] shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]">
        <h1 className="text-[17px] font-bold tracking-[-0.025em] text-white">Calendar</h1>

        <div className="ml-1 flex rounded-lg border border-white/[0.1] p-0.5">
          <button
            onClick={() => setView("week")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
              view === "week" ? "bg-white/[0.1] text-white" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <Calendar className="h-3.5 w-3.5" /> Week
          </button>
          <button
            onClick={() => setView("month")}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors",
              view === "month" ? "bg-white/[0.1] text-white" : "text-zinc-500 hover:text-zinc-300"
            )}
          >
            <List className="h-3.5 w-3.5" /> Month
          </button>
        </div>

        <div className="ml-1 flex items-center gap-1">
          <button
            onClick={goToToday}
            className="rounded-lg border border-white/[0.1] px-3 py-1 text-[12px] font-medium text-zinc-300 transition-colors hover:border-white/[0.2] hover:text-white"
          >
            Today
          </button>
          <button onClick={goToPrev} className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200">
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </button>
          <button onClick={goToNext} className="rounded-lg p-1.5 text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-200">
            <ChevronRight className="h-4 w-4" strokeWidth={2} />
          </button>
          <span className="ml-1 text-[14px] font-semibold text-zinc-200">{headerLabel}</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <LiveIndicator status={status} />
          <Button onClick={() => persistCalendar(emptyClientWeek(weekKey))}>
            <CalendarPlus className="h-4 w-4" strokeWidth={1.75} /> New Week
          </Button>
          <Button variant="primary" onClick={exportPdf} disabled={exporting}>
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
            Export PDF
          </Button>
        </div>
      </div>

      {/* ── Pillar filter chips ── */}
      <div className="flex flex-shrink-0 items-center gap-1.5 border-b border-white/[0.06] bg-[rgba(5,15,30,0.3)] px-5 py-2">
        <span className="mr-1 text-[11px] font-medium text-zinc-600">Filter:</span>
        {PILLARS.map(p => {
          const hidden = hiddenPillars.has(p);
          const hex    = PILLAR_HEX[p];
          return (
            <button
              key={p}
              onClick={() => togglePillar(p)}
              style={hidden ? {} : { borderColor: `${hex}60`, backgroundColor: `${hex}18`, color: hex }}
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-[transform,color,background-color,border-color,opacity] duration-200 hover:-translate-y-px active:scale-95",
                hidden
                  ? "border-white/[0.08] text-zinc-600 hover:border-white/[0.15] hover:text-zinc-400"
                  : "opacity-100"
              )}
            >
              {p}
            </button>
          );
        })}
        {hiddenPillars.size > 0 && (
          <button
            onClick={() => setHiddenPillars(new Set())}
            className="ml-1 text-[11px] text-zinc-600 hover:text-zinc-400 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* ── Month view ── */}
      {view === "month" && (
        <MonthView
          baseDate={baseDate}
          weekCalendars={weekCalendars}
          videoById={videoById}
          hiddenPillars={hiddenPillars}
          onDayClick={(date) => {
            setBaseDate(date);
            setView("week");
          }}
        />
      )}

      {/* ── Week view ── */}
      {view === "week" && (
        <>
          {/* Day column headers */}
          <div className="flex flex-shrink-0 border-b border-white/[0.09] bg-[rgba(5,15,30,0.35)]">
            <div className="w-14 flex-shrink-0 border-r border-white/[0.05]" />
            {DAY_KEYS.map((k, i) => {
              const isToday = todayKey === k;
              return (
                <div
                  key={k}
                  style={{ animationDelay: `${i * 45}ms` }}
                  className="flex flex-1 animate-fade-in-down flex-col items-center border-l border-white/[0.05] py-2"
                >
                  <span className={cn("text-[10px] font-semibold uppercase tracking-[0.12em]", isToday ? "text-blue-400" : "text-zinc-600")}>
                    {DAY_LABELS[k].slice(0, 3)}
                  </span>
                  <div className={cn(
                    "mt-0.5 flex h-8 w-8 items-center justify-center rounded-full text-[18px] font-medium transition-colors",
                    isToday ? "bg-blue-500 text-white" : "text-zinc-300 hover:bg-white/[0.07]"
                  )}>
                    {dates[k].getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Scrollable time grid */}
          <DndContext
            sensors={sensors}
            collisionDetection={pointerWithin}
            onDragStart={(e: DragStartEvent) => {
              mute(15000);
              setActiveId(String(e.active.id));
            }}
            onDragEnd={onDragEnd}
          >
            <div ref={scrollRef} className="flex flex-1 overflow-y-auto">
              {/* Hour labels */}
              <div className="relative w-14 flex-shrink-0 border-r border-white/[0.05]" style={{ height: TOTAL_HOURS * HOUR_HEIGHT }}>
                {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
                  const h = START_HOUR + i;
                  return (
                    <div key={h} style={{ position: "absolute", top: i * HOUR_HEIGHT }} className="right-2">
                      {i > 0 && (
                        <span className="absolute -top-2 right-2 select-none text-[10px] text-zinc-600 whitespace-nowrap">
                          {formatHour(h)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Day columns */}
              <div className="relative flex flex-1">
                {DAY_KEYS.map(k => (
                  <WeekDayColumn
                    key={k}
                    dayKey={k}
                    isToday={todayKey === k}
                    videos={visibleVideos(calendar.days[k] ?? [])}
                    onAdd={addToDay}
                    onPopover={(v, rect) => setPopover({ video: v, rect })}
                    onResize={onResize}
                    dragJustFinished={dragJustFinished}
                  />
                ))}

                {/* Current time indicator */}
                {currentTimeTop !== null && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
                    style={{ top: currentTimeTop }}
                  >
                    <div className="h-2.5 w-2.5 flex-shrink-0 animate-pulse rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.7)]" style={{ marginLeft: -5 }} />
                    <div className="h-px flex-1 bg-red-500/70" />
                  </div>
                )}
              </div>
            </div>

            <DragOverlay dropAnimation={null}>
              {activeVideo ? <DragOverlayEvent video={activeVideo} /> : null}
            </DragOverlay>
          </DndContext>
        </>
      )}

      {/* ── Event popover ── */}
      {popover && (
        <EventPopover
          video={popover.video}
          anchorRect={popover.rect}
          onClose={() => setPopover(null)}
          onRemove={removeFromCalendar}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}
