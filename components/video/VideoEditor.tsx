"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Check,
  X,
  Link2,
  Loader2,
  RotateCw,
  ExternalLink,
  Unlink,
  Film,
  Search,
  Download,
  Sparkles,
  PencilLine,
  ScrollText,
  Undo2,
} from "lucide-react";
import { FilmingScriptModal } from "@/components/ideas/FilmingScriptModal";
import {
  Video,
  Results,
  STATUSES,
  PILLARS,
  FORMATS,
  POSTING_WINDOWS,
  DURATION_OPTIONS,
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
import {
  apiSaveVideo,
  apiGetInstagram,
  apiSyncInstagram,
  apiGenerateLesson,
  type IgCache,
  type IgPost,
} from "@/lib/api";
import {
  computeMetrics,
  overallVerdict,
  VERDICT_HEX,
  type MetricRow,
  type MetricVerdict,
  type OverallVerdict,
} from "@/lib/reelVerdict";
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
  const router = useRouter();
  const [video, setVideo] = useState<Video>(initial);
  const [tab, setTab] = useState<Tab>(() => {
    const want = initialTab?.toUpperCase();
    return want && (TABS as readonly string[]).includes(want) ? (want as Tab) : "META";
  });
  const { state, schedule } = useAutosave<Video>(apiSaveVideo);
  const [scriptOpen, setScriptOpen] = useState(false);
  const [retireConfirm, setRetireConfirm] = useState(false);
  const [retiring, setRetiring] = useState(false);

  async function handleRetire() {
    if (!retireConfirm) { setRetireConfirm(true); return; }
    setRetiring(true);
    try {
      await apiSaveVideo({ ...video, stage: "idea" });
      router.push("/ideas");
    } finally {
      setRetiring(false);
      setRetireConfirm(false);
    }
  }

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
            className="group inline-flex items-center gap-1.5 text-sm text-zinc-400 outline-none transition-colors hover:text-white focus-visible:text-white"
          >
            <ArrowLeft className="h-4 w-4 transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-x-0.5" strokeWidth={1.75} /> Board
          </Link>
          <div className="flex items-center gap-3">
            <Button variant="subtle" size="sm" onClick={() => setScriptOpen(true)}>
              <ScrollText className="h-4 w-4" strokeWidth={1.75} />
              Filming Script
            </Button>
            {retireConfirm ? (
              <div className="flex items-center gap-2">
                <span className="text-xs text-amber-400">Retire to ideas?</span>
                <Button
                  variant="subtle"
                  size="sm"
                  onClick={handleRetire}
                  disabled={retiring}
                >
                  {retiring ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : "Yes, retire"}
                </Button>
                <button
                  onClick={() => setRetireConfirm(false)}
                  className="rounded-md p-1.5 text-zinc-500 outline-none transition-colors hover:text-zinc-300 focus-visible:ring-2 focus-visible:ring-white/20"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
            ) : (
              <Button variant="subtle" size="sm" onClick={handleRetire}>
                <Undo2 className="h-4 w-4" strokeWidth={1.75} />
                Retire to ideas
              </Button>
            )}
            <SaveIndicator state={state} />
          </div>
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
                <span className="absolute inset-x-2 -bottom-px h-0.5 animate-scale-in rounded-full bg-[#3b82f6]" />
              )}
            </button>
          ))}
        </nav>
      </header>

      <div key={tab} className="mx-auto max-w-4xl animate-fade-in-up px-7 py-7">
        {tab === "META" && <MetaTab video={video} update={update} />}
        {tab === "HOOK" && <HookTab video={video} update={update} />}
        {tab === "SCRIPT" && <ScriptTab video={video} update={update} />}
        {tab === "CAPTION" && <CaptionTab video={video} update={update} />}
        {tab === "ENGAGEMENT" && <EngagementTab video={video} update={update} />}
        {tab === "CHECKLIST" && <ChecklistTab video={video} update={update} />}
        {tab === "RESULTS" && <ResultsTab video={video} update={update} />}
      </div>

      {scriptOpen && (
        <FilmingScriptModal item={video} onClose={() => setScriptOpen(false)} />
      )}
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
            <option value="">—</option>
            {POSTING_WINDOWS.map((w) => (
              <option key={w} value={w}>
                {w}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Scheduled time">
          <Input type="time" value={video.scheduledTime} onChange={(e) => update({ scheduledTime: e.target.value })} />
        </Field>
        <Field label="Duration">
          <Select value={String(video.durationMin || 60)} onChange={(e) => update({ durationMin: Number(e.target.value) })}>
            {DURATION_OPTIONS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
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

// ---- RESULTS tab: reel linking + automatic stats analysis -------------------

function fmtDate(ts: string): string {
  try {
    return new Date(ts).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return ts;
  }
}

// Resolve a pasted reel URL / shortcode / numeric ID to a known media ID.
function resolvePasted(value: string, posts: IgPost[]): string | null {
  const v = value.trim();
  if (!v) return null;
  if (/^\d+$/.test(v)) return v; // raw numeric media ID
  const code = v.match(/\/(?:reel|reels|p)\/([^/?#]+)/i)?.[1];
  if (code) {
    const hit = posts.find((p) => p.permalink.includes(code));
    if (hit) return hit.id;
  }
  return v; // fall back to raw value (will show "not in cache — refresh")
}

const OVERALL_STYLE: Record<OverallVerdict, string> = {
  WIN: "#22c55e",
  MEH: "#eab308",
  FLOP: "#ef4444",
};

function ResultsTab({ video, update }: TabProps) {
  const [cache, setCache] = useState<IgCache | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [manualOpen, setManualOpen] = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    apiGetInstagram()
      .then((c) => alive && setCache(c))
      .catch(() => alive && setCache(null))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const linkedId = video.instagramMediaId;
  const post = useMemo(
    () => cache?.posts.find((p) => p.id === linkedId) ?? null,
    [cache, linkedId]
  );
  const canLink = video.status === "POSTED" || video.status === "ANALYZED";

  async function refresh() {
    setSyncing(true);
    try {
      setCache(await apiSyncInstagram());
    } catch {
      /* keep existing cache */
    } finally {
      setSyncing(false);
    }
  }

  function link(id: string) {
    update({ instagramMediaId: id });
    setManualOpen(false);
  }

  // STATE B — linked reel
  if (linkedId) {
    return (
      <LinkedPanel
        video={video}
        update={update}
        post={post}
        syncing={syncing}
        onRefresh={refresh}
        extrasOpen={extrasOpen}
        setExtrasOpen={setExtrasOpen}
      />
    );
  }

  // Not linked, status not POSTED/ANALYZED, or user chose manual → plain form
  if (!canLink || manualOpen) {
    return (
      <div className="space-y-4">
        {canLink && (
          <button
            onClick={() => setManualOpen(false)}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 outline-none transition-colors hover:text-zinc-300 focus-visible:text-zinc-300"
          >
            <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} /> Back to linking
          </button>
        )}
        <ManualResultsForm video={video} update={update} />
      </div>
    );
  }

  // STATE A — not yet linked
  return (
    <LinkScreen
      posts={cache?.posts ?? []}
      loading={loading}
      syncing={syncing}
      onSync={refresh}
      onLink={link}
      onManual={() => setManualOpen(true)}
    />
  );
}

// ---- STATE A — link screen --------------------------------------------------

function LinkScreen({
  posts,
  loading,
  syncing,
  onSync,
  onLink,
  onManual,
}: {
  posts: IgPost[];
  loading: boolean;
  syncing: boolean;
  onSync: () => void;
  onLink: (id: string) => void;
  onManual: () => void;
}) {
  const [paste, setPaste] = useState("");
  const reels = posts.filter((p) => p.mediaType === "REEL" || p.mediaType === "VIDEO");
  const list = reels.length > 0 ? reels : posts;

  return (
    <Card elevated className="space-y-7 p-6">
      <div className="text-center">
        <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-[#3b82f6]/10 text-[#60a5fa] ring-1 ring-inset ring-[#3b82f6]/25">
          <Link2 className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <h2 className="text-lg font-bold tracking-tight text-white">
          Link this reel to Instagram
        </h2>
        <p className="mx-auto mt-1 max-w-sm text-sm text-zinc-500">
          Bind this item to its posted reel so live metrics flow back here and get
          graded automatically.
        </p>
      </div>

      {/* Option 1 — pick from recent reels */}
      <div>
        <div className="mb-2.5 flex items-center justify-between">
          <Label className="mb-0">Pick from recent reels</Label>
          <button
            onClick={onSync}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-zinc-400 outline-none transition-colors hover:bg-white/[0.06] hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
            ) : (
              <RotateCw className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            Sync
          </button>
        </div>

        {loading ? (
          <div className="grid place-items-center gap-2 rounded-xl border border-dashed border-white/[0.08] py-10 text-center">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-600" strokeWidth={1.75} />
          </div>
        ) : list.length === 0 ? (
          <div className="grid place-items-center gap-3 rounded-xl border border-dashed border-white/[0.08] py-10 text-center">
            <Search className="h-6 w-6 text-zinc-700" strokeWidth={1.5} />
            <p className="text-sm text-zinc-500">No reels in the Instagram cache yet.</p>
            <Button variant="outline" onClick={onSync} disabled={syncing}>
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
              ) : (
                <RotateCw className="h-4 w-4" strokeWidth={1.75} />
              )}
              Sync Instagram
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {list.map((p) => (
              <button
                key={p.id}
                onClick={() => onLink(p.id)}
                className="group/card flex flex-col overflow-hidden rounded-xl border border-white/[0.06] bg-base text-left outline-none transition-[transform,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-0.5 hover:border-[#3b82f6]/40 hover:shadow-[0_0_0_1px_rgba(59,130,246,0.18),0_10px_30px_-12px_rgba(59,130,246,0.35)] focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40"
              >
                <div className="relative aspect-[4/5] w-full overflow-hidden bg-surface2">
                  {p.thumbnailUrl || p.mediaUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={(p.thumbnailUrl || p.mediaUrl) as string}
                      alt=""
                      className="h-full w-full object-cover transition-transform duration-300 group-hover/card:scale-[1.03]"
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-zinc-700">
                      <Film className="h-6 w-6" strokeWidth={1.5} />
                    </div>
                  )}
                </div>
                <div className="p-2.5">
                  <p className="line-clamp-2 text-xs leading-snug text-zinc-200">
                    {p.caption ? p.caption.slice(0, 60) : (
                      <span className="text-zinc-600">No caption</span>
                    )}
                  </p>
                  <p className="mt-1 font-mono text-[10px] text-zinc-500">
                    {fmtDate(p.timestamp)} · {fmtViews(p.plays)} views
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Option 2 — paste URL / media ID */}
      <div>
        <Label>Or paste URL / media ID</Label>
        <div className="flex items-center gap-2">
          <Input
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            placeholder="instagram.com/reel/XXX or media ID"
            className="flex-1"
          />
          <Button
            variant="subtle"
            onClick={() => {
              const id = resolvePasted(paste, posts);
              if (id) onLink(id);
            }}
            disabled={!paste.trim()}
          >
            <Link2 className="h-4 w-4" strokeWidth={1.75} /> Connect
          </Button>
        </div>
      </div>

      <div className="border-t border-white/[0.06] pt-4 text-center">
        <button
          onClick={onManual}
          className="text-xs text-zinc-500 underline-offset-4 outline-none transition-colors hover:text-zinc-300 hover:underline focus-visible:text-zinc-300"
        >
          Fill manually instead
        </button>
      </div>
    </Card>
  );
}

function fmtViews(n: number | null | undefined): string {
  if (n == null) return "—";
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ---- STATE B — linked metrics panel -----------------------------------------

function LinkedPanel({
  video,
  update,
  post,
  syncing,
  onRefresh,
  extrasOpen,
  setExtrasOpen,
}: {
  video: Video;
  update: TabProps["update"];
  post: IgPost | null;
  syncing: boolean;
  onRefresh: () => void;
  extrasOpen: boolean;
  setExtrasOpen: (v: boolean) => void;
}) {
  const r = video.results;
  const setR = (patch: Partial<Results>) => update({ results: { ...r, ...patch } });
  const [genLoading, setGenLoading] = useState(false);
  const [pulled, setPulled] = useState(false);

  const rows = useMemo(() => computeMetrics(post, r), [post, r]);
  const auto = useMemo(() => overallVerdict(rows), [rows]);
  const selectedVerdict = (r.verdict || auto) as OverallVerdict;
  const counts = useMemo(() => {
    let win = 0, ok = 0, flop = 0;
    for (const m of rows) {
      if (m.informational || m.verdict == null) continue;
      if (m.verdict === "WIN") win++;
      else if (m.verdict === "OK") ok++;
      else flop++;
    }
    return { win, ok, flop };
  }, [rows]);

  function unlink() {
    if (window.confirm("Unlink this Instagram reel? Pulled metrics stay in the fields.")) {
      update({ instagramMediaId: null });
    }
  }

  async function generateLesson() {
    setGenLoading(true);
    try {
      const metrics = rows
        .filter((m) => !m.informational && m.verdict != null)
        .map((m) => ({ name: m.label, value: m.display, verdict: m.verdict as string }));
      const lesson = await apiGenerateLesson(metrics);
      if (lesson) setR({ lesson });
    } catch {
      /* leave field untouched */
    } finally {
      setGenLoading(false);
    }
  }

  function pullIntoResults() {
    const igViews = post?.plays ?? r.viewsIG;
    update({
      results: {
        ...r,
        viewsIG: igViews ?? r.viewsIG,
        likes: post?.likeCount ?? r.likes,
        comments: post?.commentsCount ?? r.comments,
        saves: post?.saved ?? r.saves,
        topSource: r.topSource || (post ? "Instagram" : r.topSource),
        verdict: r.verdict || auto,
      },
      status: "ANALYZED",
    });
    setPulled(true);
    setTimeout(() => setPulled(false), 2500);
  }

  return (
    <div className="space-y-4">
      {/* 1 — linked reel header */}
      <Card className="flex items-center gap-3 p-4">
        <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-base">
          {post && (post.thumbnailUrl || post.mediaUrl) ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={(post.thumbnailUrl || post.mediaUrl) as string}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="grid h-full w-full place-items-center text-zinc-700">
              <Film className="h-6 w-6" strokeWidth={1.5} />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-sm text-zinc-200">
            {post?.caption || (
              <span className="text-zinc-500">
                Media {video.instagramMediaId} — not in cache, hit Refresh
              </span>
            )}
          </p>
          <div className="mt-1 flex items-center gap-3 text-[11px] text-zinc-500">
            {post && <span>{fmtDate(post.timestamp)}</span>}
            {post?.permalink && (
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[#60a5fa] outline-none transition-colors hover:text-[#93c5fd] focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40"
              >
                Open on Instagram <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
              </a>
            )}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1.5">
          <button
            onClick={onRefresh}
            disabled={syncing}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-zinc-400 outline-none transition-colors hover:bg-white/[0.06] hover:text-zinc-100 focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 disabled:opacity-50"
          >
            {syncing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
            ) : (
              <RotateCw className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            Refresh stats
          </button>
          <button
            onClick={unlink}
            className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] text-zinc-500 outline-none transition-colors hover:bg-rose-500/10 hover:text-rose-300 focus-visible:ring-2 focus-visible:ring-rose-500/40"
          >
            <Unlink className="h-3.5 w-3.5" strokeWidth={1.75} /> Unlink
          </button>
        </div>
      </Card>

      {/* 2 — stats panel with per-metric verdict */}
      {!post && (
        <div className="flex items-center justify-between rounded-lg border border-amber-500/20 bg-amber-500/[0.06] px-4 py-3 text-xs text-amber-200/80">
          No live data for this media ID yet — try Refresh, or add values manually below.
        </div>
      )}
      <Card elevated className="divide-y divide-white/[0.05] p-0">
        {rows.map((m) => (
          <MetricRowView key={m.key} row={m} />
        ))}
      </Card>

      {/* manual extras — fields the Graph API doesn't expose, feed the verdicts */}
      <div>
        <button
          onClick={() => setExtrasOpen(!extrasOpen)}
          className="inline-flex items-center gap-1.5 text-xs text-zinc-500 outline-none transition-colors hover:text-zinc-300 focus-visible:text-zinc-300"
        >
          <PencilLine className="h-3.5 w-3.5" strokeWidth={1.75} />
          {extrasOpen ? "Hide manual fields" : "Add missing data (FB views, top source, follows)"}
        </button>
        {extrasOpen && (
          <Card className="mt-2 grid gap-4 p-5 sm:grid-cols-3">
            <NumField label="Views FB" value={r.viewsFB} onChange={(v) => setR({ viewsFB: v })} />
            <Field label="Top source">
              <Input value={r.topSource} onChange={(e) => setR({ topSource: e.target.value })} placeholder="Reels tab / Explore / Stories" />
            </Field>
            <NumField label="Follows" value={r.follows} onChange={(v) => setR({ follows: v })} />
          </Card>
        )}
      </div>

      {/* 3 — overall verdict (auto, overridable) */}
      <Card className="space-y-3 p-5">
        <div className="flex items-center justify-between">
          <Label className="mb-0">Overall verdict</Label>
          <span className="font-mono text-[10px] text-zinc-600">
            {counts.win}W · {counts.ok}OK · {counts.flop}F · auto: {auto}
          </span>
        </div>
        <div className="flex gap-2">
          {(["WIN", "MEH", "FLOP"] as OverallVerdict[]).map((v) => {
            const active = selectedVerdict === v;
            return (
              <button
                key={v}
                onClick={() => setR({ verdict: r.verdict === v ? "" : v })}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold outline-none transition-[transform,box-shadow] duration-200 hover:-translate-y-px active:scale-95 focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40",
                  active ? "text-white" : "text-zinc-500 ring-1 ring-inset ring-white/[0.08] hover:text-zinc-300"
                )}
                style={
                  active
                    ? {
                        backgroundColor: `${OVERALL_STYLE[v]}26`,
                        boxShadow: `inset 0 0 0 1px ${OVERALL_STYLE[v]}66`,
                        color: OVERALL_STYLE[v],
                      }
                    : undefined
                }
              >
                {v}
                {v === auto && !r.verdict && (
                  <span className="font-mono text-[9px] uppercase opacity-70">auto</span>
                )}
              </button>
            );
          })}
        </div>
      </Card>

      {/* 4 — lesson learned */}
      <Card className="space-y-2 p-5">
        <div className="flex items-center justify-between">
          <Label className="mb-0">Lesson learned</Label>
          <Button size="sm" variant="subtle" onClick={generateLesson} disabled={genLoading}>
            {genLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
            ) : (
              <Sparkles className="h-3.5 w-3.5" strokeWidth={1.75} />
            )}
            Generate lesson
          </Button>
        </div>
        <Textarea
          value={r.lesson}
          onChange={(e) => setR({ lesson: e.target.value })}
          placeholder="What worked, what to change next time…"
        />
      </Card>

      {/* 5 — pull into results */}
      <div className="flex items-center justify-between rounded-lg bg-white/[0.03] px-4 py-3">
        <p className="text-xs text-zinc-500">
          Writes live values into Results and marks{" "}
          <span className="text-emerald-400">Analyzed</span>.
        </p>
        <Button variant="primary" onClick={pullIntoResults}>
          {pulled ? (
            <Check className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <Download className="h-4 w-4" strokeWidth={1.75} />
          )}
          {pulled ? "Pulled — set to Analyzed" : "Pull into Results"}
        </Button>
      </div>
    </div>
  );
}

function MetricRowView({ row }: { row: MetricRow }) {
  return (
    <div className="flex items-center gap-3 px-5 py-3.5">
      <div className="w-32 shrink-0">
        <div className="font-mono text-[10px] uppercase tracking-wider text-zinc-600">
          {row.label}
        </div>
        <div className="mt-0.5 text-lg font-bold tabular-nums text-zinc-100">
          {row.display}
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs leading-relaxed text-zinc-400">{row.explanation}</p>
      </div>
      <div className="shrink-0">
        {row.informational ? (
          <span className="rounded-full bg-white/[0.05] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-500">
            Info
          </span>
        ) : row.verdict == null ? (
          <span className="rounded-full bg-white/[0.04] px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-zinc-600">
            No data
          </span>
        ) : (
          <span
            className="rounded-full px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-wider"
            style={{
              backgroundColor: `${VERDICT_HEX[row.verdict]}22`,
              color: VERDICT_HEX[row.verdict],
              boxShadow: `inset 0 0 0 1px ${VERDICT_HEX[row.verdict]}55`,
            }}
          >
            {row.verdict}
          </span>
        )}
      </div>
    </div>
  );
}

// ---- Manual form (unchanged original RESULTS form) --------------------------

function ManualResultsForm({ video, update }: TabProps) {
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
