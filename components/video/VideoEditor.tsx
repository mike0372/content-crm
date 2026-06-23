"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  GripVertical,
  Check,
  X,
} from "lucide-react";
import {
  Video,
  STATUSES,
  PILLARS,
  FORMATS,
  POSTING_WINDOWS,
  BEAT_LABELS,
  TRIGGER_TYPES,
  Beat,
  Scorecard,
  STATUS_LABELS,
} from "@/lib/types";
import { Button, Card, Input, Label, Select, Textarea, Chip } from "@/components/ui/controls";
import { PillarBadge, StatusBadge } from "@/components/ui/Badge";
import { SaveIndicator, CopyButton } from "@/components/ui/misc";
import { useAutosave } from "@/lib/useAutosave";
import { apiSaveVideo } from "@/lib/api";
import { uid } from "@/lib/factories";
import { cn } from "@/lib/utils";

const TABS = ["META", "HOOK", "SCRIPT", "CAPTION", "ENGAGEMENT", "CHECKLIST", "RESULTS"] as const;
type Tab = (typeof TABS)[number];

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

export function VideoEditor({ initial, initialTab }: { initial: Video; initialTab?: string }) {
  const [video, setVideo] = useState<Video>(initial);
  const [tab, setTab] = useState<Tab>(
    initialTab && (TABS as readonly string[]).includes(initialTab) ? (initialTab as Tab) : "META"
  );
  const { state, schedule } = useAutosave<Video>(apiSaveVideo);

  function update(patch: Partial<Video> | ((v: Video) => Video)) {
    setVideo((prev) => {
      const next = typeof patch === "function" ? patch(prev) : { ...prev, ...patch };
      schedule(next);
      return next;
    });
  }

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-white/[0.06] bg-base/80 px-7 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-4">
          <Link
            href="/board"
            className="inline-flex items-center gap-1.5 text-sm text-zinc-400 outline-none transition-colors hover:text-white focus-visible:text-white"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} /> Board
          </Link>
          <SaveIndicator state={state} />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <input
            value={video.title}
            onChange={(e) => update({ title: e.target.value })}
            className="min-w-[280px] flex-1 bg-transparent text-[22px] font-bold tracking-[-0.025em] text-white outline-none placeholder:text-zinc-600"
            placeholder="Untitled Reel"
          />
          <PillarBadge pillar={video.pillar} />
          <StatusBadge status={video.status} />
        </div>

        <nav className="mt-4 flex gap-1 overflow-x-auto no-scrollbar">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "relative whitespace-nowrap rounded-[9px] px-3.5 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.18em] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40",
                tab === t ? "text-white" : "text-zinc-500 hover:text-zinc-300"
              )}
            >
              {t}
              {tab === t && (
                <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[#3b82f6]" />
              )}
            </button>
          ))}
        </nav>
      </header>

      <div className="mx-auto max-w-4xl animate-fade-in px-7 py-7">
        {tab === "META" && <MetaTab video={video} update={update} />}
        {tab === "HOOK" && <HookTab video={video} update={update} />}
        {tab === "SCRIPT" && <ScriptTab video={video} update={update} />}
        {tab === "CAPTION" && <CaptionTab video={video} update={update} />}
        {tab === "ENGAGEMENT" && <EngagementTab video={video} update={update} />}
        {tab === "CHECKLIST" && <ChecklistTab video={video} update={update} />}
        {tab === "RESULTS" && <ResultsTab video={video} update={update} />}
      </div>
    </>
  );
}

