"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  Star,
  Plus,
  Trash2,
  Check,
  X,
  Loader2,
  Copy,
  CheckCheck,
  Rocket,
  Link2,
  Calendar,
  GripVertical,
  Sparkles,
  Wand2,
  RefreshCw,
  ScrollText,
} from "lucide-react";
import {
  ContentItem,
  PILLARS,
  HOOK_TYPES,
  HOOK_TYPE_LABELS,
  FORMATS,
  POSTING_WINDOWS,
  DURATION_OPTIONS,
  BEAT_LABELS,
  TRIGGER_TYPES,
  Beat,
  BeatLabel,
  Caption,
  Scorecard,
  Pillar,
  HookType,
  Format,
  PostingWindow,
  TriggerType,
  calcReadiness,
  readinessLabel,
  demandFreshness,
} from "@/lib/types";
import {
  Button,
  Card,
  Input,
  Label,
  Select,
  Textarea,
  Chip,
} from "@/components/ui/controls";
import { PillarBadge } from "@/components/ui/Badge";
import { SaveIndicator } from "@/components/ui/misc";
import { useAutosave } from "@/lib/useAutosave";
import {
  apiSaveIdea,
  apiPromoteIdea,
  apiAutofillIdea,
  apiGenerateScript,
  apiCompleteIdea,
  AutofillFields,
} from "@/lib/api";
import { uid } from "@/lib/factories";
import { cn } from "@/lib/utils";
import { LinkedReelSection } from "@/components/ideas/LinkedReelSection";
import { FilmingScriptModal } from "@/components/ideas/FilmingScriptModal";

// ---- AI autofill tag --------------------------------------------------------
// Briefly marks a field the autofill just populated, then fades out.

type AiState = { fields: Set<string>; fade: boolean };

function AiTag({ ai, name }: { ai: AiState; name: string }) {
  if (!ai.fields.has(name)) return null;
  return (
    <span
      className={cn(
        "ml-1.5 inline-flex items-center gap-0.5 rounded-full bg-[#3b82f6]/15 px-1.5 py-0.5 align-middle text-[9px] font-bold uppercase tracking-wider text-[#60a5fa] ring-1 ring-inset ring-[#3b82f6]/30 transition-opacity duration-500",
        ai.fade ? "opacity-0" : "opacity-100"
      )}
    >
      <Sparkles className="h-2.5 w-2.5" strokeWidth={2} /> AI
    </span>
  );
}

// ---- Readiness meter --------------------------------------------------------

function ReadinessMeter({
  score,
  className,
}: {
  score: number;
  className?: string;
}) {
  const label = readinessLabel(score);
  const isReady = score >= 80;
  const isDev = score >= 40;
  return (
    <div className={cn("space-y-1.5", className)}>
      <div className="flex items-center justify-between">
        <span
          className={cn(
            "text-xs font-semibold",
            isReady
              ? "text-emerald-400"
              : isDev
              ? "text-amber-400"
              : "text-zinc-500"
          )}
        >
          {label}
        </span>
        <span className="text-xs tabular-nums text-zinc-500">{score}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn(
            "h-full rounded-full transition-[width] duration-500",
            isReady
              ? "bg-emerald-500"
              : isDev
              ? "bg-amber-500"
              : "bg-zinc-600"
          )}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}

// ---- Collapsible section wrapper --------------------------------------------

function Section({
  title,
  defaultOpen = true,
  isEmpty,
  emptyLabel,
  openSignal,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  isEmpty?: boolean;
  emptyLabel?: string;
  // When this counter increments (autofill/script-gen populated this section),
  // force the section open so the user sees what was filled.
  openSignal?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || !isEmpty);
  useEffect(() => {
    if (openSignal && openSignal > 0) setOpen(true);
  }, [openSignal]);
  return (
    <div className="overflow-hidden rounded-xl border border-white/[0.06] bg-surface shadow-[0_1px_3px_rgba(0,0,0,0.4)]">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-white/[0.02]"
      >
        <span className="text-sm font-semibold text-zinc-200">{title}</span>
        <div className="flex items-center gap-2">
          {isEmpty && !open && emptyLabel && (
            <span className="text-[11px] text-zinc-600">{emptyLabel}</span>
          )}
          <ChevronDown
            className={cn(
              "h-4 w-4 text-zinc-500 transition-transform duration-200",
              open && "rotate-180"
            )}
            strokeWidth={1.75}
          />
        </div>
      </button>
      {open && <div className="space-y-4 px-5 pb-5">{children}</div>}
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

// ---- Recognition stars ------------------------------------------------------

function StarSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          onClick={() => onChange(n)}
          className="outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-500/40"
          aria-label={`${n} stars`}
        >
          <Star
            className={cn(
              "h-5 w-5 transition-colors",
              n <= value
                ? "fill-amber-400 text-amber-400"
                : "text-zinc-700 hover:text-amber-700"
            )}
            strokeWidth={1.5}
          />
        </button>
      ))}
      <span className="ml-1 text-xs text-zinc-500">{value}/5</span>
    </div>
  );
}

// ---- Freshness badge --------------------------------------------------------

function FreshnessDot({ dateStr }: { dateStr: string }) {
  const f = demandFreshness(dateStr);
  if (!f) return null;
  const colors = {
    green: "bg-emerald-500",
    yellow: "bg-amber-400",
    red: "bg-rose-500",
  };
  const labels = {
    green: "Fresh (≤30 days)",
    yellow: "Getting stale (30–90 days)",
    red: "Stale (90+ days)",
  };
  return (
    <span
      title={labels[f]}
      className={cn("inline-block h-2 w-2 rounded-full", colors[f])}
    />
  );
}

