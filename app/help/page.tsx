import {
  Lightbulb,
  LayoutDashboard,
  CalendarDays,
  BarChart3,
  Home,
  Sparkles,
  ArrowRight,
  Workflow,
  Link2,
  RefreshCw,
  FileUp,
  Wand2,
  Target,
  CheckCircle2,
  Trophy,
} from "lucide-react";
import {
  PILLARS,
  PILLAR_COLORS,
  STATUSES,
  STATUS_LABELS,
  STATUS_COLORS,
  HOOK_TYPES,
  HOOK_TYPE_LABELS,
} from "@/lib/types";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/controls";
import { cn } from "@/lib/utils";

export const metadata = { title: "Help — AutoPilot AI" };

// ---- Small building blocks --------------------------------------------------

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 font-mono text-[11px] font-bold uppercase tracking-[0.18em] text-[#3b82f6]">
      {children}
    </p>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[19px] font-bold tracking-[-0.02em] text-white">{children}</h2>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex gap-4">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] font-mono text-[12px] font-bold text-white shadow-[0_0_18px_rgba(59,130,246,0.35)]">
        {n}
      </span>
      <div className="pt-0.5">
        <p className="text-[14px] font-semibold text-zinc-100">{title}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">{children}</p>
      </div>
    </li>
  );
}

function PageGuide({
  icon: Icon,
  name,
  route,
  children,
}: {
  icon: React.ElementType;
  name: string;
  route: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="hover-lift flex flex-col gap-2 p-5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 place-items-center rounded-[9px] bg-[#3b82f6]/12 ring-1 ring-inset ring-[#3b82f6]/25">
          <Icon className="h-[18px] w-[18px] text-[#60a5fa]" strokeWidth={1.75} />
        </span>
        <div>
          <p className="text-[14px] font-semibold text-zinc-100">{name}</p>
          <p className="font-mono text-[11px] text-zinc-500">{route}</p>
        </div>
      </div>
      <p className="text-[13px] leading-relaxed text-zinc-400">{children}</p>
    </Card>
  );
}

// ---- Page -------------------------------------------------------------------

