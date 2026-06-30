"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { RefreshCw, Film } from "lucide-react";
import type { InstagramCache } from "@/lib/instagram";
import type { TokenHealth } from "@/lib/instagramToken";
import type { AiUsageSummary } from "@/lib/ai";
import type { ContentItem, CalendarWeek } from "@/lib/types";
import { Button } from "@/components/ui/controls";
import { cn } from "@/lib/utils";
import { greeting, todayLabel, minsAgo, isInROPostingWindow } from "./helpers";
import { IGEmptyState, InstagramSection } from "./InstagramSection";
import { PipelineSection, IdeaBankSection } from "./PipelineSections";
import { ThisWeekSection, NextActionsSection } from "./WeekAndActions";
import { ConsistencySection } from "./ConsistencySection";
import { AiUsageSection } from "./AiUsageSection";
import { DataCard } from "./DataCard";

export interface DashboardProps {
  igCache: InstagramCache | null;
  videos: ContentItem[];
  ideas: ContentItem[];
  calWeek: CalendarWeek;
  tokenHealth: TokenHealth;
  aiUsage: AiUsageSummary;
}

function TokenChip({ health }: { health: TokenHealth }) {
  if (health.daysRemaining === null) return null;
  const tone =
    health.status === "expired"
      ? "text-rose-300 bg-rose-500/10 ring-rose-500/30"
      : health.status === "warn"
        ? "text-amber-300 bg-amber-500/10 ring-amber-500/30"
        : "text-emerald-300/90 bg-emerald-500/10 ring-emerald-500/25";
  const label = health.status === "expired" ? "IG token expired" : `IG token: ${health.daysRemaining}d`;
  const title =
    (health.expiresAt ? `Expires ${new Date(health.expiresAt).toLocaleDateString()}. ` : "") +
    (health.canAutoRefresh
      ? "Auto-refreshes before expiry."
      : "Set META_APP_ID + META_APP_SECRET to auto-refresh.");
  return (
    <span
      title={title}
      className={cn("rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset", tone)}
    >
      {label}
    </span>
  );
}

export function DashboardClient({
  igCache: initialIgCache,
  videos,
  ideas,
  calWeek,
  tokenHealth,
  aiUsage,
}: DashboardProps) {
  const [igCache, setIgCache] = useState(initialIgCache);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [inPostingWindow, setInPostingWindow] = useState(false);

  useEffect(() => {
    setInPostingWindow(isInROPostingWindow());
    const id = setInterval(() => setInPostingWindow(isInROPostingWindow()), 60_000);
    return () => clearInterval(id);
  }, []);

  const syncInstagram = useCallback(async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/instagram", { method: "POST" });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = (await res.json()) as InstagramCache;
      setIgCache(data);
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncing(false);
    }
  }, []);

  const analyzed = useMemo(
    () => videos.filter((v) => v.status === "ANALYZED"),
    [videos]
  );

  const firstName = useMemo(() => {
    if (!igCache?.name) return null;
    return igCache.name.split(/[\s|]/)[0] || null;
  }, [igCache]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-20 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.09] bg-[rgba(5,15,30,0.55)] px-7 py-5 backdrop-blur-[40px] backdrop-saturate-[180%] shadow-[inset_0_-1px_0_rgba(255,255,255,0.04)]">
        <div className="animate-fade-in-down">
          <h1 className="text-[22px] font-bold tracking-[-0.025em] text-white">
            {greeting()}{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">{todayLabel()}</p>
        </div>
        <div className="flex animate-fade-in-down items-center gap-3 [animation-delay:80ms]">
          <TokenChip health={tokenHealth} />
          {igCache?.lastSync && (
            <span className="text-xs text-zinc-500">
              Synced {minsAgo(igCache.lastSync)}
            </span>
          )}
          <Button variant="outline" size="sm" onClick={syncInstagram} disabled={syncing}>
            <RefreshCw className={cn("h-3.5 w-3.5", syncing && "animate-spin")} strokeWidth={2} />
            {syncing ? "Syncing…" : "Sync Instagram"}
          </Button>
        </div>
      </header>

      <div className="space-y-6 px-7 py-7">
        {syncError && (
          <div className="rounded-lg border border-rose-500/20 bg-rose-500/8 px-4 py-2.5 text-sm text-rose-300">
            {syncError}
          </div>
        )}

        <section className="animate-fade-in-up">
          <div className="mb-3 flex items-center gap-2">
            <Film className="h-4 w-4 text-[#3b82f6]" strokeWidth={1.75} />
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-[#3b82f6]">
              Instagram Performance
            </h2>
          </div>
          {igCache ? (
            <InstagramSection
              igCache={igCache}
              analyzed={analyzed}
              onSync={syncInstagram}
              syncing={syncing}
            />
          ) : (
            <IGEmptyState onSync={syncInstagram} syncing={syncing} />
          )}
        </section>

        <div className="grid animate-fade-in-up grid-cols-1 gap-4 [animation-delay:80ms] md:grid-cols-2">
          <section>
            <div className="mb-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                Pipeline Health
              </h2>
            </div>
            <PipelineSection videos={videos} />
          </section>

          <section>
            <div className="mb-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                Idea Bank
              </h2>
            </div>
            <IdeaBankSection ideas={ideas} />
          </section>
        </div>

        <div className="grid animate-fade-in-up grid-cols-1 gap-4 [animation-delay:160ms] lg:grid-cols-3">
          <section className="lg:col-span-1">
            <div className="mb-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                This Week
              </h2>
            </div>
            <ThisWeekSection
              calWeek={calWeek}
              videos={videos}
              inPostingWindow={inPostingWindow}
            />
          </section>

          <section className="lg:col-span-2">
            <div className="mb-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                Next Actions
              </h2>
            </div>
            <NextActionsSection
              videos={videos}
              ideas={ideas}
              calWeek={calWeek}
              inPostingWindow={inPostingWindow}
            />
          </section>
        </div>

        <section className="animate-fade-in-up [animation-delay:240ms]">
          <div className="mb-3">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
              Consistency
            </h2>
          </div>
          <ConsistencySection videos={videos} />
        </section>

        <div className="grid animate-fade-in-up grid-cols-1 gap-4 [animation-delay:320ms] lg:grid-cols-2">
          <section>
            <div className="mb-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                AI Usage
              </h2>
            </div>
            <AiUsageSection usage={aiUsage} />
          </section>

          <section>
            <div className="mb-3">
              <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
                Backup
              </h2>
            </div>
            <DataCard />
          </section>
        </div>
      </div>
    </div>
  );
}
