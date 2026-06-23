import { ContentItem, Pillar, Format, PostingWindow } from "./types";
import { createVideo, createIdeaItem, uid, now } from "./factories";

interface SeedSpec {
  title: string;
  pillar: Pillar;
  format: Format;
  postingWindow: PostingWindow;
  lengthTarget: string;
  hookLine1: string;
  hookLine2: string;
  firstTwoSeconds: string;
}

const SPECS: SeedSpec[] = [
  {
    title: "The one Claude Code flag nobody uses",
    pillar: "Claude Code",
    format: "Screen recording",
    postingWindow: "Evening (6-8pm)",
    lengthTarget: "30s",
    hookLine1: "You're using Claude Code wrong",
    hookLine2: "Here's the fix",
    firstTwoSeconds: "Hard cut to terminal mid-command, red error flashing.",
  },
  {
    title: "Build an agent that books your meetings",
    pillar: "Agents",
    format: "Tutorial",
    postingWindow: "Midday (11am-1pm)",
    lengthTarget: "45s",
    hookLine1: "This agent runs my whole calendar",
    hookLine2: "In 4 steps",
    firstTwoSeconds: "Phone buzzing with auto-booked invites stacking up.",
  },
  {
    title: "Opus 4.8 vs the rest — real test",
    pillar: "Comparisons",
    format: "Talking head",
    postingWindow: "Evening (6-8pm)",
    lengthTarget: "35s",
    hookLine1: "I gave 3 models the same brutal task",
    hookLine2: "One won",
    firstTwoSeconds: "Split screen, three outputs racing to fill.",
  },
  {
    title: "Set up MCP in 60 seconds",
    pillar: "Tutorials",
    format: "Screen recording",
    postingWindow: "Morning (7-9am)",
    lengthTarget: "60s",
    hookLine1: "Connect Claude to anything in 60s",
    hookLine2: "No code",
    firstTwoSeconds: "Countdown timer slaps onto screen, config opens.",
  },
  {
    title: "Fast mode just changed everything",
    pillar: "New Features",
    format: "B-roll voiceover",
    postingWindow: "Night (9-11pm)",
    lengthTarget: "25s",
    hookLine1: "Claude Code just got 2x faster",
    hookLine2: "Same brain",
    firstTwoSeconds: "Side-by-side latency bars, one finishing instantly.",
  },
  {
    title: "Subagents that review their own code",
    pillar: "Agents",
    format: "Tutorial",
    postingWindow: "Midday (11am-1pm)",
    lengthTarget: "50s",
    hookLine1: "My code reviews itself now",
    hookLine2: "Here's how",
    firstTwoSeconds: "PR comments auto-populating in real time.",
  },
  {
    title: "Stop writing prompts like it's 2023",
    pillar: "Tutorials",
    format: "Talking head",
    postingWindow: "Evening (6-8pm)",
    lengthTarget: "40s",
    hookLine1: "Your prompts are stuck in 2023",
    hookLine2: "Do this",
    firstTwoSeconds: "Old prompt crossed out in red, new one slides in.",
  },
];

export function seedVideos(): ContentItem[] {
  return SPECS.map((s, i) => {
    const v = createVideo({
      title: s.title,
      pillar: s.pillar,
      format: s.format,
      postingWindow: s.postingWindow,
      lengthTarget: s.lengthTarget,
      hookLine1: s.hookLine1,
      status: "TO_SHOOT",
    });
    const created = new Date(
      Date.now() - (SPECS.length - i) * 3600_000
    ).toISOString();
    v.createdAt = created;
    v.updatedAt = created;
    v.statusHistory = [{ status: "TO_SHOOT", timestamp: created }];
    v.hook.line2 = s.hookLine2;
    v.hook.firstTwoSeconds = s.firstTwoSeconds;
    v.hook.scorecard = {
      recognition: i % 2 === 0,
      openLoop: true,
      firstTwoS: i % 3 !== 0,
      specificity: i % 2 === 1,
      identity: i % 4 === 0,
    };
    return v;
  });
}

export function seedIdeas(): ContentItem[] {
  const mk = (
    title: string,
    hookLine1: string,
    pillar: Pillar,
    recognitionScore: number,
    sourceUrl: string
  ): ContentItem => {
    const idea = createIdeaItem({ title, pillar, hookLine1, sourceUrl, recognitionScore });
    idea.demandSignal = { text: "", source: sourceUrl, date: "" };
    return idea;
  };

  return [
    mk(
      "Hooks ranked by retention",
      "I tested 50 hooks so you don't have to",
      "Tutorials",
      5,
      "https://example.com/hooks"
    ),
    mk(
      "Claude Code custom slash commands",
      "Build your own /command in 2 min",
      "Claude Code",
      4,
      ""
    ),
    mk(
      "Agent vs workflow — when to use which",
      "Stop building agents you don't need",
      "Agents",
      4,
      ""
    ),
    mk(
      "The cheapest model that still ships",
      "Haiku did this and I'm shocked",
      "Comparisons",
      3,
      ""
    ),
    mk(
      "Memory feature deep dive",
      "Claude finally remembers you",
      "New Features",
      5,
      ""
    ),
  ];
}