export default function HelpPage() {
  return (
    <>
      <PageHeader
        title="Help & Guide"
        subtitle="How AutoPilot AI works — from raw idea to analyzed reel."
      />

      <div className="mx-auto max-w-4xl space-y-14 px-7 py-8">
        {/* Overview */}
        <section>
          <Eyebrow>What this is</Eyebrow>
          <SectionTitle>One pipeline for your Instagram Reels</SectionTitle>
          <p className="mt-3 text-[14px] leading-relaxed text-zinc-400">
            AutoPilot AI is a CRM for running a Reels content operation end to end.
            Every idea and every published reel is the <strong className="text-zinc-200">same object</strong> at
            a different point in its life — it starts as an <em className="text-[#60a5fa] not-italic">idea</em>,
            gets promoted into <em className="text-[#60a5fa] not-italic">production</em>, moves across a
            shoot/edit/post board, and finally gets <em className="text-[#60a5fa] not-italic">analyzed</em> against
            its real Instagram metrics. All data lives in Supabase and syncs live across tabs and devices.
          </p>
        </section>

        {/* Lifecycle */}
        <section>
          <Eyebrow>The lifecycle</Eyebrow>
          <SectionTitle>From idea to lesson learned</SectionTitle>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {["Idea", "Promote", "Shoot", "Edit", "Post", "Analyze"].map((s, i, arr) => (
              <span key={s} className="flex items-center gap-2">
                <span className="rounded-full bg-white/[0.04] px-3 py-1.5 text-[13px] font-medium text-zinc-200 ring-1 ring-inset ring-white/[0.08]">
                  {s}
                </span>
                {i < arr.length - 1 && (
                  <ArrowRight className="h-4 w-4 text-zinc-600" strokeWidth={2} />
                )}
              </span>
            ))}
          </div>
          <ol className="mt-7 space-y-5">
            <Step n={1} title="Capture an idea">
              Add it on the <strong className="text-zinc-200">Ideas</strong> bank — manually, by importing
              a PDF/TXT, or by letting the AI autofill the fields. Flesh out the hook, demand signal, and
              recognition score until the readiness bar turns green.
            </Step>
            <Step n={2} title="Promote to production">
              When an idea is ready to shoot, promote it. The same item flips its stage to
              {" "}<strong className="text-zinc-200">production</strong> and shows up on the Board and Calendar.
            </Step>
            <Step n={3} title="Move it across the board">
              Drag the card through the statuses as you work: To&nbsp;Shoot → Shot → Edited → Posted.
            </Step>
            <Step n={4} title="Link the posted reel">
              Once it&apos;s live, link the card to the real Instagram reel. Live metrics flow back into the editor.
            </Step>
            <Step n={5} title="Analyze & learn">
              Pull the live stats into Results, read the per-metric WIN/OK/FLOP verdict, and generate an AI
              lesson. The item moves to <strong className="text-zinc-200">Analyzed</strong> and lands on Performance.
            </Step>
          </ol>
        </section>

        {/* Statuses */}
        <section>
          <Eyebrow>Board statuses</Eyebrow>
          <SectionTitle>What each column means</SectionTitle>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {STATUSES.map((s) => {
              const c = STATUS_COLORS[s];
              const desc: Record<typeof s, string> = {
                TO_SHOOT: "Promoted and scheduled — not filmed yet.",
                SHOT: "Footage captured, waiting to be edited.",
                EDITED: "Cut and ready, queued to post.",
                POSTED: "Live on Instagram — link the reel to track it.",
                ANALYZED: "Metrics pulled, verdict set, lesson recorded.",
              } as const;
              return (
                <div
                  key={s}
                  className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-surface p-4"
                >
                  <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", c.dot)} />
                  <div>
                    <p className={cn("text-[13px] font-semibold", c.text)}>
                      {STATUS_LABELS[s]}
                    </p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500">
                      {desc[s]}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Pages */}
        <section>
          <Eyebrow>The pages</Eyebrow>
          <SectionTitle>Where everything lives</SectionTitle>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <PageGuide icon={Home} name="Overview" route="/">
              The home dashboard. Aggregates the whole pipeline — counts, Instagram stats (avg watch time,
              win rate), and quick links into every section.
            </PageGuide>
            <PageGuide icon={LayoutDashboard} name="Board" route="/board">
              The Kanban pipeline. Drag cards between statuses; a chain badge shows when a card is linked to
              its reel, and a &quot;Link reel&quot; deep-link appears on posted-but-unlinked cards.
            </PageGuide>
            <PageGuide icon={CalendarDays} name="Calendar" route="/calendar">
              Weekly grid. Schedule production items into day slots with a posting window, exact time, and
              duration. One row per ISO week.
            </PageGuide>
            <PageGuide icon={Lightbulb} name="Ideas" route="/ideas">
              The idea bank. Every item starts here with a readiness score and demand-signal freshness.
              Import, autofill, and generate scripts before promoting.
            </PageGuide>
            <PageGuide icon={BarChart3} name="Performance" route="/performance">
              Raw Instagram analytics straight from the Graph API — account stats, every fetched post, and
              charts. No manual entry.
            </PageGuide>
            <PageGuide icon={Sparkles} name="AI Agent" route="sidebar panel">
              The assistant panel (toggle in the sidebar). Ask it about your pipeline and content.
            </PageGuide>
          </div>
        </section>

        {/* Idea readiness */}
        <section>
          <Eyebrow>Scoring an idea</Eyebrow>
          <SectionTitle>How readiness is calculated</SectionTitle>
          <p className="mt-3 text-[14px] leading-relaxed text-zinc-400">
            Each idea earns up to 100 points. <span className="text-emerald-400">80+</span> = Ready to shoot,
            {" "}<span className="text-amber-400">40–79</span> = Developing,
            {" "}<span className="text-zinc-400">under 40</span> = Raw.
          </p>
          <ul className="mt-5 space-y-2.5">
            {[
              ["Title, pillar & hook type set", "20 pts"],
              ["A fresh demand signal (dated within 30 days)", "20 pts"],
              ["Hook line 1, line 2 & first-two-seconds written", "20 pts"],
              ["At least 4 of 5 hook scorecard checks", "20 pts"],
              ["Recognition score of 3 or higher", "20 pts"],
            ].map(([label, pts]) => (
              <li
                key={label}
                className="flex items-center justify-between gap-4 rounded-lg border border-white/[0.06] bg-surface px-4 py-3"
              >
                <span className="flex items-center gap-2.5 text-[13px] text-zinc-300">
                  <Target className="h-4 w-4 text-[#60a5fa]" strokeWidth={1.75} />
                  {label}
                </span>
                <span className="font-mono text-[12px] font-bold text-emerald-400">{pts}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-[13px] leading-relaxed text-zinc-500">
            <strong className="text-zinc-300">Demand freshness</strong> colors the signal too:
            {" "}<span className="text-emerald-400">green</span> within 30 days,
            {" "}<span className="text-amber-400">yellow</span> within 90,
            {" "}<span className="text-rose-400">red</span> older — a reminder that trends decay.
          </p>
        </section>

        {/* AI + Reel linking features */}
        <section>
          <Eyebrow>The smart parts</Eyebrow>
          <SectionTitle>AI & live-metric features</SectionTitle>
          <div className="mt-5 space-y-3">
            {[
              {
                icon: FileUp,
                title: "Autofill from a document",
                body: "Drop a PDF or TXT into the idea editor — Claude reads it and fills only the fields you left empty, flagged with a transient AI tag.",
              },
              {
                icon: Wand2,
                title: "Generate a script",
                body: "Turn a developed idea into a beat-by-beat script (hook, re-hook, demo, result, CTA) with AI.",
              },
              {
                icon: Link2,
                title: "Link a reel",
                body: "Bind an item to its posted Instagram reel by picking from the synced grid or pasting a URL. Live read-only metrics then show in the editor.",
              },
              {
                icon: Trophy,
                title: "Verdict & lesson",
                body: "The Results tab grades each metric WIN/OK/FLOP against benchmarks, sets an overridable overall verdict, and can generate an AI lesson — then marks the item Analyzed.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <Card key={title} className="flex items-start gap-3.5 p-4">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[9px] bg-[#06b6d4]/12 ring-1 ring-inset ring-[#06b6d4]/25">
                  <Icon className="h-[18px] w-[18px] text-[#22d3ee]" strokeWidth={1.75} />
                </span>
                <div>
                  <p className="text-[14px] font-semibold text-zinc-100">{title}</p>
                  <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">{body}</p>
                </div>
              </Card>
            ))}
          </div>
        </section>

        {/* Reference: pillars + hooks */}
        <section>
          <Eyebrow>Reference</Eyebrow>
          <SectionTitle>Pillars & hook types</SectionTitle>
          <div className="mt-5 grid gap-6 sm:grid-cols-2">
            <div>
              <p className="mb-3 text-[13px] font-semibold text-zinc-300">Content pillars</p>
              <div className="flex flex-wrap gap-2">
                {PILLARS.map((p) => {
                  const c = PILLAR_COLORS[p];
                  return (
                    <span
                      key={p}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium ring-1 ring-inset",
                        c.bg,
                        c.text,
                        c.ring
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
                      {p}
                    </span>
                  );
                })}
              </div>
            </div>
            <div>
              <p className="mb-3 text-[13px] font-semibold text-zinc-300">Hook types</p>
              <ul className="space-y-1.5">
                {HOOK_TYPES.map((h) => (
                  <li key={h} className="flex items-center gap-2.5 text-[13px]">
                    <span className="font-mono text-[11px] font-bold text-[#60a5fa]">{h}</span>
                    <span className="text-zinc-400">{HOOK_TYPE_LABELS[h]}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* Data & sync */}
        <section>
          <Eyebrow>Under the hood</Eyebrow>
          <SectionTitle>Data & syncing</SectionTitle>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Card className="flex items-start gap-3.5 p-5">
              <RefreshCw className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#60a5fa]" strokeWidth={1.75} />
              <div>
                <p className="text-[14px] font-semibold text-zinc-100">Sync button</p>
                <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">
                  Pulls fresh Instagram data from the Graph API and reconciles your CRM into Supabase —
                  account stats, every post, and a rebuilt performance log.
                </p>
              </div>
            </Card>
            <Card className="flex items-start gap-3.5 p-5">
              <Workflow className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[#60a5fa]" strokeWidth={1.75} />
              <div>
                <p className="text-[14px] font-semibold text-zinc-100">Live across tabs</p>
                <p className="mt-1 text-[13px] leading-relaxed text-zinc-400">
                  Board, Calendar, and Ideas re-fetch every few seconds and on focus. The green
                  &quot;Live&quot; dot means synced; an amber bar means reconnecting. Your edits never get
                  clobbered mid-action.
                </p>
              </div>
            </Card>
          </div>
          <p className="mt-5 flex items-center gap-2 text-[13px] text-zinc-500">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" strokeWidth={1.75} />
            Everything autosaves. There is no manual &quot;save&quot; — every edit writes straight to Supabase.
          </p>
        </section>
      </div>
    </>
  );
}