// ---- Scorecard chips --------------------------------------------------------

const SCORE_LABELS: { key: keyof Scorecard; label: string }[] = [
  { key: "recognition", label: "Recognition" },
  { key: "openLoop", label: "Open loop" },
  { key: "firstTwoS", label: "First-2s" },
  { key: "specificity", label: "Specificity" },
  { key: "identity", label: "Identity" },
];

function wordCount(s: string) {
  return s.trim() ? s.trim().split(/\s+/).length : 0;
}

// ---- Copy button ------------------------------------------------------------

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }
  return (
    <button
      onClick={copy}
      className="rounded-md p-1.5 text-zinc-600 outline-none transition-colors hover:bg-white/[0.06] hover:text-zinc-200 focus-visible:ring-2 focus-visible:ring-accent/40"
      aria-label="Copy"
    >
      {copied ? (
        <CheckCheck className="h-4 w-4 text-emerald-400" strokeWidth={1.75} />
      ) : (
        <Copy className="h-4 w-4" strokeWidth={1.75} />
      )}
    </button>
  );
}

// ---- Section: Core ----------------------------------------------------------

function CoreSection({
  item,
  update,
  ai,
  openSignal,
}: {
  item: ContentItem;
  update: (p: Partial<ContentItem>) => void;
  ai: AiState;
  openSignal?: number;
}) {
  return (
    <Section title="1 — Core" openSignal={openSignal}>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={<>Pillar<AiTag ai={ai} name="pillar" /></>}>
          <Select
            value={item.pillar}
            onChange={(e) => update({ pillar: e.target.value as Pillar })}
          >
            {PILLARS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={<>Hook type<AiTag ai={ai} name="hookType" /></>}>
          <Select
            value={item.hookType}
            onChange={(e) => update({ hookType: e.target.value as HookType | "" })}
          >
            <option value="">Select hook type…</option>
            {HOOK_TYPES.map((h) => (
              <option key={h} value={h} title={HOOK_TYPE_LABELS[h]}>
                {h} — {HOOK_TYPE_LABELS[h]}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={<>Format<AiTag ai={ai} name="format" /></>}>
          <Select
            value={item.format}
            onChange={(e) =>
              update({ format: e.target.value as ContentItem["format"] })
            }
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={<>Length target<AiTag ai={ai} name="lengthTarget" /></>}>
          <Input
            value={item.lengthTarget}
            onChange={(e) => update({ lengthTarget: e.target.value })}
            placeholder="30s"
          />
        </Field>
      </div>

      <Field label={<>Posting window<AiTag ai={ai} name="postingWindow" /></>}>
        <div className="flex flex-wrap gap-2">
          {POSTING_WINDOWS.map((w) => (
            <button
              key={w}
              onClick={() =>
                update({ postingWindow: item.postingWindow === w ? "" : w })
              }
              className={cn(
                "rounded-[9px] border px-3 py-2 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40",
                item.postingWindow === w
                  ? "border-accent/40 bg-accent/15 text-accent"
                  : "border-white/[0.07] bg-base text-zinc-400 hover:border-white/20 hover:text-zinc-200"
              )}
            >
              {w.replace(/ \(.*\)/, "")}
            </button>
          ))}
        </div>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Scheduled time">
          <Input
            type="time"
            value={item.scheduledTime}
            onChange={(e) => update({ scheduledTime: e.target.value })}
          />
        </Field>
        <Field label="Duration">
          <Select
            value={String(item.durationMin || 60)}
            onChange={(e) => update({ durationMin: Number(e.target.value) })}
          >
            {DURATION_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </Select>
        </Field>
      </div>
    </Section>
  );
}

// ---- Section: Demand Signal -------------------------------------------------

function DemandSection({
  item,
  update,
  ai,
  openSignal,
}: {
  item: ContentItem;
  update: (p: Partial<ContentItem>) => void;
  ai: AiState;
  openSignal?: number;
}) {
  const ds = item.demandSignal ?? { text: "", source: "", date: "" };
  const setDs = (patch: Partial<typeof ds>) =>
    update({ demandSignal: { ...ds, ...patch } });

  return (
    <Section title="2 — Demand Signal" openSignal={openSignal}>
      <Field label={<>Evidence<AiTag ai={ai} name="demandText" /></>}>
        <Textarea
          value={ds.text}
          onChange={(e) => setDs({ text: e.target.value })}
          placeholder="85k views on similar YouTube video, Apr 2026 — topic is clearly resonating"
          className="min-h-[72px]"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={<>Source URL<AiTag ai={ai} name="sourceUrl" /></>}>
          <div className="flex items-center gap-2">
            <Link2
              className="h-4 w-4 shrink-0 text-zinc-600"
              strokeWidth={1.75}
            />
            <Input
              value={ds.source}
              onChange={(e) => setDs({ source: e.target.value })}
              placeholder="https://…"
              className="flex-1"
            />
            {ds.source && (
              <a
                href={ds.source}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 rounded-md p-1.5 text-zinc-600 outline-none transition-colors hover:text-accent focus-visible:ring-2 focus-visible:ring-accent/40"
                aria-label="Open source"
              >
                <Link2 className="h-4 w-4" strokeWidth={1.75} />
              </a>
            )}
          </div>
        </Field>

        <Field label={<>Date<AiTag ai={ai} name="demandDate" /></>}>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="date"
                value={ds.date}
                onChange={(e) => setDs({ date: e.target.value })}
                className="w-full rounded-[9px] border border-white/[0.07] bg-base px-3 py-2 text-sm text-zinc-100 outline-none transition-[border-color,box-shadow] focus-visible:border-[#3b82f6]/50 focus-visible:ring-2 focus-visible:ring-[#3b82f6]/20 [color-scheme:dark]"
              />
            </div>
            {ds.date && <FreshnessDot dateStr={ds.date} />}
          </div>
        </Field>
      </div>

      {ds.date && (
        <p className="text-[11px] text-zinc-600">
          {(() => {
            const days = Math.round(
              (Date.now() - new Date(ds.date).getTime()) /
                (1000 * 60 * 60 * 24)
            );
            const f = demandFreshness(ds.date);
            return f === "green"
              ? `${days}d ago — fresh signal`
              : f === "yellow"
              ? `${days}d ago — getting stale`
              : `${days}d ago — stale, consider refreshing`;
          })()}
        </p>
      )}
    </Section>
  );
}

// ---- Section: Hook ----------------------------------------------------------

function HookSection({
  item,
  update,
  ai,
  openSignal,
}: {
  item: ContentItem;
  update: (p: Partial<ContentItem>) => void;
  ai: AiState;
  openSignal?: number;
}) {
  const h = item.hook;
  const setHook = (patch: Partial<ContentItem["hook"]>) =>
    update({ hook: { ...h, ...patch } });
  const l1 = wordCount(h.line1);
  const l2 = wordCount(h.line2);
  const scorecardCount = Object.values(h.scorecard).filter(Boolean).length;

  return (
    <Section title="3 — Hook" openSignal={openSignal}>
      <Field label={<>Hook line 1 — {l1}/12 words<AiTag ai={ai} name="hookLine1" /></>}>
        <Input
          value={h.line1}
          onChange={(e) => setHook({ line1: e.target.value })}
          placeholder="You're using Claude Code wrong"
          className={cn(l1 > 12 && "border-rose-500/50 focus-visible:ring-rose-500/20")}
        />
      </Field>

      <Field label={<>Hook line 2 — {l2}/6 words<AiTag ai={ai} name="hookLine2" /></>}>
        <Input
          value={h.line2}
          onChange={(e) => setHook({ line2: e.target.value })}
          placeholder="Here's the fix"
          className={cn(l2 > 6 && "border-rose-500/50 focus-visible:ring-rose-500/20")}
        />
      </Field>

      <Field label={<>First-2-seconds plan<AiTag ai={ai} name="firstTwoSeconds" /></>}>
        <Textarea
          value={h.firstTwoSeconds}
          onChange={(e) => setHook({ firstTwoSeconds: e.target.value })}
          placeholder="Hard cut to terminal mid-command, red error flashing…"
        />
      </Field>

      <div>
        <Label>Hook scorecard — {scorecardCount}/5<AiTag ai={ai} name="scorecard" /></Label>
        <div className="flex flex-wrap gap-2">
          {SCORE_LABELS.map(({ key, label }) => {
            const on = h.scorecard[key];
            return (
              <button
                key={key}
                onClick={() =>
                  setHook({ scorecard: { ...h.scorecard, [key]: !on } })
                }
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40",
                  on
                    ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30"
                    : "bg-white/[0.04] text-zinc-500 ring-1 ring-inset ring-white/[0.06] hover:text-zinc-300"
                )}
              >
                {on ? (
                  <Check className="h-3.5 w-3.5" strokeWidth={1.75} />
                ) : (
                  <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                )}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>Topic recognition score<AiTag ai={ai} name="recognitionScore" /></Label>
        <StarSelector
          value={item.recognitionScore ?? 3}
          onChange={(v) => update({ recognitionScore: v })}
        />
        <p className="mt-1 text-[11px] text-zinc-600">
          How recognizable is this topic to your audience? (1 = niche, 5 = very familiar)
        </p>
      </div>
    </Section>
  );
}

// ---- Section: Script (optional) --------------------------------------------

function ScriptSection({
  item,
  update,
  ai,
  openSignal,
  generating,
  showGenerate,
  showRegenerate,
  onGenerate,
}: {
  item: ContentItem;
  update: (p: Partial<ContentItem>) => void;
  ai: AiState;
  openSignal?: number;
  generating: boolean;
  showGenerate: boolean;
  showRegenerate: boolean;
  onGenerate: () => void;
}) {
  const beats = item.script ?? [];
  const setBeats = (script: Beat[]) => update({ script });
  const updateBeat = (id: string, patch: Partial<Beat>) =>
    setBeats(beats.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const addBeat = () =>
    setBeats([
      ...beats,
      { id: uid("beat"), timestamp: "0:00", label: "DEMO", content: "", retentionNote: "" },
    ]);
  const removeBeat = (id: string) => setBeats(beats.filter((b) => b.id !== id));

  const isEmpty = beats.length === 0;

  return (
    <Section
      title="4 — Script"
      defaultOpen={false}
      isEmpty={isEmpty && !showGenerate}
      emptyLabel="Optional at idea stage"
      openSignal={openSignal}
    >
      {/* AI script generation — PDF didn't carry a full script */}
      {showGenerate && (
        <div className="rounded-xl border border-[#3b82f6]/25 bg-[#3b82f6]/[0.06] p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-zinc-100">
            <Wand2 className="h-4 w-4 text-[#60a5fa]" strokeWidth={1.75} />
            Script not found in PDF — generate one?
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-zinc-500">
            Claude will write a 45–60s beat-by-beat script from your hook,
            pillar, and demand signal. Every beat stays fully editable.
          </p>
          <Button
            variant="primary"
            onClick={onGenerate}
            disabled={generating}
            className="mt-3"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <Wand2 className="h-4 w-4" strokeWidth={1.75} />
            )}
            {generating ? "Writing script…" : "Generate Script"}
          </Button>
        </div>
      )}

      {showRegenerate && (
        <div className="flex items-center justify-between">
          <span className="text-[11px] text-zinc-500">
            AI-generated<AiTag ai={ai} name="script" />
          </span>
          <Button
            variant="subtle"
            size="sm"
            onClick={onGenerate}
            disabled={generating}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
            )}
            {generating ? "Writing…" : "Regenerate"}
          </Button>
        </div>
      )}

      {isEmpty ? (
        <Button onClick={addBeat} variant="subtle" className="w-full">
          <Plus className="h-4 w-4" strokeWidth={1.75} /> Sketch the script manually
        </Button>
      ) : (
        <>
          <div className="space-y-3">
            {beats.map((b, i) => (
              <Card key={b.id} className="p-4">
                <div className="flex items-center gap-3">
                  <GripVertical
                    className="h-4 w-4 shrink-0 text-zinc-700"
                    strokeWidth={1.75}
                  />
                  <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/[0.05] text-xs font-semibold text-zinc-500">
                    {i + 1}
                  </span>
                  <Input
                    value={b.timestamp}
                    onChange={(e) => updateBeat(b.id, { timestamp: e.target.value })}
                    className="w-20 text-center font-mono"
                    placeholder="0:00"
                  />
                  <Select
                    value={b.label}
                    onChange={(e) =>
                      updateBeat(b.id, { label: e.target.value as Beat["label"] })
                    }
                    className="w-36"
                  >
                    {BEAT_LABELS.map((l) => (
                      <option key={l} value={l}>
                        {l}
                      </option>
                    ))}
                  </Select>
                  <div className="flex-1" />
                  <button
                    onClick={() => removeBeat(b.id)}
                    className="rounded-md p-1.5 text-zinc-600 outline-none transition-colors hover:bg-rose-500/10 hover:text-rose-400 focus-visible:ring-2 focus-visible:ring-rose-500/40"
                  >
                    <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                </div>
                <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_220px]">
                  <Textarea
                    value={b.content}
                    onChange={(e) => updateBeat(b.id, { content: e.target.value })}
                    placeholder="What's said / shown…"
                    className="min-h-[56px]"
                  />
                  <Textarea
                    value={b.retentionNote}
                    onChange={(e) =>
                      updateBeat(b.id, { retentionNote: e.target.value })
                    }
                    placeholder="Retention note…"
                    className="min-h-[56px] bg-[#3b82f6]/[0.03]"
                  />
                </div>
              </Card>
            ))}
          </div>
          <Button onClick={addBeat} className="w-full">
            <Plus className="h-4 w-4" strokeWidth={1.75} /> Add beat
          </Button>
        </>
      )}
    </Section>
  );
}

// ---- Section: Caption (optional) -------------------------------------------

function CaptionSection({
  item,
  update,
  ai,
  openSignal,
}: {
  item: ContentItem;
  update: (p: Partial<ContentItem>) => void;
  ai: AiState;
  openSignal?: number;
}) {
  const captions = item.captions ?? [];
  const setCaptions = (c: ContentItem["captions"]) => update({ captions: c });
  const isEmpty = captions.length === 0;

  function addCaption() {
    setCaptions([
      ...captions,
      { variant: `Variant ${captions.length + 1}`, text: "", hashtags: "", recommended: captions.length === 0 },
    ]);
  }

  return (
    <Section
      title="5 — Caption"
      defaultOpen={false}
      isEmpty={isEmpty}
      emptyLabel="Optional at idea stage"
      openSignal={openSignal}
    >
      {isEmpty ? (
        <Button onClick={addCaption} className="w-full">
          <Plus className="h-4 w-4" strokeWidth={1.75} /> Draft a caption
        </Button>
      ) : (
        <>
          {ai.fields.has("captions") && (
            <div className="text-[11px] text-zinc-500">
              Variants<AiTag ai={ai} name="captions" />
            </div>
          )}
          <div className="space-y-4">
            {captions.map((c, i) => (
              <Card
                key={i}
                elevated={c.recommended}
                className={cn("p-4", c.recommended && "ring-1 ring-inset ring-accent/30")}
              >
                <div className="flex items-center justify-between">
                  <label className="inline-flex cursor-pointer items-center gap-2">
                    <input
                      type="radio"
                      name="recommended-caption"
                      checked={c.recommended}
                      onChange={() =>
                        setCaptions(captions.map((x, j) => ({ ...x, recommended: j === i })))
                      }
                      className="h-4 w-4 accent-[#3b82f6]"
                    />
                    <Input
                      value={c.variant}
                      onChange={(e) =>
                        setCaptions(captions.map((x, j) => j === i ? { ...x, variant: e.target.value } : x))
                      }
                      className="h-7 w-40 text-sm font-semibold"
                    />
                  </label>
                  <div className="flex items-center gap-2">
                    {c.recommended && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-semibold text-accent">
                        Recommended
                      </span>
                    )}
                    <button
                      onClick={() => setCaptions(captions.filter((_, j) => j !== i))}
                      className="rounded-md p-1 text-zinc-600 outline-none transition-colors hover:bg-rose-500/10 hover:text-rose-400 focus-visible:ring-2 focus-visible:ring-rose-500/40"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </div>
                <Textarea
                  value={c.text}
                  onChange={(e) =>
                    setCaptions(captions.map((x, j) => j === i ? { ...x, text: e.target.value } : x))
                  }
                  placeholder="Caption copy…"
                  className="mt-3"
                />
                <Input
                  value={c.hashtags}
                  onChange={(e) =>
                    setCaptions(captions.map((x, j) => j === i ? { ...x, hashtags: e.target.value } : x))
                  }
                  placeholder="#claudecode #ai #buildinpublic"
                  className="mt-2 text-accent"
                />
              </Card>
            ))}
          </div>
          <Button onClick={addCaption} className="w-full">
            <Plus className="h-4 w-4" strokeWidth={1.75} /> Add variant
          </Button>
        </>
      )}
    </Section>
  );
}

// ---- Section: Engagement (optional) ----------------------------------------

function EngagementSection({
  item,
  update,
  ai,
  openSignal,
}: {
  item: ContentItem;
  update: (p: Partial<ContentItem>) => void;
  ai: AiState;
  openSignal?: number;
}) {
  const e = item.engagement;
  const setEng = (patch: Partial<ContentItem["engagement"]>) =>
    update({ engagement: { ...e, ...patch } });

  const isEmpty = !e.triggerType && !e.triggerText && !e.firstComment && !e.endCard;

  return (
    <Section
      title="6 — Engagement"
      defaultOpen={false}
      isEmpty={isEmpty}
      emptyLabel="Optional at idea stage"
      openSignal={openSignal}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={<>Comment trigger type<AiTag ai={ai} name="triggerType" /></>}>
          <Select
            value={e.triggerType}
            onChange={(ev) =>
              setEng({ triggerType: ev.target.value as ContentItem["engagement"]["triggerType"] })
            }
          >
            <option value="">Select trigger…</option>
            {TRIGGER_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={<>Trigger text<AiTag ai={ai} name="triggerText" /></>}>
          <Input
            value={e.triggerText}
            onChange={(ev) => setEng({ triggerText: ev.target.value })}
            placeholder={`Comment "AGENT" and I'll DM you`}
          />
        </Field>
      </div>
      <Field label={<>First comment (pin this)<AiTag ai={ai} name="firstComment" /></>}>
        <div className="flex items-start gap-2">
          <Textarea
            value={e.firstComment}
            onChange={(ev) => setEng({ firstComment: ev.target.value })}
            placeholder="Drop the first comment to seed the thread…"
          />
          <CopyBtn text={e.firstComment} />
        </div>
      </Field>
      <Field label={<>End-card text<AiTag ai={ai} name="endCard" /></>}>
        <Input
          value={e.endCard}
          onChange={(ev) => setEng({ endCard: ev.target.value })}
          placeholder="Follow for more Claude Code tips"
        />
      </Field>
    </Section>
  );
}

// ---- Main editor ------------------------------------------------------------

export function IdeaEditor({ initial }: { initial: ContentItem }) {
  const router = useRouter();
  const [item, setItem] = useState<ContentItem>(initial);
  const [promoting, setPromoting] = useState(false);
  const { state, schedule } = useAutosave<ContentItem>(apiSaveIdea);

  // Autofill-from-PDF state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autofilling, setAutofilling] = useState(false);
  const [toast, setToast] = useState<{ msg: string; err?: boolean } | null>(null);
  const [ai, setAi] = useState<AiState>({ fields: new Set(), fade: false });
  // Per-section "force open" counters — bumped when autofill/script-gen fills
  // a section so it expands automatically.
  const [expand, setExpand] = useState<Record<string, number>>({});
  function bumpExpand(keys: string[]) {
    setExpand((e) => {
      const next = { ...e };
      for (const k of keys) next[k] = (next[k] ?? 0) + 1;
      return next;
    });
  }
  // AI script generation state
  const [autofillDone, setAutofillDone] = useState(false);
  const [scriptGenerated, setScriptGenerated] = useState(false);
  const [generatingScript, setGeneratingScript] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [scriptOpen, setScriptOpen] = useState(false);

  function update(patch: Partial<ContentItem>) {
    setItem((prev) => {
      const next = { ...prev, ...patch };
      schedule(next);
      return next;
    });
  }

  function showToast(msg: string, err = false) {
    setToast({ msg, err });
    setTimeout(() => setToast(null), 4000);
  }

  // Merge an AI field object (from autofill or AI-complete) into the current
  // item — only ever populating fields the user hasn't filled, never overwriting.
  // Returns the patch plus which fields/sections were touched.
  function mergeFields(f: AutofillFields): {
    patch: Partial<ContentItem>;
    filled: Set<string>;
    sections: Set<string>;
  } {
      const patch: Partial<ContentItem> = {};
      const filled = new Set<string>();
      const sections = new Set<string>();
      const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

      // Only ever populate fields the user hasn't filled — never overwrite.

      // ---- Section 1: Core ----
      if (str(f.title) && !item.title.trim()) {
        patch.title = str(f.title);
        filled.add("title");
        sections.add("core");
      }
      const pillar = str(f.pillar) as Pillar;
      // Pillar always has a value; treat the factory default as "unset".
      if (PILLARS.includes(pillar) && item.pillar === "Claude Code") {
        patch.pillar = pillar;
        filled.add("pillar");
        sections.add("core");
      }
      const hookType = str(f.hookType) as HookType;
      if (HOOK_TYPES.includes(hookType) && !item.hookType) {
        patch.hookType = hookType;
        filled.add("hookType");
        sections.add("core");
      }
      // Format — prompt enum uses "B-roll"; map to our "B-roll voiceover".
      let fmt = str(f.format);
      if (fmt === "B-roll") fmt = "B-roll voiceover";
      if (FORMATS.includes(fmt as Format) && item.format === "Talking head") {
        patch.format = fmt as Format;
        filled.add("format");
        sections.add("core");
      }
      if (str(f.lengthTarget) && !item.lengthTarget.trim()) {
        patch.lengthTarget = str(f.lengthTarget);
        filled.add("lengthTarget");
        sections.add("core");
      }
      // Posting window — prompt enum is coarse ("Evening"/"Late").
      const pwMap: Record<string, PostingWindow> = {
        Evening: "Evening (6-8pm)",
        Late: "Night (9-11pm)",
      };
      const pw = pwMap[str(f.postingWindow)];
      if (pw && !item.postingWindow) {
        patch.postingWindow = pw;
        filled.add("postingWindow");
        sections.add("core");
      }

      // ---- Section 2: Demand Signal ----
      const ds = f.demandSignal;
      const demandPatch: Partial<ContentItem["demandSignal"]> = {};
      if (ds) {
        if (str(ds.text) && !item.demandSignal.text.trim()) {
          demandPatch.text = str(ds.text);
          filled.add("demandText");
          sections.add("demand");
        }
        if (str(ds.source) && !item.demandSignal.source.trim()) {
          demandPatch.source = str(ds.source);
          patch.sourceUrl = str(ds.source);
          filled.add("sourceUrl");
          sections.add("demand");
        }
        if (str(ds.date) && !item.demandSignal.date.trim()) {
          demandPatch.date = str(ds.date);
          filled.add("demandDate");
          sections.add("demand");
        }
      }
      if (Object.keys(demandPatch).length) {
        patch.demandSignal = { ...item.demandSignal, ...demandPatch };
      }

      // ---- Section 3: Hook ----
      const hk = f.hook;
      const hookPatch: Partial<ContentItem["hook"]> = {};
      if (hk) {
        if (str(hk.line1) && !item.hook.line1.trim()) {
          hookPatch.line1 = str(hk.line1);
          filled.add("hookLine1");
          sections.add("hook");
        }
        if (str(hk.line2) && !item.hook.line2.trim()) {
          hookPatch.line2 = str(hk.line2);
          filled.add("hookLine2");
          sections.add("hook");
        }
        if (str(hk.firstTwoSeconds) && !item.hook.firstTwoSeconds.trim()) {
          hookPatch.firstTwoSeconds = str(hk.firstTwoSeconds);
          filled.add("firstTwoSeconds");
          sections.add("hook");
        }
        // Scorecard — only apply if the user hasn't toggled anything yet.
        const sc = hk.scorecard;
        const userTouchedScorecard = Object.values(item.hook.scorecard).some(
          Boolean
        );
        if (sc && !userTouchedScorecard) {
          const newSc = { ...item.hook.scorecard };
          let any = false;
          (
            ["recognition", "openLoop", "firstTwoS", "specificity", "identity"] as const
          ).forEach((k) => {
            if (typeof sc[k] === "boolean") {
              newSc[k] = sc[k] as boolean;
              if (sc[k]) any = true;
            }
          });
          if (any) {
            hookPatch.scorecard = newSc;
            filled.add("scorecard");
            sections.add("hook");
          }
        }
      }
      if (Object.keys(hookPatch).length) {
        patch.hook = { ...item.hook, ...hookPatch };
      }
      // Recognition score — default is 3, treat as "unset" (rendered in Hook).
      const rec = Number(f.recognitionScore);
      if (rec >= 1 && rec <= 5 && item.recognitionScore === 3) {
        patch.recognitionScore = Math.round(rec);
        filled.add("recognitionScore");
        sections.add("hook");
      }

      // ---- Section 4: Script ----
      const rawBeats = Array.isArray(f.script) ? f.script : [];
      if (rawBeats.length > 0 && item.script.length === 0) {
        const mapped: Beat[] = rawBeats
          .filter((b) => b && (str(b.content) || str(b.timestamp)))
          .map((b) => ({
            id: uid("beat"),
            timestamp: str(b.timestamp) || "0:00",
            label: (BEAT_LABELS.includes(str(b.label) as BeatLabel)
              ? str(b.label)
              : "DEMO") as BeatLabel,
            content: str(b.content),
            retentionNote: str(b.retentionNote),
          }));
        if (mapped.length) {
          patch.script = mapped;
          filled.add("script");
          sections.add("script");
        }
      }

      // ---- Section 5: Captions ----
      const rawCaps = Array.isArray(f.captions) ? f.captions : [];
      if (rawCaps.length > 0 && item.captions.length === 0) {
        const mapped: Caption[] = rawCaps
          .filter((c) => c && str(c.text))
          .map((c, i) => ({
            variant: `Variant ${i + 1}`,
            text: str(c.text),
            hashtags: str(c.hashtags),
            recommended: c.recommended === true,
          }));
        if (mapped.length && !mapped.some((c) => c.recommended)) {
          mapped[0].recommended = true;
        }
        if (mapped.length) {
          patch.captions = mapped;
          filled.add("captions");
          sections.add("caption");
        }
      }

      // ---- Section 6: Engagement ----
      const eng = f.engagement;
      const engPatch: Partial<ContentItem["engagement"]> = {};
      if (eng) {
        const tt = str(eng.triggerType) as TriggerType;
        if (TRIGGER_TYPES.includes(tt) && !item.engagement.triggerType) {
          engPatch.triggerType = tt;
          filled.add("triggerType");
          sections.add("engagement");
        }
        if (str(eng.triggerText) && !item.engagement.triggerText.trim()) {
          engPatch.triggerText = str(eng.triggerText);
          filled.add("triggerText");
          sections.add("engagement");
        }
        if (str(eng.firstComment) && !item.engagement.firstComment.trim()) {
          engPatch.firstComment = str(eng.firstComment);
          filled.add("firstComment");
          sections.add("engagement");
        }
        if (str(eng.endCard) && !item.engagement.endCard.trim()) {
          engPatch.endCard = str(eng.endCard);
          filled.add("endCard");
          sections.add("engagement");
        }
      }
      if (Object.keys(engPatch).length) {
        patch.engagement = { ...item.engagement, ...engPatch };
      }

      return { patch, filled, sections };
  }

  async function handleAutofill(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setAutofilling(true);
    try {
      const f = await apiAutofillIdea(file);
      const { patch, filled, sections } = mergeFields(f);

      // Mark autofill complete — this unlocks the "Generate Script" panel when
      // the document didn't carry a full script.
      setAutofillDone(true);
      // If the doc carried no full script, expand Section 4 so the user sees
      // the "Generate Script" panel without having to open it.
      const finalScriptLen = patch.script?.length ?? item.script.length;
      if (finalScriptLen < 3) sections.add("script");
      bumpExpand([...sections]);

      if (filled.size === 0) {
        showToast("Nothing to fill — all matching fields are already set");
      } else {
        update(patch);
        setAi({ fields: filled, fade: false });
        // Fade the AI tags after ~3s, then clear them.
        setTimeout(() => setAi((a) => ({ ...a, fade: true })), 3000);
        setTimeout(() => setAi({ fields: new Set(), fade: false }), 3600);
        // Count of sections that actually received data (exclude a script-only
        // expand that was just to reveal the Generate panel).
        const filledSections = new Set([...sections].filter((s) => s !== "script" || filled.has("script")));
        showToast(
          `Filled ${filled.size} field${filled.size === 1 ? "" : "s"} across ${
            filledSections.size
          } section${filledSections.size === 1 ? "" : "s"}`
        );
      }
    } catch (err) {
      showToast(
        `Autofill failed: ${err instanceof Error ? err.message : "unknown error"}`,
        true
      );
    } finally {
      setAutofilling(false);
    }
  }

  async function handleComplete() {
    if (completing) return;
    setCompleting(true);
    try {
      const f = await apiCompleteIdea({
        title: item.title,
        hookLine1: item.hook.line1,
        hookLine2: item.hook.line2,
        firstTwoSeconds: item.hook.firstTwoSeconds,
        pillar: item.pillar,
        format: item.format,
        lengthTarget: item.lengthTarget,
        demandSignal: item.demandSignal.text,
      });
      const { patch, filled, sections } = mergeFields(f);
      bumpExpand([...sections]);
      if (filled.size === 0) {
        showToast("Idea already complete — nothing to fill");
      } else {
        update(patch);
        if (filled.has("script")) setScriptGenerated(true);
        setAi({ fields: filled, fade: false });
        setTimeout(() => setAi((a) => ({ ...a, fade: true })), 3000);
        setTimeout(() => setAi({ fields: new Set(), fade: false }), 3600);
        showToast(
          `Completed idea — filled ${filled.size} field${
            filled.size === 1 ? "" : "s"
          } across ${sections.size} section${sections.size === 1 ? "" : "s"}`
        );
      }
    } catch (err) {
      showToast(
        `AI complete failed: ${err instanceof Error ? err.message : "unknown error"}`,
        true
      );
    } finally {
      setCompleting(false);
    }
  }

  async function handleGenerateScript() {
    if (generatingScript) return;
    setGeneratingScript(true);
    try {
      const raw = await apiGenerateScript({
        title: item.title,
        hookLine1: item.hook.line1,
        hookLine2: item.hook.line2,
        firstTwoSeconds: item.hook.firstTwoSeconds,
        pillar: item.pillar,
        format: item.format,
        lengthTarget: item.lengthTarget,
        demandSignal: item.demandSignal.text,
      });
      const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
      const mapped: Beat[] = (raw ?? [])
        .filter((b) => b && typeof b.content === "string")
        .map((b) => ({
          id: uid("beat"),
          timestamp: str(b.timestamp) || "0:00",
          label: (BEAT_LABELS.includes(str(b.label) as BeatLabel)
            ? str(b.label)
            : "DEMO") as BeatLabel,
          content: str(b.content),
          retentionNote: str(b.retentionNote),
        }));
      if (!mapped.length) throw new Error("AI returned an empty script");
      update({ script: mapped });
      setScriptGenerated(true);
      setAi({ fields: new Set(["script"]), fade: false });
      setTimeout(() => setAi((a) => ({ ...a, fade: true })), 3000);
      setTimeout(() => setAi({ fields: new Set(), fade: false }), 3600);
      bumpExpand(["script"]);
      showToast(
        `Script generated — ${mapped.length} beats. Edit any beat directly.`
      );
    } catch (err) {
      showToast(
        `Script generation failed: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
        true
      );
    } finally {
      setGeneratingScript(false);
    }
  }

  const readiness = calcReadiness(item);
  const isReady = readiness >= 80;

  async function handlePromote() {
    if (!isReady || promoting) return;
    setPromoting(true);
    try {
      const res = await apiPromoteIdea(item.id);
      const day = res.day ? res.day.toUpperCase() : null;
      router.push(
        `/video/${item.id}${day ? `?promoted=${day}` : ""}`
      );
    } catch (err) {
      setPromoting(false);
      showToast(
        `Failed to promote: ${err instanceof Error ? err.message : "unknown error"}`,
        true
      );
    }
  }

  return (
    <>
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-base/80 px-7 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/ideas"
            className="group inline-flex items-center gap-1.5 text-sm text-zinc-400 outline-none transition-colors hover:text-white focus-visible:text-white"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-x-0.5" strokeWidth={1.75} /> Ideas
          </Link>
          <div className="flex items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,text/plain,application/pdf"
              className="hidden"
              onChange={handleAutofill}
            />
            <Button
              variant="subtle"
              size="sm"
              onClick={() => setScriptOpen(true)}
            >
              <ScrollText className="h-4 w-4" strokeWidth={1.75} />
              Filming Script
            </Button>
            <Button
              variant="subtle"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={autofilling}
            >
              {autofilling ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <Sparkles className="h-4 w-4" strokeWidth={1.75} />
              )}
              {autofilling ? "Extracting…" : "Autofill from PDF"}
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleComplete}
              disabled={completing}
            >
              {completing ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <Wand2 className="h-4 w-4" strokeWidth={1.75} />
              )}
              {completing ? "Completing…" : "Complete with AI"}
            </Button>
            <SaveIndicator state={state} />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div className="flex min-w-[240px] flex-1 items-center">
            <input
              value={item.title}
              onChange={(e) => update({ title: e.target.value })}
              className="min-w-0 flex-1 bg-transparent text-[22px] font-bold tracking-[-0.025em] text-white outline-none placeholder:text-zinc-600"
              placeholder="Untitled Idea"
            />
            <AiTag ai={ai} name="title" />
          </div>
          <PillarBadge pillar={item.pillar} />
        </div>

        {/* Readiness + Promote */}
        <div className="mt-4 flex items-center gap-4">
          <div className="flex-1">
            <ReadinessMeter score={readiness} />
          </div>
          <div className="group relative">
            <Button
              variant="primary"
              onClick={handlePromote}
              disabled={!isReady || promoting}
            >
              {promoting ? (
                <Loader2
                  className="h-4 w-4 animate-spin"
                  strokeWidth={1.75}
                />
              ) : (
                <Rocket className="h-4 w-4" strokeWidth={1.75} />
              )}
              Promote to Board
            </Button>
            {!isReady && (
              <div className="pointer-events-none absolute right-0 top-full z-10 mt-2 w-52 rounded-lg border border-white/10 bg-zinc-900 px-3 py-2 text-xs text-zinc-300 opacity-0 transition-opacity group-hover:opacity-100">
                Reach 80% readiness to promote
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <div className="mx-auto max-w-3xl space-y-4 px-7 py-7">
        {[
          <CoreSection key="core" item={item} update={update} ai={ai} openSignal={expand.core} />,
          <DemandSection key="demand" item={item} update={update} ai={ai} openSignal={expand.demand} />,
          <HookSection key="hook" item={item} update={update} ai={ai} openSignal={expand.hook} />,
          <ScriptSection
            key="script"
            item={item}
            update={update}
            ai={ai}
            openSignal={expand.script}
            generating={generatingScript}
            showGenerate={(item.script?.length ?? 0) < 3}
            showRegenerate={scriptGenerated && (item.script?.length ?? 0) >= 3}
            onGenerate={handleGenerateScript}
          />,
          <CaptionSection key="caption" item={item} update={update} ai={ai} openSignal={expand.caption} />,
          <EngagementSection key="engagement" item={item} update={update} ai={ai} openSignal={expand.engagement} />,
          <LinkedReelSection key="linked" item={item} update={update} />,
        ].map((node, i) => (
          <div
            key={i}
            className="animate-fade-in-up"
            style={{ animationDelay: `${i * 60}ms` }}
          >
            {node}
          </div>
        ))}

        <div className="animate-fade-in-up rounded-xl border border-white/[0.04] bg-white/[0.02] px-5 py-4 text-xs text-zinc-600 [animation-delay:420ms]">
          Created {new Date(item.createdAt).toLocaleString()} · Last saved{" "}
          {new Date(item.updatedAt).toLocaleString()}
        </div>
      </div>

      {/* Autofill toast */}
      <div
        className={cn(
          "fixed bottom-6 left-1/2 z-50 -translate-x-1/2 transition-[opacity,transform] duration-300",
          toast ? "translate-y-0 opacity-100" : "translate-y-3 opacity-0 pointer-events-none"
        )}
      >
        {toast && (
          <div
            className={cn(
              "flex items-center gap-2 rounded-2xl border px-4 py-3 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.7)] backdrop-blur-xl",
              toast.err
                ? "border-rose-500/20 bg-rose-500/10 text-rose-200"
                : "border-[#3b82f6]/20 bg-[rgba(15,23,36,0.88)] text-zinc-100"
            )}
          >
            <Sparkles className="h-4 w-4 text-[#60a5fa]" strokeWidth={1.75} />
            <span className="text-sm">{toast.msg}</span>
          </div>
        )}
      </div>
      {/* Filming script modal */}
      {scriptOpen && (
        <FilmingScriptModal item={item} onClose={() => setScriptOpen(false)} />
      )}
    </>
  );
}
