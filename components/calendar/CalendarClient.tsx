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
  Plus, X, ExternalLink, Calendar, List,
} from "lucide-react";
import Link from "next/link";
import {
  Video, CalendarWeek, DayKey, DAY_KEYS, DAY_LABELS,
  PILLAR_HEX, PILLAR_COLORS, PostingWindow, POSTING_WINDOWS, Pillar, PILLARS,
} from "@/lib/types";
import { Button } from "@/components/ui/controls";
import { PillarBadge, StatusBadge } from "@/components/ui/Badge";
import { apiSaveCalendar, apiCreateVideo, apiGetCalendar, apiSaveVideo } from "@/lib/api";
import {
  mondayOf, weekDates, fmtDate, weekRangeLabel, isoWeek,
  monthViewMondays,
} from "@/lib/week";
import { cn } from "@/lib/utils";

// ── Time grid constants ──────────────────────────────────────────────────────
const HOUR_HEIGHT = 64;
const START_HOUR  = 6;
const END_HOUR    = 23;
const TOTAL_HOURS = END_HOUR - START_HOUR;

const WINDOW_SLOTS: Record<PostingWindow, { startHour: number; durationHours: number }> = {
  "Morning (7-9am)":   { startHour: 7,  durationHours: 2 },
  "Midday (11am-1pm)": { startHour: 11, durationHours: 2 },
  "Evening (6-8pm)":   { startHour: 18, durationHours: 2 },
  "Night (9-11pm)":    { startHour: 21, durationHours: 2 },
};

function windowSlot(pw: PostingWindow | ""): { startHour: number; durationHours: number } {
  return pw ? WINDOW_SLOTS[pw] : WINDOW_SLOTS["Evening (6-8pm)"];
}

