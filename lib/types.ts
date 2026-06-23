// Domain types for the Content Calendar CRM

export const STATUSES = [
  "TO_SHOOT",
  "SHOT",
  "EDITED",
  "POSTED",
  "ANALYZED",
] as const;
export type Status = (typeof STATUSES)[number];

export const PILLARS = [
  "Claude Code",
  "Agents",
  "Comparisons",
  "Tutorials",
  "New Features",
] as const;
export type Pillar = (typeof PILLARS)[number];

export const FORMATS = [
  "Talking head",
  "Screen recording",
  "B-roll voiceover",
  "Tutorial",
  "Skit",
] as const;
export type Format = (typeof FORMATS)[number];

export const POSTING_WINDOWS = [
  "Morning (7-9am)",
  "Midday (11am-1pm)",
  "Evening (6-8pm)",
  "Night (9-11pm)",
] as const;
export type PostingWindow = (typeof POSTING_WINDOWS)[number];

export const HOOK_TYPES = ["H1", "H2", "H3", "H4", "H5", "H6"] as const;
export type HookType = (typeof HOOK_TYPES)[number];
export const HOOK_TYPE_LABELS: Record<HookType, string> = {
  H1: "I Tested X",
  H2: "Nobody's Talking About",
  H3: "Replaced X with Y",
  H4: "Contradiction",
  H5: "Speed Run",
  H6: "Mistake I Made",
};

export type Stage = "idea" | "production";

export const BEAT_LABELS = [
  "HOOK",
  "RE-HOOK",
  "DEMO",
  "RESULT",
  "CTA",
] as const;
export type BeatLabel = (typeof BEAT_LABELS)[number];

