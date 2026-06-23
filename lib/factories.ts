import {
  ContentItem,
  Pillar,
  Status,
  Format,
  PostingWindow,
  ChecklistItem,
  Beat,
  Caption,
} from "./types";

export function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now()
    .toString(36)
    .slice(-4)}`;
}

export function now(): string {
  return new Date().toISOString();
}

export function defaultChecklist(): ChecklistItem[] {
  const mk = (label: string, group: string): ChecklistItem => ({
    id: uid("chk"),
    label,
    group,
    checked: false,
  });
  return [
    mk("Charge phone / camera to 100%", "Setup — Gear"),
    mk("Clear storage (need 10GB+)", "Setup — Gear"),
    mk("Mount tripod at eye level", "Setup — Gear"),
    mk("Clip on lav mic, test audio", "Setup — Gear"),
    mk("Set lighting — key light 45°", "Setup — Lighting"),
    mk("Close blinds, kill mixed color temp", "Setup — Lighting"),
    mk("Frame vertical 9:16, headroom check", "Setup — Framing"),
    mk("Read hook out loud 3x", "Performance"),
    mk("Record 3 takes of first 2 seconds", "Performance"),
    mk("Record full A-roll", "Performance"),
    mk("Capture B-roll / screen demo", "Performance"),
    mk("Back up footage to drive", "Wrap"),
  ];
}

export function defaultCaptions(): Caption[] {
  return [
    { variant: "A — Direct", text: "", hashtags: "", recommended: true },
    { variant: "B — Story", text: "", hashtags: "", recommended: false },
    { variant: "C — Bold claim", text: "", hashtags: "", recommended: false },
  ];
}

export function defaultScript(): Beat[] {
  const mk = (timestamp: string, label: Beat["label"]): Beat => ({
    id: uid("beat"),
    timestamp,
    label,
    content: "",
    retentionNote: "",
  });
  return [
    mk("0:00", "HOOK"),
    mk("0:03", "RE-HOOK"),
    mk("0:06", "DEMO"),
    mk("0:20", "RESULT"),
    mk("0:28", "CTA"),
  ];
}

export interface NewVideoInput {
  title?: string;
  pillar?: Pillar;
  format?: Format;
  lengthTarget?: string;
  postingWindow?: PostingWindow;
  sourceUrl?: string;
  status?: Status;
  hookLine1?: string;
}

// Creates a production-stage ContentItem (a reel on the board)
export function createVideo(input: NewVideoInput = {}): ContentItem {
  const ts = now();
  const status: Status = input.status ?? "TO_SHOOT";
  return {
    id: uid("vid"),
    stage: "production",
    status,
    title: input.title ?? "Untitled Reel",
    pillar: input.pillar ?? "Claude Code",
    hookType: "",
    format: input.format ?? "Screen recording",
    lengthTarget: input.lengthTarget ?? "30s",
    postingWindow: input.postingWindow ?? "Evening (6-8pm)",
    sourceUrl: input.sourceUrl ?? "",
    demandSignal: { text: "", source: input.sourceUrl ?? "", date: "" },
    recognitionScore: 3,
    hook: {
      line1: input.hookLine1 ?? "",
      line2: "",
      firstTwoSeconds: "",
      scorecard: {
        recognition: false,
        openLoop: false,
        firstTwoS: false,
        specificity: false,
        identity: false,
      },
    },
    script: defaultScript(),
    captions: defaultCaptions(),
    engagement: {
      triggerType: "",
      triggerText: "",
      firstComment: "",
      endCard: "",
    },
    checklist: defaultChecklist(),
    results: {
      viewsIG: null,
      viewsFB: null,
      skipRate: null,
      topSource: "",
      likes: null,
      comments: null,
      saves: null,
      follows: null,
      verdict: "",
      lesson: "",
    },
    seriesName: "",
    partNumber: null,
    statusHistory: [{ status, timestamp: ts }],
    createdAt: ts,
    updatedAt: ts,
  };
}

export interface NewIdeaInput {
  title?: string;
  pillar?: Pillar;
  hookLine1?: string;
  sourceUrl?: string;
  recognitionScore?: number;
}

// Creates an idea-stage ContentItem
export function createIdeaItem(input: NewIdeaInput = {}): ContentItem {
  const ts = now();
  return {
    id: uid("idea"),
    stage: "idea",
    status: "TO_SHOOT",
    title: input.title ?? "",
    pillar: input.pillar ?? "Claude Code",
    hookType: "",
    format: "Talking head",
    lengthTarget: "",
    postingWindow: "",
    sourceUrl: input.sourceUrl ?? "",
    demandSignal: { text: "", source: input.sourceUrl ?? "", date: "" },
    recognitionScore: input.recognitionScore ?? 3,
    hook: {
      line1: input.hookLine1 ?? "",
      line2: "",
      firstTwoSeconds: "",
      scorecard: {
        recognition: false,
        openLoop: false,
        firstTwoS: false,
        specificity: false,
        identity: false,
      },
    },
    script: [],
    captions: [],
    engagement: {
      triggerType: "",
      triggerText: "",
      firstComment: "",
      endCard: "",
    },
    checklist: [],
    results: {
      viewsIG: null,
      viewsFB: null,
      skipRate: null,
      topSource: "",
      likes: null,
      comments: null,
      saves: null,
      follows: null,
      verdict: "",
      lesson: "",
    },
    seriesName: "",
    partNumber: null,
    statusHistory: [{ status: "TO_SHOOT", timestamp: ts }],
    createdAt: ts,
    updatedAt: ts,
  };
}
