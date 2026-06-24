// Per-metric verdict engine for a linked Instagram reel.
// Pure + client-safe (no server imports) — used by the RESULTS tab to grade a
// reel against the creator's real performance benchmarks. Values are read from
// the live Instagram cache first, falling back to manually-entered results{}
// fields for metrics the Graph API doesn't expose (FB views, skip rate, top
// source, follows).

import type { IgPost } from "@/lib/api";
import type { Results } from "@/lib/types";

export type MetricVerdict = "WIN" | "OK" | "FLOP";
export type OverallVerdict = "WIN" | "MEH" | "FLOP";

export interface MetricRow {
  key: string;
  label: string;
  display: string;
  verdict: MetricVerdict | null; // null = informational or no data
  explanation: string;
  informational?: boolean;
  noData?: boolean;
}

export const VERDICT_HEX: Record<MetricVerdict, string> = {
  WIN: "#22c55e",
  OK: "#eab308",
  FLOP: "#ef4444",
};

function fmtNum(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const NO_DATA = "No data yet — try refreshing";

export function computeMetrics(post: IgPost | null, r: Results): MetricRow[] {
  const rows: MetricRow[] = [];

  // VIEWS (IG + FB combined) — WIN ≥ 1,000 · OK 500–999 · FLOP < 500
  const igViews = post?.plays ?? r.viewsIG;
  const fbViews = r.viewsFB;
  const hasViews = igViews != null || fbViews != null;
  const views = (igViews ?? 0) + (fbViews ?? 0);
  rows.push({
    key: "views",
    label: "Views (IG + FB)",
    display: hasViews ? fmtNum(views) : "—",
    ...(!hasViews
      ? { verdict: null, noData: true, explanation: NO_DATA }
      : views >= 1000
        ? { verdict: "WIN", explanation: "Broke the 1k threshold — algorithm picked it up" }
        : views >= 500
          ? { verdict: "OK", explanation: "Decent reach — hook may need sharpening" }
          : { verdict: "FLOP", explanation: "Under 500 — likely didn't leave the existing audience" }),
  });

  // AVG WATCH TIME (seconds, from Graph API) — WIN ≥ 8s · OK 4–7.9s · FLOP < 4s
  // Replaces manual skip rate: pulled straight from the reel, no manual entry.
  const watch = post?.avgWatchTime;
  rows.push({
    key: "avgWatchTime",
    label: "Avg watch time",
    display: watch != null && watch > 0 ? `${watch.toFixed(1)}s` : "—",
    ...(watch == null || watch <= 0
      ? { verdict: null, noData: true, explanation: NO_DATA }
      : watch >= 8
        ? { verdict: "WIN", explanation: "Strong retention — hook held attention past 8s" }
        : watch >= 4
          ? { verdict: "OK", explanation: "Mid retention — re-hook at 3s may be missing" }
          : { verdict: "FLOP", explanation: "Vertical drop at 0:00 — hook failure, consider a remake" }),
  });

  // TOP SOURCE — WIN: Tab Reels ≥ 50% · OK: Tab Reels 25–49% · FLOP: Stories > 50%
  const src = (r.topSource || "").trim();
  const low = src.toLowerCase();
  rows.push({
    key: "topSource",
    label: "Top source",
    display: src || "—",
    ...(!src
      ? { verdict: null, noData: true, explanation: NO_DATA }
      : low.includes("reel") || low.includes("explore")
        ? { verdict: "WIN", explanation: "Organic distribution — algorithm pushed it beyond your audience" }
        : low.includes("stor")
          ? { verdict: "FLOP", explanation: "Stories-dominant — only existing followers saw this" }
          : { verdict: "OK", explanation: "Partial organic pickup" }),
  });

  // SAVES — WIN ≥ 10 · OK 4–9 · FLOP 0–3
  const saves = post?.saved ?? r.saves;
  rows.push({
    key: "saves",
    label: "Saves",
    display: fmtNum(saves),
    ...(saves == null
      ? { verdict: null, noData: true, explanation: NO_DATA }
      : saves >= 10
        ? { verdict: "WIN", explanation: "High save rate — content perceived as valuable" }
        : saves >= 4
          ? { verdict: "OK", explanation: "Some saves — add a stronger save-CTA next time" }
          : { verdict: "FLOP", explanation: "No saves — add 'Save this for later' in the caption" }),
  });

  // COMMENTS — WIN ≥ 5 · OK 1–4 · FLOP 0
  const comments = post?.commentsCount ?? r.comments;
  rows.push({
    key: "comments",
    label: "Comments",
    display: fmtNum(comments),
    ...(comments == null
      ? { verdict: null, noData: true, explanation: NO_DATA }
      : comments >= 5
        ? { verdict: "WIN", explanation: "Engagement signal — algorithm will extend reach" }
        : comments >= 1
          ? { verdict: "OK", explanation: "Some engagement — strengthen the comment trigger" }
          : { verdict: "FLOP", explanation: "No comments — this account's chronic weakness. Use keyword bait" }),
  });

  // FOLLOWS — WIN ≥ 5 · OK 2–4 · FLOP 0–1
  const follows = r.follows;
  rows.push({
    key: "follows",
    label: "Follows",
    display: fmtNum(follows),
    ...(follows == null
      ? { verdict: null, noData: true, explanation: NO_DATA }
      : follows >= 5
        ? { verdict: "WIN", explanation: "Strong profile conversion" }
        : follows >= 2
          ? { verdict: "OK", explanation: "Some conversion" }
          : { verdict: "FLOP", explanation: "Profile conversion failure — audit bio + pinned reels" }),
  });

  // LIKES — informational only, no verdict
  const likes = post?.likeCount ?? r.likes;
  rows.push({
    key: "likes",
    label: "Likes",
    display: fmtNum(likes),
    verdict: null,
    informational: true,
    explanation: "Informational — likes don't drive distribution",
  });

  return rows;
}

// Overall verdict: count WIN / FLOP across graded metrics (excludes
// informational + no-data rows). WIN if ≥ 4 wins, FLOP if ≥ 3 flops, else MEH.
export function overallVerdict(rows: MetricRow[]): OverallVerdict {
  let wins = 0;
  let flops = 0;
  for (const row of rows) {
    if (row.informational || row.verdict == null) continue;
    if (row.verdict === "WIN") wins++;
    else if (row.verdict === "FLOP") flops++;
  }
  if (wins >= 4) return "WIN";
  if (flops >= 3) return "FLOP";
  return "MEH";
}
