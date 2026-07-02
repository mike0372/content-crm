"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  X,
  Sparkles,
  RefreshCw,
  ArrowRight,
  Loader2,
  Plus,
  Wand2,
  CheckCircle2,
  ExternalLink,
} from "lucide-react";
import {
  ContentType,
  CONTENT_TYPES,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPE_COLORS,
  Pillar,
  PILLARS,
} from "@/lib/types";
import {
  apiBrainstormIdeas,
  apiRegenerateOne,
  apiCreateIdea,
  BrainstormedIdea,
} from "@/lib/api";
import { cn } from "@/lib/utils";

const PILLAR_TEXT: Record<Pillar, string> = {
  "Claude Code": "text-[#60a5fa]",
  Agents: "text-cyan-300",
  Comparisons: "text-orange-300",
  Tutorials: "text-emerald-300",
  "New Features": "text-amber-300",
};

function ContentTypePill({
  value,
  selected,
  onClick,
}: {
  value: ContentType;
  selected: boolean;
  onClick: () => void;
}) {
  const { text } = CONTENT_TYPE_COLORS[value];
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 text-[11px] font-medium outline-none transition-[background,color,box-shadow] focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40",
        selected
          ? `${CONTENT_TYPE_COLORS[value].bg} ${text} ring-1 ring-inset ring-current/30`
          : "bg-white/[0.04] text-[#6b7280] hover:bg-white/[0.08] hover:text-[#9ca3af]"
      )}
    >
      {CONTENT_TYPE_LABELS[value]}
    </button>
  );
}

