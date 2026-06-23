import type { ContentItem } from "@/lib/types";
import { DAY_KEYS, type DayKey } from "@/lib/types";

export function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(Math.round(n));
}

export function minsAgo(ts: string): string {
  const ms = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function greeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 22) return "Good evening";
  return "Good night";
}

export function todayLabel(): string {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function todayDayKey(): DayKey {
  const map: DayKey[] = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  return map[new Date().getDay()];
}

export function isInROPostingWindow(): boolean {
  try {
    const parts = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Bucharest",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());
    const h = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
    const m = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
    const t = h * 60 + m;
    return (t >= 19 * 60 && t < 22 * 60) || t >= 23 * 60;
  } catch {
    return false;
  }
}

export function mondayFromWeek(weekStr: string): Date {
  const [y, w] = weekStr.split("-").map(Number);
  const jan4 = new Date(Date.UTC(y, 0, 4));
  const dow = (jan4.getUTCDay() + 6) % 7;
  const mon = new Date(jan4);
  mon.setUTCDate(jan4.getUTCDate() - dow + (w - 1) * 7);
  return mon;
}

export function dayDate(dayKey: DayKey, monday: Date): Date {
  const idx = DAY_KEYS.indexOf(dayKey);
  const d = new Date(monday);
  d.setUTCDate(monday.getUTCDate() + idx);
  return d;
}

export function totalViews(item: ContentItem): number {
  return (item.results?.viewsIG ?? 0) + (item.results?.viewsFB ?? 0);
}

export function hookScore(item: ContentItem): number {
  if (!item.hook?.scorecard) return 0;
  return Object.values(item.hook.scorecard).filter(Boolean).length;
}

export function postViews(p: { plays: number; impressions: number; reach: number }): number {
  return p.plays || p.impressions || p.reach;
}

export function buildPostedDateSet(videos: ContentItem[]): Set<string> {
  const s = new Set<string>();
  for (const v of videos) {
    for (const ev of v.statusHistory ?? []) {
      if (ev.status === "POSTED" || ev.status === "ANALYZED") {
        s.add(ev.timestamp.slice(0, 10));
      }
    }
    if (v.status === "POSTED" || v.status === "ANALYZED") {
      s.add(v.updatedAt.slice(0, 10));
    }
  }
  return s;
}

export function calcStreak(dates: Set<string>): number {
  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    if (dates.has(d.toISOString().slice(0, 10))) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

export function last30Days(): string[] {
  return Array.from({ length: 30 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (29 - i));
    return d.toISOString().slice(0, 10);
  });
}

export const SOURCE_COLORS: Record<string, string> = {
  "Tab Reels": "#3b82f6",
  Stories: "#06b6d4",
  Feed: "#a78bfa",
  Explore: "#34d399",
  Profile: "#fbbf24",
  Search: "#fb923c",
};

export function sourceColor(s: string): string {
  return SOURCE_COLORS[s] ?? "#71717a";
}