export const TRIGGER_TYPES = [
  "Comment keyword",
  "DM keyword",
  "Question prompt",
  "Poll / this-or-that",
  "Save reminder",
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

export interface Scorecard {
  recognition: boolean;
  openLoop: boolean;
  firstTwoS: boolean;
  specificity: boolean;
  identity: boolean;
}

export interface Hook {
  line1: string;
  line2: string;
  firstTwoSeconds: string;
  scorecard: Scorecard;
}

export interface Beat {
  id: string;
  timestamp: string;
  label: BeatLabel;
  content: string;
  retentionNote: string;
}

export interface Caption {
  variant: string;
  text: string;
  hashtags: string;
  recommended: boolean;
}

export interface Engagement {
  triggerType: TriggerType | "";
  triggerText: string;
  firstComment: string;
  endCard: string;
}

export interface ChecklistItem {
  id: string;
  label: string;
  group: string;
  checked: boolean;
}

export type Verdict = "WIN" | "MEH" | "FLOP" | "";

export interface Results {
  viewsIG: number | null;
  viewsFB: number | null;
  skipRate: number | null;
  topSource: string;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  follows: number | null;
  verdict: Verdict;
  lesson: string;
}

export interface StatusEvent {
  status: Status;
  timestamp: string;
}

export interface DemandSignal {
  text: string;
  source: string;
  date: string;
}

// Unified content item — ideas and production reels are the same object at
// different lifecycle stages. "idea" items live on /ideas; "production" items
// live on /board. Promoting an idea flips stage → "production" in place.
export interface ContentItem {
  id: string;
  stage: Stage;
  status: Status;
  // core
  title: string;
  pillar: Pillar;
  hookType: HookType | "";
  format: Format;
  lengthTarget: string;
  postingWindow: PostingWindow | "";
  sourceUrl: string; // kept for VideoEditor backward compat (= demandSignal.source for production)
  // demand
  demandSignal: DemandSignal;
  recognitionScore: number; // 1–5
  // hook
  hook: Hook;
  // production detail
  script: Beat[];
  captions: Caption[];
  engagement: Engagement;
  checklist: ChecklistItem[];
  results: Results;
  // meta
  seriesName: string;
  partNumber: number | null;
  statusHistory: StatusEvent[];
  createdAt: string;
  updatedAt: string;
}

// Backward-compat alias — VideoEditor and BoardClient continue to use Video
export type Video = ContentItem;

export type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const DAY_KEYS: DayKey[] = [
  "mon",
  "tue",
  "wed",
  "thu",
  "fri",
  "sat",
  "sun",
];
export const DAY_LABELS: Record<DayKey, string> = {
  mon: "Monday",
  tue: "Tuesday",
  wed: "Wednesday",
  thu: "Thursday",
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

export interface CalendarWeek {
  week: string; // YYYY-WW
  days: Record<DayKey, string[]>; // array of content item IDs per day
  notes?: string;
  theme?: string;
}

export interface PerformanceRow {
  videoId: string;
  date: string;
  hook: string;
  pillar: Pillar;
  format: Format;
  views: number;
  skipRate: number;
  topSource: string;
  verdict: Verdict;
  lesson: string;
}

// ---- Readiness calculation (shared between client and server) ---------------

export function calcReadiness(item: ContentItem): number {
  let score = 0;
  if (item.title && item.pillar && item.hookType) score += 20;
  if (item.demandSignal?.text && item.demandSignal?.date) {
    const days =
      (Date.now() - new Date(item.demandSignal.date).getTime()) /
      (1000 * 60 * 60 * 24);
    if (days <= 30) score += 20;
  }
  if (item.hook?.line1 && item.hook?.line2 && item.hook?.firstTwoSeconds)
    score += 20;
  const scorecardCount = item.hook?.scorecard
    ? Object.values(item.hook.scorecard).filter(Boolean).length
    : 0;
  if (scorecardCount >= 4) score += 20;
  if ((item.recognitionScore ?? 0) >= 3) score += 20;
  return score;
}

export function readinessLabel(score: number): "Raw" | "Developing" | "Ready to shoot" {
  if (score >= 80) return "Ready to shoot";
  if (score >= 40) return "Developing";
  return "Raw";
}

export function demandFreshness(dateStr: string): "green" | "yellow" | "red" | null {
  if (!dateStr) return null;
  const days =
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24);
  if (days <= 30) return "green";
  if (days <= 90) return "yellow";
  return "red";
}

// ---- Color maps -------------------------------------------------------------

export const PILLAR_COLORS: Record<Pillar, { bg: string; text: string; dot: string; ring: string }> = {
  "Claude Code": { bg: "bg-[#3b82f6]/15", text: "text-[#60a5fa]", dot: "bg-[#3b82f6]", ring: "ring-[#3b82f6]/30" },
  Agents: { bg: "bg-cyan-500/15", text: "text-cyan-300", dot: "bg-cyan-400", ring: "ring-cyan-500/30" },
  Comparisons: { bg: "bg-orange-500/15", text: "text-orange-300", dot: "bg-orange-400", ring: "ring-orange-500/30" },
  Tutorials: { bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-400", ring: "ring-emerald-500/30" },
  "New Features": { bg: "bg-amber-500/15", text: "text-amber-300", dot: "bg-amber-400", ring: "ring-amber-500/30" },
};

export const PILLAR_HEX: Record<Pillar, string> = {
  "Claude Code": "#3b82f6",
  Agents: "#06b6d4",
  Comparisons: "#fb923c",
  Tutorials: "#34d399",
  "New Features": "#fbbf24",
};

export const STATUS_COLORS: Record<Status, { bg: string; text: string; dot: string }> = {
  TO_SHOOT: { bg: "bg-zinc-500/15", text: "text-zinc-300", dot: "bg-zinc-400" },
  SHOT: { bg: "bg-[#3b82f6]/15", text: "text-[#60a5fa]", dot: "bg-[#3b82f6]" },
  EDITED: { bg: "bg-cyan-500/15", text: "text-cyan-300", dot: "bg-cyan-400" },
  POSTED: { bg: "bg-orange-500/15", text: "text-orange-300", dot: "bg-orange-400" },
  ANALYZED: { bg: "bg-emerald-500/15", text: "text-emerald-300", dot: "bg-emerald-400" },
};

export const STATUS_LABELS: Record<Status, string> = {
  TO_SHOOT: "To Shoot",
  SHOT: "Shot",
  EDITED: "Edited",
  POSTED: "Posted",
  ANALYZED: "Analyzed",
};