type TabProps = {
  video: Video;
  update: (patch: Partial<Video> | ((v: Video) => Video)) => void;
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function MetaTab({ video, update }: TabProps) {
  return (
    <Card elevated className="p-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <Field label="Status">
          <Select value={video.status} onChange={(e) => update({ status: e.target.value as Video["status"] })}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Pillar">
          <Select value={video.pillar} onChange={(e) => update({ pillar: e.target.value as Video["pillar"] })}>
            {PILLARS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Format">
          <Select value={video.format} onChange={(e) => update({ format: e.target.value as Video["format"] })}>
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Length target">
          <Input value={video.lengthTarget} onChange={(e) => update({ lengthTarget: e.target.value })} placeholder="30s" />
        </Field>
        <Field label="Posting window">
          <Select value={video.postingWindow} onChange={(e) => update({ postingWindow: e.target.value as Video["postingWindow"] })}>
            {POSTING_WINDOWS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Source URL">
          <Input value={video.sourceUrl} onChange={(e) => update({ sourceUrl: e.target.value })} placeholder="https://…" />
        </Field>
      </div>
      <div className="mt-6 border-t border-white/[0.06] pt-4 text-xs text-zinc-500">
        Created {new Date(video.createdAt).toLocaleString()} · Updated{" "}
        {new Date(video.updatedAt).toLocaleString()}
      </div>
    </Card>
  );
}

function HookTab({ video, update }: TabProps) {
  const h = video.hook;
  const setHook = (patch: Partial<Video["hook"]>) => update({ hook: { ...h, ...patch } });
  const l1 = wordCount(h.line1);
  const l2 = wordCount(h.line2);
  return (
    <div className="space-y-5">
      <Card elevated className="space-y-5 p-6">
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
        <Field label="First 2 seconds plan">
          <Textarea
            value={h.firstTwoSeconds}
            onChange={(e) => setHook({ firstTwoSeconds: e.target.value })}
            placeholder="Hard cut to terminal mid-command, red error flashing…"
          />
        </Field>
      </Card>

      <Card className="p-6">
        <Label>Hook scorecard</Label>
        <div className="mt-2 flex flex-wrap gap-2">
          {SCORE_LABELS.map(({ key, label }) => {
            const on = h.scorecard[key];
            return (
              <button
                key={key}
                onClick={() => setHook({ scorecard: { ...h.scorecard, [key]: !on } })}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40",
                  on
                    ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30"
                    : "bg-white/[0.04] text-zinc-500 ring-1 ring-inset ring-white/[0.06] hover:text-zinc-300"
                )}
              >
                {on ? <Check className="h-3.5 w-3.5" strokeWidth={1.75} /> : <X className="h-3.5 w-3.5" strokeWidth={1.75} />}
                {label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-zinc-500">
          {Object.values(h.scorecard).filter(Boolean).length}/5 passing
        </p>
      </Card>
    </div>
  );
}

function ScriptTab({ video, update }: TabProps) {
  const setBeats = (script: Beat[]) => update({ script });
  const updateBeat = (id: string, patch: Partial<Beat>) =>
    setBeats(video.script.map((b) => (b.id === id ? { ...b, ...patch } : b)));
  const addBeat = () =>
    setBeats([
      ...video.script,
      { id: uid("beat"), timestamp: "0:00", label: "DEMO", content: "", retentionNote: "" },
    ]);
  const removeBeat = (id: string) => setBeats(video.script.filter((b) => b.id !== id));

  return (
    <div className="space-y-3">
      {video.script.map((b, i) => (
        <Card key={b.id} className="p-4">
          <div className="flex items-center gap-3">
            <span className="grid h-6 w-6 shrink-0 place-items-center rounded-md bg-white/[0.05] text-xs font-semibold text-zinc-500">
              {i + 1}
            </span>
            <Input
              value={b.timestamp}
              onChange={(e) => updateBeat(b.id, { timestamp: e.target.value })}
              className="w-20 font-mono text-center"
              placeholder="0:00"
            />
            <Select
              value={b.label}
              onChange={(e) => updateBeat(b.id, { label: e.target.value as Beat["label"] })}
              className="w-40"
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
              aria-label="Delete beat"
            >
              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
            </button>
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_240px]">
            <Textarea
              value={b.content}
              onChange={(e) => updateBeat(b.id, { content: e.target.value })}
              placeholder="What's said / shown in this beat…"
              className="min-h-[64px]"
            />
            <Textarea
              value={b.retentionNote}
              onChange={(e) => updateBeat(b.id, { retentionNote: e.target.value })}
              placeholder="Retention note (pattern interrupt, B-roll cut…)"
              className="min-h-[64px] bg-[#3b82f6]/[0.03]"
            />
          </div>
        </Card>
      ))}
      <Button onClick={addBeat} className="w-full">
        <Plus className="h-4 w-4" strokeWidth={1.75} /> Add beat
      </Button>
    </div>
  );
}

function CaptionTab({ video, update }: TabProps) {
  const setCaptions = (captions: Video["captions"]) => update({ captions });
  return (
    <div className="space-y-4">
      {video.captions.map((c, i) => (
        <Card
          key={i}
          elevated={c.recommended}
          className={cn("p-5", c.recommended && "ring-1 ring-inset ring-accent/30")}
        >
          <div className="flex items-center justify-between">
            <label className="inline-flex cursor-pointer items-center gap-2.5">
              <input
                type="radio"
                name="recommended-caption"
                checked={c.recommended}
                onChange={() =>
                  setCaptions(video.captions.map((x, j) => ({ ...x, recommended: j === i })))
                }
                className="h-4 w-4 accent-[#3b82f6]"
              />
              <Input
                value={c.variant}
                onChange={(e) =>
                  setCaptions(video.captions.map((x, j) => (j === i ? { ...x, variant: e.target.value } : x)))
                }
                className="h-7 w-44 text-sm font-semibold"
              />
            </label>
            {c.recommended && (
              <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-[11px] font-semibold text-accent">
                Recommended
              </span>
            )}
          </div>
          <Textarea
            value={c.text}
            onChange={(e) =>
              setCaptions(video.captions.map((x, j) => (j === i ? { ...x, text: e.target.value } : x)))
            }
            placeholder="Caption copy…"
            className="mt-3"
          />
          <Input
            value={c.hashtags}
            onChange={(e) =>
              setCaptions(video.captions.map((x, j) => (j === i ? { ...x, hashtags: e.target.value } : x)))
            }
            placeholder="#claudecode #ai #buildinpublic"
            className="mt-2 text-accent"
          />
        </Card>
      ))}
    </div>
  );
}

function EngagementTab({ video, update }: TabProps) {
  const e = video.engagement;
  const setEng = (patch: Partial<Video["engagement"]>) => update({ engagement: { ...e, ...patch } });
  return (
    <Card elevated className="space-y-5 p-6">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Comment trigger type">
          <Select
            value={e.triggerType}
            onChange={(ev) => setEng({ triggerType: ev.target.value as Video["engagement"]["triggerType"] })}
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
          <Input value={e.triggerText} onChange={(ev) => setEng({ triggerText: ev.target.value })} placeholder={`Comment "AGENT" and I'll DM you`} />
        </Field>
      </div>
      <Field label="First comment (pin this)">
        <div className="flex items-start gap-2">
          <Textarea value={e.firstComment} onChange={(ev) => setEng({ firstComment: ev.target.value })} placeholder="Drop the first comment to seed the thread…" />
          <CopyButton text={e.firstComment} className="mt-0.5" />
        </div>
      </Field>
      <Field label="End-card text">
        <Input value={e.endCard} onChange={(ev) => setEng({ endCard: ev.target.value })} placeholder="Follow for more Claude Code tips" />
      </Field>
    </Card>
  );
}

function ChecklistTab({ video, update }: TabProps) {
  const groups = useMemo(() => {
    const m = new Map<string, typeof video.checklist>();
    video.checklist.forEach((it) => {
      if (!m.has(it.group)) m.set(it.group, []);
      m.get(it.group)!.push(it);
    });
    return Array.from(m.entries());
  }, [video.checklist]);

  const toggle = (id: string) =>
    update({
      checklist: video.checklist.map((it) => (it.id === id ? { ...it, checked: !it.checked } : it)),
    });

  const done = video.checklist.filter((i) => i.checked).length;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className="h-full rounded-full bg-accent transition-[width] duration-300"
            style={{ width: `${(done / Math.max(video.checklist.length, 1)) * 100}%` }}
          />
        </div>
        <span className="text-xs font-medium text-zinc-400">
          {done}/{video.checklist.length}
        </span>
      </div>

      {groups.map(([group, items]) => (
        <Card key={group} className="p-5">
          <h3 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-accent/80">{group}</h3>
          <div className="space-y-1">
            {items.map((it) => (
              <button
                key={it.id}
                onClick={() => toggle(it.id)}
                className="group flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left outline-none transition-colors hover:bg-white/[0.03] focus-visible:ring-2 focus-visible:ring-accent/30"
              >
                <span
                  className={cn(
                    "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors",
                    it.checked
                      ? "border-accent bg-accent text-white"
                      : "border-white/15 group-hover:border-white/30"
                  )}
                >
                  {it.checked && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
                </span>
                <span className={cn("text-sm", it.checked ? "text-zinc-500 line-through" : "text-zinc-200")}>
                  {it.label}
                </span>
              </button>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string;
  value: number | null;
  onChange: (v: number | null) => void;
  suffix?: string;
}) {
  return (
    <Field label={label}>
      <div className="relative">
        <Input
          type="number"
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          placeholder="0"
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-zinc-600">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  );
}

function ResultsTab({ video, update }: TabProps) {
  const r = video.results;
  const setR = (patch: Partial<Video["results"]>) => update({ results: { ...r, ...patch } });
  const verdicts: Video["results"]["verdict"][] = ["WIN", "MEH", "FLOP"];

  return (
    <Card elevated className="space-y-6 p-6">
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <NumField label="Views IG" value={r.viewsIG} onChange={(v) => setR({ viewsIG: v })} />
        <NumField label="Views FB" value={r.viewsFB} onChange={(v) => setR({ viewsFB: v })} />
        <NumField label="Skip rate" value={r.skipRate} onChange={(v) => setR({ skipRate: v })} suffix="%" />
        <Field label="Top source">
          <Input value={r.topSource} onChange={(e) => setR({ topSource: e.target.value })} placeholder="Explore / Home / Profile" />
        </Field>
        <NumField label="Likes" value={r.likes} onChange={(v) => setR({ likes: v })} />
        <NumField label="Comments" value={r.comments} onChange={(v) => setR({ comments: v })} />
        <NumField label="Saves" value={r.saves} onChange={(v) => setR({ saves: v })} />
        <NumField label="Follows" value={r.follows} onChange={(v) => setR({ follows: v })} />
      </div>

      <div className="border-t border-white/[0.06] pt-5">
        <Label>Verdict</Label>
        <div className="mt-1 flex gap-2">
          {verdicts.map((v) => (
            <Chip key={v} active={r.verdict === v} onClick={() => setR({ verdict: r.verdict === v ? "" : v })}>
              {v}
            </Chip>
          ))}
        </div>
      </div>

      <Field label="Lesson learned">
        <Textarea value={r.lesson} onChange={(e) => setR({ lesson: e.target.value })} placeholder="What worked, what to change next time…" />
      </Field>

      <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3">
        <p className="text-xs text-zinc-500">
          Results autosave. Mark <span className="text-emerald-400">Analyzed</span> to surface this reel in Performance.
        </p>
        <Button
          variant="primary"
          onClick={() => update({ status: "ANALYZED" })}
          disabled={video.status === "ANALYZED"}
        >
          {video.status === "ANALYZED" ? "Analyzed" : "Mark Analyzed"}
        </Button>
      </div>
    </Card>
  );
}