function formatHour(h: number): string {
  if (h === 0 || h === 24) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

// Droppable zone ID: "{dayKey}|{windowIndex 0-3}"
function zoneId(day: DayKey, wi: number) { return `${day}|${wi}`; }
function parseZoneId(id: string): { day: DayKey; wi: number } | null {
  const parts = id.split("|");
  if (parts.length !== 2) return null;
  const wi = parseInt(parts[1]);
  if (isNaN(wi) || wi < 0 || wi >= POSTING_WINDOWS.length) return null;
  if (!DAY_KEYS.includes(parts[0] as DayKey)) return null;
  return { day: parts[0] as DayKey, wi };
}

function emptyClientWeek(week: string): CalendarWeek {
  return { week, days: { mon: [], tue: [], wed: [], thu: [], fri: [], sat: [], sun: [] } };
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

  // Position right of the anchor, flip left if too close to edge
  const gap = 8;
  const popW = 260;
  let left = anchorRect.right + gap;
  if (left + popW > window.innerWidth - 16) left = anchorRect.left - popW - gap;
  const top = Math.min(anchorRect.top, window.innerHeight - 280);
  const hex = PILLAR_HEX[video.pillar];
  const hook = video.hook.line1 || video.title;

  return (
    <div
      ref={ref}
      style={{ position: "fixed", top, left, width: popW, zIndex: 50 }}
      className="animate-fade-in overflow-hidden rounded-xl border border-white/[0.12] bg-floating shadow-[0_8px_40px_-8px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)]"
    >
      {/* Colour accent strip */}
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
        <p className="mt-3 text-[11px] text-zinc-500">{video.postingWindow}</p>
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

// ── Event block ──────────────────────────────────────────────────────────────

function EventBlock({
  video,
  colIndex = 0,
  colTotal = 1,
  isDragging = false,
  onPopover,
}: {
  video: Video;
  colIndex?: number;
  colTotal?: number;
  isDragging?: boolean;
  onPopover?: (video: Video, rect: DOMRect) => void;
}) {
  const hex = PILLAR_HEX[video.pillar];
  const hook = video.hook.line1 || video.title;
  const { durationHours } = windowSlot(video.postingWindow);
  const heightPx = durationHours * HOUR_HEIGHT - 4;

  return (
    <div
      style={{ height: heightPx, backgroundColor: hex, boxShadow: `inset 0 0 0 1px rgba(255,255,255,0.15)` }}
      className={cn(
        "overflow-hidden rounded-lg px-2 py-1.5 cursor-pointer select-none transition-[opacity,filter] duration-150",
        isDragging ? "opacity-40" : "hover:brightness-110"
      )}
      onClick={(e) => {
        if (!isDragging && onPopover) {
          e.stopPropagation();
          onPopover(video, (e.currentTarget as HTMLElement).getBoundingClientRect());
        }
      }}
    >
      <p className="truncate text-[11px] font-semibold leading-tight text-white">{hook}</p>
      {durationHours >= 1.5 && (
        <p className="mt-0.5 truncate text-[10px] text-white/70">
          {formatHour(windowSlot(video.postingWindow).startHour)}–{formatHour(windowSlot(video.postingWindow).startHour + durationHours)}
        </p>
      )}
      {durationHours >= 2 && colTotal === 1 && (
        <p className="mt-1 truncate text-[10px] text-white/55">{video.pillar}</p>
      )}
    </div>
  );
}

function DraggableEvent({
  video,
  colIndex,
  colTotal,
  onPopover,
}: {
  video: Video;
  colIndex: number;
  colTotal: number;
  onPopover: (video: Video, rect: DOMRect) => void;
}) {
  const { startHour, durationHours } = windowSlot(video.postingWindow);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: video.id });

  const colWidth = 1 / colTotal;
  const leftPct  = colIndex * colWidth * 100;
  const widthPct = colWidth * 100;

  return (
    <div
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      style={{
        position: "absolute",
        top: (startHour - START_HOUR) * HOUR_HEIGHT + 2,
        left: `calc(${leftPct}% + 3px)`,
        width: `calc(${widthPct}% - 6px)`,
        zIndex: isDragging ? 0 : 1,
      }}
      className="touch-none"
    >
      <EventBlock
        video={video}
        colIndex={colIndex}
        colTotal={colTotal}
        isDragging={isDragging}
        onPopover={onPopover}
      />
    </div>
  );
}

// Overlay shown while dragging
function DragOverlayEvent({ video }: { video: Video }) {
  const hex = PILLAR_HEX[video.pillar];
  const { durationHours } = windowSlot(video.postingWindow);
  return (
    <div
      style={{
        width: 140,
        height: durationHours * HOUR_HEIGHT - 4,
        backgroundColor: hex,
        boxShadow: `0 8px 32px -8px ${hex}99, 0 0 0 1px rgba(255,255,255,0.2)`,
        opacity: 0.9,
      }}
      className="overflow-hidden rounded-lg px-2 py-1.5"
    >
      <p className="truncate text-[11px] font-semibold text-white">
        {video.hook.line1 || video.title}
      </p>
    </div>
  );
}

// ── Posting window zone (droppable) ──────────────────────────────────────────

function PostingWindowZone({
  dayKey, windowIndex, videosInWindow, onAdd, onPopover,
}: {
  dayKey: DayKey;
  windowIndex: number;
  videosInWindow: Video[];
  onAdd: (day: DayKey, window: PostingWindow) => void;
  onPopover: (video: Video, rect: DOMRect) => void;
}) {
  const id = zoneId(dayKey, windowIndex);
  const { setNodeRef, isOver } = useDroppable({ id });
  const pw = POSTING_WINDOWS[windowIndex];
  const { startHour, durationHours } = WINDOW_SLOTS[pw];

  return (
    <div
      ref={setNodeRef}
      style={{
        position: "absolute",
        top: (startHour - START_HOUR) * HOUR_HEIGHT,
        height: durationHours * HOUR_HEIGHT,
        left: 0,
        right: 0,
      }}
      className={cn(
        "rounded-lg transition-colors duration-100",
        isOver && "bg-white/[0.05] ring-1 ring-inset ring-white/[0.12]"
      )}
    >
      {/* Events: stacked side-by-side */}
      {videosInWindow.map((v, i) => (
        <DraggableEvent
          key={v.id}
          video={v}
          colIndex={i}
          colTotal={videosInWindow.length}
          onPopover={onPopover}
        />
      ))}

      {/* Add button when empty and not dragging-over */}
      {videosInWindow.length === 0 && !isOver && (
        <button
          onClick={() => onAdd(dayKey, pw)}
          className="group absolute inset-0.5 flex items-center justify-center rounded-lg border border-transparent opacity-0 hover:border-white/[0.08] hover:bg-white/[0.03] hover:opacity-100 transition-all"
          aria-label={`Add reel at ${pw}`}
        >
          <Plus className="h-3.5 w-3.5 text-zinc-600 group-hover:text-zinc-400" strokeWidth={1.75} />
        </button>
      )}
    </div>
  );
}

// ── Week day column ──────────────────────────────────────────────────────────

function WeekDayColumn({
  dayKey, isToday, videoIds, videoById, onAdd, onPopover,
}: {
  dayKey: DayKey;
  isToday: boolean;
  videoIds: string[];
  videoById: Map<string, Video>;
  onAdd: (day: DayKey, window: PostingWindow) => void;
  onPopover: (video: Video, rect: DOMRect) => void;
}) {
  // Group videos by posting window
  const byWindow = useMemo<Partial<Record<PostingWindow, Video[]>>>(() => {
    const map: Partial<Record<PostingWindow, Video[]>> = {};
    for (const id of videoIds) {
      const v = videoById.get(id);
      if (!v || !v.postingWindow) continue;
      const pw = v.postingWindow as PostingWindow;
      if (!map[pw]) map[pw] = [];
      map[pw]!.push(v);
    }
    return map;
  }, [videoIds, videoById]);

  return (
    <div
      className={cn(
        "relative flex-1 border-l border-white/[0.05]",
        isToday && "bg-blue-500/[0.025]"
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

      {/* Posting window zones */}
      {POSTING_WINDOWS.map((pw, wi) => (
        <PostingWindowZone
          key={pw}
          dayKey={dayKey}
          windowIndex={wi}
          videosInWindow={byWindow[pw] ?? []}
          onAdd={onAdd}
          onPopover={onPopover}
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
      {/* DOW headers */}
      <div className="flex flex-shrink-0 border-b border-white/[0.07]">
        {DAY_ABBRS.map(d => (
          <div key={d} className="flex-1 py-2 text-center text-[10px] font-semibold uppercase tracking-widest text-zinc-600">
            {d}
          </div>
        ))}
      </div>

      {/* Weeks grid */}
      <div className="flex flex-1 flex-col divide-y divide-white/[0.05] overflow-hidden">
        {mondays.map(monday => {
          const wk = isoWeek(monday);
          const cal = weekCalendars[wk];
          const days = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(monday);
            d.setDate(d.getDate() + i);
            return d;
          });
          const dayKeysRow = DAY_KEYS;

          return (
            <div key={wk} className="flex flex-1 divide-x divide-white/[0.05]">
              {days.map((date, i) => {
                const dk = dayKeysRow[i];
                const isCurrentMonth = date.getMonth() === month;
                const isToday = date.toDateString() === today.toDateString();
                const videoIds: string[] = cal?.days[dk] ?? [];
                const videos = videoIds
                  .map(id => videoById.get(id))
                  .filter((v): v is Video => !!v && !hiddenPillars.has(v.pillar));

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
                    {videos.slice(0, 3).map(v => (
                      <div
                        key={v.id}
                        style={{ backgroundColor: PILLAR_HEX[v.pillar] }}
                        className="truncate rounded px-1.5 py-0.5 text-[10px] font-medium text-white"
                        onClick={e => e.stopPropagation()}
                      >
                        <Link href={`/video/${v.id}`} className="block truncate">
                          {v.hook.line1 || v.title}
                        </Link>
                      </div>
                    ))}
                    {videos.length > 3 && (
                      <div className="px-1 text-[10px] text-zinc-600">+{videos.length - 3} more</div>
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

  // ── Persist helpers
  function persistCalendar(next: CalendarWeek) {
    setWeekCalendars(prev => ({ ...prev, [next.week]: next }));
    apiSaveCalendar(next).catch(() => {});
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
    const { active, over } = e;
    if (!over) return;

    const videoId  = String(active.id);
    const parsed   = parseZoneId(String(over.id));
    if (!parsed) return;
    const { day: targetDay, wi } = parsed;
    const targetWindow = POSTING_WINDOWS[wi];

    // Find source
    let sourceDay: DayKey | undefined;
    for (const d of DAY_KEYS) {
      if ((weekCalendars[weekKey]?.days[d] ?? []).includes(videoId)) {
        sourceDay = d;
        break;
      }
    }
    if (!sourceDay) return;

    const video = videoById.get(videoId);
    if (!video) return;

    const dayChanged    = sourceDay !== targetDay;
    const windowChanged = targetWindow !== video.postingWindow;
    if (!dayChanged && !windowChanged) return;

    const nextCal: CalendarWeek = { ...calendar, days: { ...calendar.days } };
    if (dayChanged) {
      nextCal.days[sourceDay] = nextCal.days[sourceDay].filter(id => id !== videoId);
      nextCal.days[targetDay] = [...(nextCal.days[targetDay] ?? []), videoId];
    }
    persistCalendar(nextCal);

    if (windowChanged) {
      const updated = { ...video, postingWindow: targetWindow };
      setVideos(prev => prev.map(v => v.id === videoId ? updated : v));
      apiSaveVideo(updated).catch(() => {});
    }
  }

  async function addToDay(dayKey: DayKey, window: PostingWindow) {
    if (dragJustFinished.current) return;
    const v = await apiCreateVideo({ title: "Untitled Reel", postingWindow: window });
    setVideos(prev => [...prev, v]);
    const nextCal: CalendarWeek = {
      ...calendar,
      days: { ...calendar.days, [dayKey]: [...(calendar.days[dayKey] ?? []), v.id] },
    };
    persistCalendar(nextCal);
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

  // ── Visible video IDs (respect pillar filter)
  function visibleIds(ids: string[]): string[] {
    return ids.filter(id => {
      const v = videoById.get(id);
      return v && !hiddenPillars.has(v.pillar);
    });
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden">

      {/* ── Top navigation bar ── */}
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-white/[0.09] bg-[rgba(5,15,30,0.55)] px-5 py-3 backdrop-blur-[40px] shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]">
        <h1 className="text-[17px] font-bold tracking-[-0.025em] text-white">Calendar</h1>

        {/* Week/Month toggle */}
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

        {/* Navigation */}
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
                "rounded-full border px-2.5 py-0.5 text-[11px] font-medium transition-all",
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
            {DAY_KEYS.map(k => {
              const isToday = todayKey === k;
              return (
                <div key={k} className="flex flex-1 flex-col items-center border-l border-white/[0.05] py-2">
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
            onDragStart={(e: DragStartEvent) => setActiveId(String(e.active.id))}
            onDragEnd={onDragEnd}
          >
            <div ref={scrollRef} className="flex flex-1 overflow-y-auto">
              {/* Hour labels */}
              <div className="relative w-14 flex-shrink-0 border-r border-white/[0.05]">
                {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
                  const h = START_HOUR + i;
                  return (
                    <div key={h} style={{ height: HOUR_HEIGHT }} className="relative">
                      {i > 0 && (
                        <span className="absolute -top-2.5 right-2 select-none text-[10px] text-zinc-600">
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
                    videoIds={visibleIds(calendar.days[k] ?? [])}
                    videoById={videoById}
                    onAdd={addToDay}
                    onPopover={(v, rect) => setPopover({ video: v, rect })}
                  />
                ))}

                {/* Current time indicator */}
                {currentTimeTop !== null && (
                  <div
                    className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
                    style={{ top: currentTimeTop }}
                  >
                    <div className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-red-500" style={{ marginLeft: -5 }} />
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
    </div>
  );
}
