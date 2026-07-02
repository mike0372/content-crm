import { DayKey, DAY_KEYS } from "./types";

// ISO week string "YYYY-WW" for a given date
export function isoWeek(date = new Date()): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week =
    1 + Math.round((d.getTime() - firstThursday.getTime()) / (7 * 86400000));
  return `${d.getUTCFullYear()}-${String(week).padStart(2, "0")}`;
}

// Monday of the current week
export function mondayOf(date = new Date()): Date {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function weekDates(monday: Date): Record<DayKey, Date> {
  const out = {} as Record<DayKey, Date>;
  DAY_KEYS.forEach((k, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    out[k] = d;
  });
  return out;
}

export function fmtDate(d: Date): string {
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function weekRangeLabel(monday: Date): string {
  const sun = new Date(monday);
  sun.setDate(monday.getDate() + 6);
  return `${fmtDate(monday)} – ${fmtDate(sun)}, ${sun.getFullYear()}`;
}

// Monday of an ISO week string "YYYY-WW" (local time)
export function mondayOfIsoWeek(week: string): Date {
  const [y, w] = week.split("-").map(Number);
  // Jan 4 is always in ISO week 1; its Monday anchors the year.
  const jan4 = new Date(y, 0, 4);
  const monday = mondayOf(jan4);
  monday.setDate(monday.getDate() + (w - 1) * 7);
  return monday;
}

// DayKey (mon..sun) for a date
export function dayKeyOf(date: Date): DayKey {
  return DAY_KEYS[(date.getDay() + 6) % 7];
}

// Parse "YYYY-MM-DD" as a LOCAL date (new Date("YYYY-MM-DD") is UTC and can
// shift a day in negative-offset timezones).
export function parseYMD(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s.trim());
  if (!m) return null;
  const d = new Date(+m[1], +m[2] - 1, +m[3]);
  return isNaN(d.getTime()) ? null : d;
}

// Format a date as "YYYY-MM-DD" (local)
export function toYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Concrete "YYYY-MM-DD" for a (week, dayKey) calendar slot
export function dateOfSlot(week: string, day: DayKey): string {
  const monday = mondayOfIsoWeek(week);
  const d = new Date(monday);
  d.setDate(monday.getDate() + DAY_KEYS.indexOf(day));
  return toYMD(d);
}

export function addWeeks(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n * 7);
  return d;
}

// Returns the Monday of each week visible in a month-grid view for the given year/month.
export function monthViewMondays(year: number, month: number): Date[] {
  const firstDay = new Date(year, month, 1);
  const start = mondayOf(firstDay);
  const result: Date[] = [];
  const cur = new Date(start);
  while (result.length < 6) {
    result.push(new Date(cur));
    cur.setDate(cur.getDate() + 7);
    if (cur.getMonth() > month && cur.getFullYear() >= year && result.length >= 4) break;
  }
  return result;
}