function IdeaResultCard({
  idea,
  index,
  regenerating,
  saving,
  saved,
  savedId,
  onRegenerate,
  onSave,
  onOpen,
}: {
  idea: BrainstormedIdea;
  index: number;
  regenerating: boolean;
  saving: boolean;
  saved: boolean;
  savedId?: string;
  onRegenerate: () => void;
  onSave: () => void;
  onOpen: () => void;
}) {
  const ct = (idea.contentType as ContentType) ?? "reel_long";
  const { bg, text } = CONTENT_TYPE_COLORS[ct];
  const pillarText = PILLAR_TEXT[idea.pillar as Pillar] ?? "text-[#60a5fa]";

  return (
    <div
      className="animate-fade-in-up flex flex-col gap-3 rounded-xl border bg-[#1a1a1a] p-4 transition-[border-color,box-shadow]"
      style={{
        animationDelay: `${index * 60}ms`,
        borderColor: saved ? "rgba(34,197,94,.25)" : "rgba(255,255,255,.06)",
        boxShadow: saved
          ? "0 0 0 1px rgba(34,197,94,.10), 0 8px 32px rgba(0,0,0,.4)"
          : "0 0 0 1px rgba(59,130,246,.08), 0 8px 32px rgba(0,0,0,.4)",
      }}
    >
      {/* Type + pillar + saved badge */}
      <div className="flex items-center gap-2">
        <span className={cn("rounded-full px-2.5 py-0.5 text-[10px] font-semibold", bg, text)}>
          {CONTENT_TYPE_LABELS[ct]}
        </span>
        <span className={cn("text-[10px] font-medium", pillarText)}>
          {idea.pillar}
        </span>
        {saved && (
          <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-[#22c55e]">
            <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
            Saved
          </span>
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold leading-snug text-white">
        {idea.title}
      </h3>

      {/* Hook preview */}
      {idea.hookLine1 && (
        <p className="text-[11px] italic leading-relaxed text-[#3b82f6]/80">
          &ldquo;{idea.hookLine1}&rdquo;
        </p>
      )}

      {/* Notes */}
      <p className="text-[12px] leading-relaxed text-[#9ca3af]">{idea.notes}</p>

      {/* Actions */}
      <div className="mt-auto flex items-center justify-between border-t border-white/[0.04] pt-3">
        <button
          onClick={onRegenerate}
          disabled={regenerating || saving}
          className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-medium text-[#6b7280] outline-none transition-[background,color] hover:bg-white/[0.06] hover:text-[#9ca3af] focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 disabled:opacity-40"
        >
          {regenerating ? (
            <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.75} />
          ) : (
            <RefreshCw className="h-3 w-3" strokeWidth={1.75} />
          )}
          {saved ? "Try new" : "Regenerate"}
        </button>

        {saved ? (
          <button
            onClick={onOpen}
            className="flex items-center gap-1.5 rounded-lg border border-[#22c55e]/30 px-3 py-1.5 text-[11px] font-semibold text-[#22c55e] outline-none transition-[background,box-shadow] hover:bg-[#22c55e]/10 focus-visible:ring-2 focus-visible:ring-[#22c55e]/40"
          >
            <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
            Open saved
          </button>
        ) : (
          <button
            onClick={onSave}
            disabled={saving || regenerating}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold text-white outline-none transition-[background,box-shadow] focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 disabled:opacity-40"
            style={{
              background: "linear-gradient(135deg, #3b82f6, #0ea5e9)",
              boxShadow: "0 0 16px rgba(59,130,246,.30), 0 2px 6px rgba(14,165,233,.15)",
            }}
          >
            {saving ? (
              <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.75} />
            ) : (
              <ArrowRight className="h-3 w-3" strokeWidth={1.75} />
            )}
            Save idea
          </button>
        )}
      </div>
    </div>
  );
}

function SkeletonCard({ index }: { index: number }) {
  return (
    <div
      className="animate-pulse rounded-xl border border-white/[0.06] bg-[#1a1a1a] p-4"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      <div className="flex gap-2">
        <div className="h-5 w-20 rounded-full bg-white/[0.06]" />
        <div className="h-5 w-16 rounded-full bg-white/[0.04]" />
      </div>
      <div className="mt-3 h-4 w-4/5 rounded bg-white/[0.06]" />
      <div className="mt-1.5 h-4 w-3/5 rounded bg-white/[0.04]" />
      <div className="mt-3 space-y-1.5">
        <div className="h-3 w-full rounded bg-white/[0.04]" />
        <div className="h-3 w-4/5 rounded bg-white/[0.03]" />
      </div>
      <div className="mt-4 flex justify-between border-t border-white/[0.04] pt-3">
        <div className="h-7 w-24 rounded-lg bg-white/[0.04]" />
        <div className="h-7 w-24 rounded-lg bg-white/[0.08]" />
      </div>
    </div>
  );
}

export function BrainstormModal({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [seedIdea, setSeedIdea] = useState("");
  const [selectedType, setSelectedType] = useState<ContentType>("reel_long");
  const [generating, setGenerating] = useState(false);
  const [generatedIdeas, setGeneratedIdeas] = useState<BrainstormedIdea[]>([]);
  const [regeneratingIndex, setRegeneratingIndex] = useState<number | null>(null);
  const [savingIndex, setSavingIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // title → { id, title } for all ideas saved this session
  const [savedMap, setSavedMap] = useState<Record<string, string>>({});
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Manual add state
  const [manualTitle, setManualTitle] = useState("");
  const [manualPillar, setManualPillar] = useState<Pillar>("Claude Code");
  const [manualType, setManualType] = useState<ContentType>("reel_long");
  const [addingManual, setAddingManual] = useState(false);

  // Close on Escape
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Sync manual type to selected type
  useEffect(() => {
    setManualType(selectedType);
  }, [selectedType]);

  function flashSuccess(msg: string) {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3500);
  }

  async function handleGenerate() {
    if (!seedIdea.trim()) return;
    setGenerating(true);
    setError(null);
    setGeneratedIdeas([]);
    try {
      const ideas = await apiBrainstormIdeas({
        seedIdea: seedIdea.trim(),
        contentType: selectedType,
        count: 4,
      });
      setGeneratedIdeas(ideas);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed");
    } finally {
      setGenerating(false);
    }
  }

  const handleRegenerate = useCallback(
    async (index: number) => {
      setRegeneratingIndex(index);
      setError(null);
      try {
        const idea = await apiRegenerateOne({
          seedIdea: seedIdea.trim(),
          contentType: selectedType,
          // exclude current slots + all saved titles to keep results fresh
          excludeTitles: [
            ...generatedIdeas.map((i) => i.title),
            ...Object.keys(savedMap),
          ],
        });
        setGeneratedIdeas((prev) => {
          const next = [...prev];
          next[index] = idea;
          return next;
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Regeneration failed");
      } finally {
        setRegeneratingIndex(null);
      }
    },
    [seedIdea, selectedType, generatedIdeas, savedMap]
  );

  async function handleSave(index: number) {
    const idea = generatedIdeas[index];
    if (savedMap[idea.title]) return;
    setSavingIndex(index);
    try {
      const created = await apiCreateIdea({
        title: idea.title,
        pillar: (idea.pillar as Pillar) ?? "Claude Code",
        contentType: (idea.contentType as ContentType) ?? "reel_long",
        hookLine1: idea.hookLine1,
      });
      setSavedMap((prev) => ({ ...prev, [idea.title]: created.id }));
      setError(null);
      flashSuccess(`"${idea.title.slice(0, 40)}${idea.title.length > 40 ? "…" : ""}" saved!`);
    } catch {
      setError("Couldn't save that idea — try again.");
    } finally {
      setSavingIndex(null);
    }
  }

  async function handleManualAdd() {
    if (!manualTitle.trim()) return;
    setAddingManual(true);
    try {
      const created = await apiCreateIdea({
        title: manualTitle.trim(),
        pillar: manualPillar,
        contentType: manualType,
      });
      router.push(`/ideas/${created.id}`);
    } catch {
      setAddingManual(false);
    }
  }

  const savedCount = Object.keys(savedMap).length;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-8"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm" />

      {/* Panel */}
      <div
        className="relative z-10 w-full max-w-3xl rounded-2xl border border-white/[0.08] bg-[#111111]"
        style={{
          boxShadow:
            "0 0 0 1px rgba(59,130,246,.18), 0 0 80px rgba(59,130,246,.10), 0 40px 120px rgba(0,0,0,.60), inset 0 1px 0 rgba(255,255,255,.06)",
        }}
      >
        {/* Ambient orb */}
        <div
          className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl"
          aria-hidden
        >
          <div
            className="absolute -top-24 left-1/2 h-64 w-64 -translate-x-1/2 opacity-20"
            style={{
              background:
                "radial-gradient(circle, rgba(59,130,246,.5), transparent 70%)",
            }}
          />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-6 py-4">
          <div className="flex items-center gap-2.5">
            <Sparkles className="h-5 w-5 text-[#3b82f6]" strokeWidth={1.75} />
            <span className="text-sm font-semibold text-white">Brainstorm Ideas</span>
            {savedCount > 0 && (
              <span className="flex items-center gap-1 rounded-full bg-[#22c55e]/15 px-2 py-0.5 text-[10px] font-semibold text-[#22c55e]">
                <CheckCircle2 className="h-2.5 w-2.5" strokeWidth={2} />
                {savedCount} saved
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-[#6b7280] outline-none transition-[background,color] hover:bg-white/[0.06] hover:text-white focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40"
          >
            <X className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Seed input */}
          <div className="space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-[2.5px] text-[#3b82f6]"
              style={{ fontFamily: "var(--font-mono)" }}>
              Seed Idea
            </label>
            <textarea
              value={seedIdea}
              onChange={(e) => setSeedIdea(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleGenerate();
              }}
              placeholder="e.g. Claude Code can write your entire test suite automatically…"
              rows={2}
              className="w-full resize-none rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-3 text-sm text-white placeholder-[#4b5563] outline-none transition-[border,box-shadow] focus:border-[#3b82f6]/40 focus:ring-2 focus:ring-[#3b82f6]/20"
            />
          </div>

          {/* Content type picker */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase tracking-[2.5px] text-[#3b82f6]"
              style={{ fontFamily: "var(--font-mono)" }}>
              Content Type
            </label>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPES.map((ct) => (
                <ContentTypePill
                  key={ct}
                  value={ct}
                  selected={selectedType === ct}
                  onClick={() => setSelectedType(ct)}
                />
              ))}
            </div>
          </div>

          {/* Generate button */}
          <button
            onClick={handleGenerate}
            disabled={generating || !seedIdea.trim()}
            className="flex w-full items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold text-white outline-none transition-[box-shadow,opacity] focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 disabled:cursor-not-allowed disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #3b82f6, #0ea5e9)",
              boxShadow: generating
                ? "none"
                : "0 0 28px rgba(59,130,246,.40), 0 2px 8px rgba(14,165,233,.20)",
            }}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <Wand2 className="h-4 w-4" strokeWidth={1.75} />
            )}
            {generating ? "Generating…" : generatedIdeas.length > 0 ? "Regenerate All" : "Generate Ideas"}
          </button>

          {error && (
            <p className="rounded-lg border border-rose-500/20 bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300">
              {error}
            </p>
          )}

          {/* Results */}
          {(generating || generatedIdeas.length > 0) && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-bold uppercase tracking-[2.5px] text-[#3b82f6]"
                  style={{ fontFamily: "var(--font-mono)" }}>
                  Generated Ideas
                </p>
                {/* Success flash */}
                <span
                  className={cn(
                    "flex items-center gap-1 text-[11px] font-medium text-[#22c55e] transition-[opacity,transform] duration-300",
                    successMsg ? "opacity-100 translate-y-0" : "pointer-events-none opacity-0 translate-y-1"
                  )}
                >
                  <CheckCircle2 className="h-3 w-3" strokeWidth={2} />
                  {successMsg ?? ""}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {generating
                  ? [0, 1, 2, 3].map((i) => <SkeletonCard key={i} index={i} />)
                  : generatedIdeas.map((idea, i) => {
                      const isSaved = Boolean(savedMap[idea.title]);
                      const savedId = savedMap[idea.title];
                      return (
                        <IdeaResultCard
                          key={`${idea.title}-${i}`}
                          idea={idea}
                          index={i}
                          regenerating={regeneratingIndex === i}
                          saving={savingIndex === i}
                          saved={isSaved}
                          savedId={savedId}
                          onRegenerate={() => handleRegenerate(i)}
                          onSave={() => handleSave(i)}
                          onOpen={() => router.push(`/ideas/${savedId}`)}
                        />
                      );
                    })}
              </div>
              {savedCount > 0 && (
                <p className="text-center text-[11px] text-[#6b7280]">
                  {savedCount} idea{savedCount !== 1 ? "s" : ""} saved — close this modal to see them in your Ideas bank.
                </p>
              )}
            </div>
          )}

          {/* Divider */}
          <div className="relative flex items-center gap-3">
            <div className="flex-1 border-t border-white/[0.06]" />
            <span className="text-[11px] text-[#4b5563]">or add manually</span>
            <div className="flex-1 border-t border-white/[0.06]" />
          </div>

          {/* Manual add */}
          <div className="space-y-3">
            <label className="block text-[11px] font-bold uppercase tracking-[2.5px] text-[#3b82f6]"
              style={{ fontFamily: "var(--font-mono)" }}>
              Quick Add
            </label>
            <input
              value={manualTitle}
              onChange={(e) => setManualTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleManualAdd();
              }}
              placeholder="Idea title…"
              className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] px-4 py-2.5 text-sm text-white placeholder-[#4b5563] outline-none transition-[border,box-shadow] focus:border-[#3b82f6]/40 focus:ring-2 focus:ring-[#3b82f6]/20"
            />
            <div className="flex flex-wrap items-center gap-2">
              {/* Pillar picker */}
              <div className="relative">
                <select
                  value={manualPillar}
                  onChange={(e) => setManualPillar(e.target.value as Pillar)}
                  className="h-8 appearance-none rounded-full border border-white/[0.08] bg-white/[0.04] pl-3 pr-7 text-xs font-medium text-[#9ca3af] outline-none transition-colors hover:border-white/[0.15] focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 cursor-pointer"
                  style={{
                    backgroundImage:
                      "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
                    backgroundRepeat: "no-repeat",
                    backgroundPosition: "right 0.4rem center",
                    backgroundSize: "0.7rem",
                  }}
                >
                  {PILLARS.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              {/* Content type picker */}
              <div className="flex flex-wrap gap-1.5">
                {CONTENT_TYPES.map((ct) => (
                  <button
                    key={ct}
                    onClick={() => setManualType(ct)}
                    className={cn(
                      "rounded-full px-2.5 py-1 text-[10px] font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40",
                      manualType === ct
                        ? `${CONTENT_TYPE_COLORS[ct].bg} ${CONTENT_TYPE_COLORS[ct].text} ring-1 ring-inset ring-current/20`
                        : "bg-white/[0.04] text-[#6b7280] hover:bg-white/[0.08] hover:text-[#9ca3af]"
                    )}
                  >
                    {CONTENT_TYPE_LABELS[ct]}
                  </button>
                ))}
              </div>

              <button
                onClick={handleManualAdd}
                disabled={addingManual || !manualTitle.trim()}
                className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold text-white outline-none transition-[background,opacity] focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 disabled:opacity-40"
                style={{ background: "linear-gradient(135deg, #3b82f6, #0ea5e9)" }}
              >
                {addingManual ? (
                  <Loader2 className="h-3 w-3 animate-spin" strokeWidth={1.75} />
                ) : (
                  <Plus className="h-3 w-3" strokeWidth={1.75} />
                )}
                Add &amp; Edit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
