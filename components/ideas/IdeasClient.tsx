"use client";

import { useRef, useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Plus,
  Star,
  Loader2,
  Trash2,
  FileUp,
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import {
  ContentItem,
  ContentType,
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_COLORS,
  PILLARS,
  Pillar,
  calcReadiness,
  readinessLabel,
  demandFreshness,
} from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/controls";
import { PillarBadge } from "@/components/ui/Badge";
import { LiveIndicator, ConnectionBar } from "@/components/ui/LiveIndicator";
import { Toast, useToast } from "@/components/ui/Toast";
import { useLiveSync } from "@/lib/useLiveSync";
import {
  apiDeleteIdea,
  apiCreateIdea,
  apiImportIdeas,
  apiGetIdeas,
} from "@/lib/api";
import { BrainstormModal } from "./BrainstormModal";
import { cn } from "@/lib/utils";

// ---- Mini readiness bar -----------------------------------------------------

function MiniReadiness({ score }: { score: number }) {
  const isReady = score >= 80;
  const isDev = score >= 40;
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-300",
            isReady ? "bg-emerald-500" : isDev ? "bg-amber-500" : "bg-zinc-600"
          )}
          style={{ width: `${score}%` }}
        />
      </div>
      <span
        className={cn(
          "shrink-0 text-[10px] font-medium",
          isReady ? "text-emerald-400" : isDev ? "text-amber-400" : "text-zinc-600"
        )}
      >
        {readinessLabel(score)}
      </span>
    </div>
  );
}

// ---- Recognition stars (display only) --------------------------------------

