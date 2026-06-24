import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { saveContentItem } from "@/lib/data";
import {
  ContentItem,
  PILLARS,
  HOOK_TYPES,
  FORMATS,
  BEAT_LABELS,
  TRIGGER_TYPES,
  Pillar,
  HookType,
  Format,
  PostingWindow,
  TriggerType,
  BeatLabel,
  Beat,
  Caption,
} from "@/lib/types";
import { createIdeaItem, uid } from "@/lib/factories";

export const dynamic = "force-dynamic";

const SYSTEM = `You extract short-form video content ideas. The creator makes videos about Claude Code, AI agents, coding tutorials, AI feature comparisons, and new AI releases.`;

// Bulk extractor — pulls EVERY distinct idea from the document AND fills every
// section per idea (same field set as the in-editor autofill), so a 15-idea
// upload lands fully complete. Output is a JSON array of full idea objects.
const EXTRACTION_PROMPT = `Extract every distinct content idea from this document.
Output ONLY a valid JSON array — no markdown, no preamble, no explanation.
For each idea, extract every field you can find. Use null for anything not present.

Each array element:
{
  title: string,
  pillar: one of [Claude Code, Agents, Comparisons, Tutorials, New Features],
  hookType: one of [H1, H2, H3, H4, H5, H6],
  format: one of [Talking head, Screen recording, B-roll, Tutorial, Skit],
  lengthTarget: string,
  postingWindow: one of [Evening, Late],
  demandSignal: { text: string, source: string, date: string },
  recognitionScore: number 1-5,
  hook: {
    line1: string (max 12 words),
    line2: string (max 6 words),
    firstTwoSeconds: string,
    scorecard: { recognition: boolean, openLoop: boolean, firstTwoS: boolean, specificity: boolean, identity: boolean }
  },
  script: [ { timestamp: string, label: one of [HOOK, RE-HOOK, DEMO, RESULT, CTA], content: string, retentionNote: string } ],
  captions: [ { text: string, hashtags: string, recommended: boolean } ],
  engagement: { triggerType: string, triggerText: string, firstComment: string, endCard: string }
}`;

const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

