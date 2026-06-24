import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

// One-click "Complete idea with AI". Two sequential Sonnet calls:
//   1. write the script from the hook
//   2. write every other section from the hook + the script just created
// Returns the full nested field object (same shape as /api/ideas/autofill) so
// the editor can merge it with its existing never-overwrite logic.

interface CompleteContext {
  title?: string;
  pillar?: string;
  format?: string;
  lengthTarget?: string;
  hookLine1?: string;
  hookLine2?: string;
  firstTwoSeconds?: string;
  demandSignal?: string;
}

const SCRIPT_PROMPT = `You are a short-form video script writer for an Instagram Reels
creator in the AI/tech niche. Write a complete beat-by-beat script
for a 45-60 second reel. Return a raw JSON array only, no markdown.

Each beat object:
{ timestamp: string, label: string, content: string, retentionNote: string }

Labels must follow this sequence: HOOK → RE-HOOK → DEMO → RESULT → CTA
Timestamps: 0-2s, 2-5s, 5-40s (split into sub-beats every 4s), 40-55s, 55-60s

Video context:
Title: {title}
Hook line 1: {hookLine1}
Hook line 2: {hookLine2}
First two seconds plan: {firstTwoSeconds}
Pillar: {pillar}
Format: {format}
Length: {lengthTarget}

Return the array only.`;

const REST_PROMPT = `You are completing an Instagram Reels content idea for an AI/tech creator.
Using the hook and the script below, write every remaining section.
Return a single raw JSON object only — no markdown, no preamble.

{
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
  captions: [ { text: string, hashtags: string, recommended: boolean } ],
  engagement: { triggerType: string, triggerText: string, firstComment: string, endCard: string }
}

Title: {title}
Hook line 1: {hookLine1}
Hook line 2: {hookLine2}
First two seconds plan: {firstTwoSeconds}
Pillar: {pillar}
Format: {format}

Script:
{script}

Return the object only.`;

const fill = (v: string | undefined) => (v && v.trim() ? v.trim() : "(not specified)");

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  let ctx: CompleteContext;
  try {
    ctx = (await req.json()) as CompleteContext;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  async function ask(prompt: string): Promise<string> {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    });
    const block = msg.content[0];
    return block.type === "text" ? block.text : "";
  }

  try {
    // 1. Script from the hook
    const scriptPrompt = SCRIPT_PROMPT.replace("{title}", fill(ctx.title))
      .replace("{hookLine1}", fill(ctx.hookLine1))
      .replace("{hookLine2}", fill(ctx.hookLine2))
      .replace("{firstTwoSeconds}", fill(ctx.firstTwoSeconds))
      .replace("{pillar}", fill(ctx.pillar))
      .replace("{format}", fill(ctx.format))
      .replace("{lengthTarget}", fill(ctx.lengthTarget));

    const scriptText = await ask(scriptPrompt);
    const scriptRaw = scriptText.match(/\[[\s\S]*\]/)?.[0] ?? scriptText;
    const script = JSON.parse(scriptRaw) as unknown[];

    // 2. Everything else from the hook + the script
    const restPrompt = REST_PROMPT.replace("{title}", fill(ctx.title))
      .replace("{hookLine1}", fill(ctx.hookLine1))
      .replace("{hookLine2}", fill(ctx.hookLine2))
      .replace("{firstTwoSeconds}", fill(ctx.firstTwoSeconds))
      .replace("{pillar}", fill(ctx.pillar))
      .replace("{format}", fill(ctx.format))
      .replace("{script}", JSON.stringify(script));

    const restText = await ask(restPrompt);
    const restRaw = restText.match(/\{[\s\S]*\}/)?.[0] ?? restText;
    const rest = JSON.parse(restRaw) as Record<string, unknown>;

    return NextResponse.json({ fields: { ...rest, script } });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `AI completion failed: ${msg}` },
      { status: 500 }
    );
  }
}