function RecognitionStars({ score }: { score: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn(
            "h-3 w-3",
            n <= score ? "fill-amber-400 text-amber-400" : "text-zinc-700"
          )}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

// ---- Freshness dot ----------------------------------------------------------

function FreshnessDot({ dateStr }: { dateStr: string }) {
  const f = demandFreshness(dateStr);
  if (!f) return null;
  const colors = {
    green: "bg-emerald-500",
    yellow: "bg-amber-400",
    red: "bg-rose-500",
  };
  const labels = { green: "Fresh", yellow: "Getting stale", red: "Stale" };
  return (
    <span
      title={`Demand signal: ${labels[f]}`}
      className={cn("inline-block h-1.5 w-1.5 rounded-full", colors[f])}
    />
  );
}

// ---- Idea card --------------------------------------------------------------

function IdeaCard({
  idea,
  onDelete,
  deleting,
}: {
  idea: ContentItem;
  onDelete: (id: string) => void;
  deleting: boolean;
}) {
  const readiness = calcReadiness(idea);
  const hookPreview = idea.hook?.line1 || "";
  const ct = idea.contentType ?? "reel_long";
  const { bg, text } = CONTENT_TYPE_COLORS[ct];

  return (
    <div className="hover-lift group relative rounded-xl border border-white/[0.06] bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.4)] hover:border-white/[0.12]">
      <Link
        href={`/ideas/${idea.id}`}
        className="block p-5 outline-none focus-visible:rounded-xl focus-visible:ring-2 focus-visible:ring-accent/40"
      >
        {/* Top row */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <PillarBadge pillar={idea.pillar} />
            <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", bg, text)}>
              {CONTENT_TYPE_LABELS[ct]}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {idea.demandSignal?.date && (
              <FreshnessDot dateStr={idea.demandSignal.date} />
            )}
            <RecognitionStars score={idea.recognitionScore ?? 3} />
          </div>
        </div>

        {/* Title */}
        <h3 className="mt-3 text-sm font-semibold leading-snug text-zinc-100 line-clamp-2">
          {idea.title || <span className="text-zinc-600">Untitled idea</span>}
        </h3>

        {/* Hook preview */}
        {hookPreview && (
          <p className="mt-1.5 text-xs leading-relaxed text-zinc-500 line-clamp-2">
            "{hookPreview}"
          </p>
        )}

        {/* Readiness meter */}
        <div className="mt-3">
          <MiniReadiness score={readiness} />
        </div>

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between border-t border-white/[0.04] pt-3">
          <span className="text-[11px] text-zinc-600">
            {new Date(idea.createdAt).toLocaleDateString()}
          </span>
          <span className="flex items-center gap-1 text-[11px] text-zinc-600 opacity-0 transition-opacity group-hover:opacity-100">
            Edit <ArrowUpRight className="icon-pop h-3 w-3" strokeWidth={1.75} />
          </span>
        </div>
      </Link>

      {/* Delete button (outside the Link) */}
      <button
        onClick={(e) => {
          e.preventDefault();
          onDelete(idea.id);
        }}
        disabled={deleting}
        className="absolute right-2 top-2 rounded-md p-1.5 text-zinc-700 opacity-0 outline-none transition-[opacity,color] group-hover:opacity-100 hover:bg-rose-500/10 hover:text-rose-400 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-rose-500/40"
        aria-label="Delete idea"
      >
        {deleting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
        ) : (
          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}

// ---- Sort/filter types ------------------------------------------------------

type SortKey = "readiness" | "recognition" | "date" | "pillar";
type ReadinessFilter = "all" | "raw" | "developing" | "ready";

// ---- Main component ---------------------------------------------------------

export function IdeasClient({ initialIdeas }: { initialIdeas: ContentItem[] }) {
  const router = useRouter();
  const [ideas, setIdeas] = useState<ContentItem[]>(initialIdeas);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("readiness");
  const [pillarFilter, setPillarFilter] = useState<Pillar | "all">("all");
  const [readinessFilter, setReadinessFilter] = useState<ReadinessFilter>("all");
  const [contentTypeFilter, setContentTypeFilter] = useState<ContentType | "all">("all");
  const [showBrainstorm, setShowBrainstorm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { message: toast, show: showToast } = useToast();

  const handleCloseBrainstorm = useCallback(() => setShowBrainstorm(false), []);

  // Live sync
  const { status, mute } = useLiveSync<ContentItem[]>(apiGetIdeas, (server) => {
    if (deletingId) return;
    setIdeas(server);
  });

  function showFlash(msg: string) {
    setFlash(msg);
    setTimeout(() => setFlash(null), 4000);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);
    mute(8000);
    try {
      const result = await apiImportIdeas(file);
      setIdeas((prev) => [...result.ideas, ...prev]);
      showFlash(`Imported ${result.imported} idea${result.imported === 1 ? "" : "s"} from ${file.name}`);
      router.refresh();
    } catch (err) {
      showFlash(`Import failed: ${err instanceof Error ? err.message : "unknown error"}`);
    } finally {
      setImporting(false);
    }
  }

  async function handleNewIdea() {
    setCreating(true);
    try {
      const idea = await apiCreateIdea();
      router.push(`/ideas/${idea.id}`);
    } catch {
      setCreating(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    mute();
    try {
      await apiDeleteIdea(id);
      setIdeas((prev) => prev.filter((i) => i.id !== id));
    } catch {
      showToast("Couldn't delete — check connection");
    } finally {
      setDeletingId(null);
    }
  }

  // Sort + filter
  const displayed = useMemo(() => {
    let list = ideas.slice();

    if (contentTypeFilter !== "all") {
      list = list.filter((i) => (i.contentType ?? "reel_long") === contentTypeFilter);
    }

    if (pillarFilter !== "all") {
      list = list.filter((i) => i.pillar === pillarFilter);
    }

    if (readinessFilter !== "all") {
      list = list.filter((i) => {
        const r = calcReadiness(i);
        if (readinessFilter === "raw") return r < 40;
        if (readinessFilter === "developing") return r >= 40 && r < 80;
        if (readinessFilter === "ready") return r >= 80;
        return true;
      });
    }

    list.sort((a, b) => {
      if (sortKey === "readiness") return calcReadiness(b) - calcReadiness(a);
      if (sortKey === "recognition")
        return (b.recognitionScore ?? 0) - (a.recognitionScore ?? 0);
      if (sortKey === "date") return b.createdAt.localeCompare(a.createdAt);
      if (sortKey === "pillar") return a.pillar.localeCompare(b.pillar);
      return 0;
    });

    return list;
  }, [ideas, sortKey, pillarFilter, readinessFilter, contentTypeFilter]);

  const readyCount = ideas.filter((i) => calcReadiness(i) >= 80).length;

  return (
    <>
      <ConnectionBar status={status} />
      <PageHeader
        title="Idea Bank"
        subtitle={`${ideas.length} ideas · ${readyCount} ready to shoot`}
      >
        <LiveIndicator status={status} />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.txt,text/plain,application/pdf"
          className="hidden"
          onChange={handleImport}
        />
        <Button
          variant="ghost"
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
        >
          {importing ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
          ) : (
            <FileUp className="h-4 w-4" strokeWidth={1.75} />
          )}
          {importing ? "Importing…" : "Import PDF"}
        </Button>
        <Button variant="ghost" onClick={() => setShowBrainstorm(true)}>
          <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          Brainstorm
        </Button>
        <Button variant="primary" onClick={handleNewIdea} disabled={creating}>
          {creating ? (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
          ) : (
            <Plus className="h-4 w-4" strokeWidth={1.75} />
          )}
          New Idea
        </Button>
      </PageHeader>

      {flash && (
        <div
          className={cn(
            "mx-7 mt-5 rounded-lg border px-4 py-2.5 text-sm",
            flash.startsWith("Import failed")
              ? "border-rose-500/20 bg-rose-500/10 text-rose-300"
              : "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
          )}
        >
          {flash}
        </div>
      )}

      {/* Content type filter pills */}
      <div className="flex flex-wrap gap-1.5 px-7 pt-5">
        <button
          onClick={() => setContentTypeFilter("all")}
          className={cn(
            "rounded-full px-3 py-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40",
            contentTypeFilter === "all"
              ? "bg-white/[0.10] text-zinc-200 ring-1 ring-inset ring-white/[0.15]"
              : "bg-white/[0.04] text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-300"
          )}
        >
          All
        </button>
        {CONTENT_TYPES.map((ct) => {
          const { bg, text } = CONTENT_TYPE_COLORS[ct];
          const active = contentTypeFilter === ct;
          return (
            <button
              key={ct}
              onClick={() => setContentTypeFilter(ct)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40",
                active
                  ? `${bg} ${text} ring-1 ring-inset ring-current/30`
                  : "bg-white/[0.04] text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-300"
              )}
            >
              {CONTENT_TYPE_LABELS[ct]}
            </button>
          );
        })}
      </div>

      {/* Sort + filter toolbar */}
      <div className="flex flex-wrap items-center gap-2 px-7 pb-2 pt-3">
        {/* Sort dropdown */}
        <div className="relative">
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="h-8 appearance-none rounded-full border border-white/[0.08] bg-white/[0.04] pl-3 pr-7 text-xs font-medium text-zinc-300 outline-none transition-colors hover:border-white/[0.15] focus-visible:ring-2 focus-visible:ring-accent/40 cursor-pointer"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 0.4rem center",
              backgroundSize: "0.7rem",
            }}
          >
            <option value="readiness">Sort: Readiness</option>
            <option value="recognition">Sort: Recognition</option>
            <option value="date">Sort: Date added</option>
            <option value="pillar">Sort: Pillar</option>
          </select>
        </div>

        {/* Pillar filter chips */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setPillarFilter("all")}
            className={cn(
              "rounded-full px-3 py-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40",
              pillarFilter === "all"
                ? "bg-accent/20 text-accent ring-1 ring-inset ring-accent/40"
                : "bg-white/[0.04] text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-300"
            )}
          >
            All pillars
          </button>
          {PILLARS.map((p) => (
            <button
              key={p}
              onClick={() => setPillarFilter(pillarFilter === p ? "all" : p)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40",
                pillarFilter === p
                  ? "bg-accent/20 text-accent ring-1 ring-inset ring-accent/40"
                  : "bg-white/[0.04] text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-300"
              )}
            >
              {p}
            </button>
          ))}
        </div>

        {/* Readiness filter chips */}
        <div className="flex gap-1.5">
          {(
            [
              ["all", "All stages"],
              ["raw", "Raw"],
              ["developing", "Developing"],
              ["ready", "Ready"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setReadinessFilter(key)}
              className={cn(
                "rounded-full px-3 py-1 text-[11px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40",
                readinessFilter === key
                  ? "bg-accent/20 text-accent ring-1 ring-inset ring-accent/40"
                  : "bg-white/[0.04] text-zinc-500 hover:bg-white/[0.08] hover:text-zinc-300"
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 gap-4 px-7 py-5 md:grid-cols-2 xl:grid-cols-3">
        {displayed.map((idea, i) => (
          <div
            key={idea.id}
            className="animate-fade-in-up"
            style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
          >
            <IdeaCard
              idea={idea}
              onDelete={handleDelete}
              deleting={deletingId === idea.id}
            />
          </div>
        ))}

        {displayed.length === 0 && ideas.length > 0 && (
          <div className="col-span-full rounded-xl border border-white/[0.06] bg-surface py-16 text-center text-sm text-zinc-500">
            No ideas match the current filters
          </div>
        )}

        {ideas.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-white/[0.08] py-20 text-center">
            <p className="text-zinc-400">No ideas yet</p>
            <Button
              variant="primary"
              className="mt-4"
              onClick={handleNewIdea}
              disabled={creating}
            >
              <Plus className="h-4 w-4" strokeWidth={1.75} /> Add your first idea
            </Button>
          </div>
        )}
      </div>

      <Toast message={toast} />

      {showBrainstorm && <BrainstormModal onClose={handleCloseBrainstorm} />}
    </>
  );
}
