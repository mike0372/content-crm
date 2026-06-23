"use client";

import { useState } from "react";
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
} from "lucide-react";
import {
  ContentItem,
  PILLARS,
  HOOK_TYPES,
  HOOK_TYPE_LABELS,
  FORMATS,
  POSTING_WINDOWS,
  BEAT_LABELS,
  TRIGGER_TYPES,
  Beat,
  Scorecard,
  Pillar,
  HookType,
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
import { apiSaveIdea, apiPromoteIdea } from "@/lib/api";
import { uid } from "@/lib/factories";
import { cn } from "@/lib/utils";

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
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  isEmpty?: boolean;
  emptyLabel?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen || !isEmpty);
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
  label: string;
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
}: {
  item: ContentItem;
  update: (p: Partial<ContentItem>) => void;
}) {
  return (
    <Section title="1 — Core">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Pillar">
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

        <Field label="Hook type">
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

        <Field label="Format">
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

        <Field label="Length target">
          <Input
            value={item.lengthTarget}
            onChange={(e) => update({ lengthTarget: e.target.value })}
            placeholder="30s"
          />
        </Field>
      </div>

      <Field label="Posting window">
        <div className="flex gap-2">
          {(["Evening (6-8pm)", "Night (9-11pm)"] as const).map((w) => (
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
              {w === "Evening (6-8pm)" ? "Evening" : "Late night"}
            </button>
          ))}
          {item.postingWindow &&
            !["Evening (6-8pm)", "Night (9-11pm)"].includes(
              item.postingWindow
            ) && (
              <Select
                value={item.postingWindow}
                onChange={(e) =>
                  update({
                    postingWindow:
                      e.target.value as ContentItem["postingWindow"],
                  })
                }
                className="flex-1"
              >
                {POSTING_WINDOWS.map((w) => (
                  <option key={w} value={w}>
                    {w}
                  </option>
                ))}
              </Select>
            )}
        </div>
      </Field>
    </Section>
  );
}

// ---- Section: Demand Signal -------------------------------------------------

function DemandSection({
  item,
  update,
}: {
  item: ContentItem;
  update: (p: Partial<ContentItem>) => void;
}) {
  const ds = item.demandSignal ?? { text: "", source: "", date: "" };
  const setDs = (patch: Partial<typeof ds>) =>
    update({ demandSignal: { ...ds, ...patch } });

  return (
    <Section title="2 — Demand Signal">
      <Field label="Evidence">
        <Textarea
          value={ds.text}
          onChange={(e) => setDs({ text: e.target.value })}
          placeholder="85k views on similar YouTube video, Apr 2026 — topic is clearly resonating"
          className="min-h-[72px]"
        />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Source URL">
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

        <Field label="Date">
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
}: {
  item: ContentItem;
  update: (p: Partial<ContentItem>) => void;
}) {
  const h = item.hook;
  const setHook = (patch: Partial<ContentItem["hook"]>) =>
    update({ hook: { ...h, ...patch } });
  const l1 = wordCount(h.line1);
  const l2 = wordCount(h.line2);
  const scorecardCount = Object.values(h.scorecard).filter(Boolean).length;

  return (
    <Section title="3 — Hook">
      <Field label={`Hook line 1 — ${l1}/12 words`}>
        <Input
          value={h.line1}
          onChange={(e) => setHook({ line1: e.target.value })}
          placeholder="You're using Claude Code wrong"
          className={cn(l1 > 12 && "border-rose-500/50 focus-visible:ring-rose-500/20")}
        />
      </Field>

      <Field label={`Hook line 2 — ${l2}/6 words`}>
        <Input
          value={h.line2}
          onChange={(e) => setHook({ line2: e.target.value })}
          placeholder="Here's the fix"
          className={cn(l2 > 6 && "border-rose-500/50 focus-visible:ring-rose-500/20")}
        />
      </Field>

      <Field label="First-2-seconds plan">
        <Textarea
          value={h.firstTwoSeconds}
          onChange={(e) => setHook({ firstTwoSeconds: e.target.value })}
          placeholder="Hard cut to terminal mid-command, red error flashing…"
        />
      </Field>

      <div>
        <Label>Hook scorecard — {scorecardCount}/5</Label>
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
        <Label>Topic recognition score</Label>
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
}: {
  item: ContentItem;
  update: (p: Partial<ContentItem>) => void;
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
      isEmpty={isEmpty}
      emptyLabel="Optional at idea stage"
    >
      {isEmpty ? (
        <Button onClick={addBeat} className="w-full">
          <Plus className="h-4 w-4" strokeWidth={1.75} /> Sketch the script
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
}: {
  item: ContentItem;
  update: (p: Partial<ContentItem>) => void;
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
    >
      {isEmpty ? (
        <Button onClick={addCaption} className="w-full">
          <Plus className="h-4 w-4" strokeWidth={1.75} /> Draft a caption
        </Button>
      ) : (
        <>
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
}: {
  item: ContentItem;
  update: (p: Partial<ContentItem>) => void;
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
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Comment trigger type">
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
        <Field label="Trigger text">
          <Input
            value={e.triggerText}
            onChange={(ev) => setEng({ triggerText: ev.target.value })}
            placeholder={`Comment "AGENT" and I'll DM you`}
          />
        </Field>
      </div>
      <Field label="First comment (pin this)">
        <div className="flex items-start gap-2">
          <Textarea
            value={e.firstComment}
            onChange={(ev) => setEng({ firstComment: ev.target.value })}
            placeholder="Drop the first comment to seed the thread…"
          />
          <CopyBtn text={e.firstComment} />
        </div>
      </Field>
      <Field label="End-card text">
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

  function update(patch: Partial<ContentItem>) {
    setItem((prev) => {
      const next = { ...prev, ...patch };
      schedule(next);
      return next;
    });
  }

  const readiness = calcReadiness(item);
  const isReady = readiness >= 80;

  async function handlePromote() {
    if (!isReady || promoting) return;
    setPromoting(true);
    try {
      const res = await apiPromoteIdea(item.id);
      const day = res.day ? res.day.toUpperCase() : null;
      // Navigate to the video editor — same item ID, now production stage
      router.push(
        `/video/${item.id}${day ? `?promoted=${day}` : ""}`
      );
    } catch {
      setPromoting(false);
    }
  }

  return (
    <>
      {/* Sticky header */}
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-base/80 px-7 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/ideas"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 outline-none transition-colors hover:text-white focus-visible:text-white"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> Ideas
          </Link>
          <SaveIndicator state={state} />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            value={item.title}
            onChange={(e) => update({ title: e.target.value })}
            className="min-w-[240px] flex-1 bg-transparent text-[22px] font-bold tracking-[-0.025em] text-white outline-none placeholder:text-zinc-600"
            placeholder="Untitled Idea"
          />
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
      <div className="mx-auto max-w-3xl animate-fade-in space-y-4 px-7 py-7">
        <CoreSection item={item} update={update} />
        <DemandSection item={item} update={update} />
        <HookSection item={item} update={update} />
        <ScriptSection item={item} update={update} />
        <CaptionSection item={item} update={update} />
        <EngagementSection item={item} update={update} />

        <div className="rounded-xl border border-white/[0.04] bg-white/[0.02] px-5 py-4 text-xs text-zinc-600">
          Created {new Date(item.createdAt).toLocaleString()} · Last saved{" "}
          {new Date(item.updatedAt).toLocaleString()}
        </div>
      </div>
    </>
  );
}