// Map one extracted object onto a full idea-stage ContentItem.
function toContentItem(e: Record<string, unknown>): ContentItem {
  const item = createIdeaItem({
    title: str(e.title).slice(0, 120),
  });

  const pillar = str(e.pillar) as Pillar;
  if (PILLARS.includes(pillar)) item.pillar = pillar;

  const hookType = str(e.hookType) as HookType;
  if (HOOK_TYPES.includes(hookType)) item.hookType = hookType;

  let fmt = str(e.format);
  if (fmt === "B-roll") fmt = "B-roll voiceover";
  if (FORMATS.includes(fmt as Format)) item.format = fmt as Format;

  if (str(e.lengthTarget)) item.lengthTarget = str(e.lengthTarget);

  const pwMap: Record<string, PostingWindow> = {
    Evening: "Evening (6-8pm)",
    Late: "Night (9-11pm)",
  };
  if (pwMap[str(e.postingWindow)]) item.postingWindow = pwMap[str(e.postingWindow)];

  const rec = Number(e.recognitionScore);
  if (rec >= 1 && rec <= 5) item.recognitionScore = Math.round(rec);

  // Demand signal
  const ds = e.demandSignal as Record<string, unknown> | null;
  if (ds) {
    if (str(ds.text)) item.demandSignal.text = str(ds.text);
    if (str(ds.source)) {
      item.demandSignal.source = str(ds.source);
      item.sourceUrl = str(ds.source);
    }
    if (str(ds.date)) item.demandSignal.date = str(ds.date);
  }

  // Hook
  const hk = e.hook as Record<string, unknown> | null;
  if (hk) {
    if (str(hk.line1)) item.hook.line1 = str(hk.line1);
    if (str(hk.line2)) item.hook.line2 = str(hk.line2);
    if (str(hk.firstTwoSeconds)) item.hook.firstTwoSeconds = str(hk.firstTwoSeconds);
    const sc = hk.scorecard as Record<string, unknown> | null;
    if (sc) {
      (["recognition", "openLoop", "firstTwoS", "specificity", "identity"] as const).forEach(
        (k) => {
          if (typeof sc[k] === "boolean") item.hook.scorecard[k] = sc[k] as boolean;
        }
      );
    }
  }

  // Script
  const rawBeats = Array.isArray(e.script) ? (e.script as Record<string, unknown>[]) : [];
  const beats: Beat[] = rawBeats
    .filter((b) => b && (str(b.content) || str(b.timestamp)))
    .map((b) => ({
      id: uid("beat"),
      timestamp: str(b.timestamp) || "0:00",
      label: (BEAT_LABELS.includes(str(b.label) as BeatLabel) ? str(b.label) : "DEMO") as BeatLabel,
      content: str(b.content),
      retentionNote: str(b.retentionNote),
    }));
  if (beats.length) item.script = beats;

  // Captions
  const rawCaps = Array.isArray(e.captions) ? (e.captions as Record<string, unknown>[]) : [];
  const caps: Caption[] = rawCaps
    .filter((c) => c && str(c.text))
    .map((c, i) => ({
      variant: `Variant ${i + 1}`,
      text: str(c.text),
      hashtags: str(c.hashtags),
      recommended: c.recommended === true,
    }));
  if (caps.length && !caps.some((c) => c.recommended)) caps[0].recommended = true;
  if (caps.length) item.captions = caps;

  // Engagement
  const eng = e.engagement as Record<string, unknown> | null;
  if (eng) {
    const tt = str(eng.triggerType) as TriggerType;
    if (TRIGGER_TYPES.includes(tt)) item.engagement.triggerType = tt;
    if (str(eng.triggerText)) item.engagement.triggerText = str(eng.triggerText);
    if (str(eng.firstComment)) item.engagement.firstComment = str(eng.firstComment);
    if (str(eng.endCard)) item.engagement.endCard = str(eng.endCard);
  }

  return item;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "Invalid form data" }, { status: 400 });
  }

  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "No file provided" }, { status: 400 });
  }

  const MAX_BYTES = 10 * 1024 * 1024; // 10 MB
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: "File too large (max 10 MB)" },
      { status: 413 }
    );
  }

  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);
  const isPdf =
    file.type === "application/pdf" ||
    file.name.toLowerCase().endsWith(".pdf");

  const client = new Anthropic({ apiKey });

  let responseText: string;
  try {
    if (isPdf) {
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: {
                  type: "base64",
                  media_type: "application/pdf",
                  data: buffer.toString("base64"),
                },
              },
              { type: "text", text: EXTRACTION_PROMPT },
            ],
          },
        ],
      });
      const block = msg.content[0];
      responseText = block.type === "text" ? block.text : "";
    } else {
      const text = buffer.toString("utf8");
      const msg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 16000,
        system: SYSTEM,
        messages: [
          {
            role: "user",
            content: `${EXTRACTION_PROMPT}\n\n---\n\n${text}`,
          },
        ],
      });
      const block = msg.content[0];
      responseText = block.type === "text" ? block.text : "";
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `AI extraction failed: ${msg}` },
      { status: 500 }
    );
  }

  let extracted: Record<string, unknown>[];
  try {
    const raw = responseText.match(/\[[\s\S]*\]/)?.[0] ?? responseText;
    extracted = JSON.parse(raw) as Record<string, unknown>[];
    if (!Array.isArray(extracted)) throw new Error("not an array");
  } catch {
    return NextResponse.json(
      { error: "Could not parse AI response", raw: responseText.slice(0, 500) },
      { status: 500 }
    );
  }

  const newIdeas: ContentItem[] = extracted
    .filter((e) => e && str(e.title))
    .map(toContentItem);

  for (const idea of newIdeas) {
    await saveContentItem(idea);
  }

  return NextResponse.json({ imported: newIdeas.length, ideas: newIdeas });
}
