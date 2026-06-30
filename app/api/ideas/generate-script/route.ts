import { NextRequest, NextResponse } from "next/server";
import { createMessage } from "@/lib/ai";

export const dynamic = "force-dynamic";

// AI script generator used by the "Generate Script" panel in the Idea editor's
// Section 4. Takes the already-extracted fields as context and writes a full
// beat-by-beat reel script. Uses Claude Sonnet, same as the autofill call.

const PROMPT = `You are a short-form video script writer for an Instagram Reels
creator in the AI/tech niche. Write a complete beat-by-beat script
for a 45-60 second reel. Return a raw JSON array only, no markdown.

Each beat object:
{ timestamp: string, label: string, content: string, retentionNote: string }

Labels must follow this sequence: HOOK → RE-HOOK → DEMO → RESULT → CTA
Timestamps: 0-2s, 2-5s, 5-40s (split into sub-beats every 4s), 40-55s, 55-60s

Rules for this creator:
- Hook beat: both overlay lines must be on screen at frame 0, first
  spoken words = the promise (no greeting)
- Re-hook at 2-5s: a visual switch or spoken twist
- Demo: one action per beat, show the thing working not the menu
- Result: state the concrete saving with a number
- CTA: end card text + loop connects to the opening

Video context:
Title: {title}
Hook line 1: {hookLine1}
Hook line 2: {hookLine2}
First two seconds plan: {firstTwoSeconds}
Pillar: {pillar}
Format: {format}
Length: {lengthTarget}
Demand signal: {demandSignal}

Return the array only.`;

interface ScriptContext {
  title?: string;
  hookLine1?: string;
  hookLine2?: string;
  firstTwoSeconds?: string;
  pillar?: string;
  format?: string;
  lengthTarget?: string;
  demandSignal?: string;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  let ctx: ScriptContext;
  try {
    ctx = (await req.json()) as ScriptContext;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const fill = (v: string | undefined) => (v && v.trim() ? v.trim() : "(not specified)");
  const prompt = PROMPT.replace("{title}", fill(ctx.title))
    .replace("{hookLine1}", fill(ctx.hookLine1))
    .replace("{hookLine2}", fill(ctx.hookLine2))
    .replace("{firstTwoSeconds}", fill(ctx.firstTwoSeconds))
    .replace("{pillar}", fill(ctx.pillar))
    .replace("{format}", fill(ctx.format))
    .replace("{lengthTarget}", fill(ctx.lengthTarget))
    .replace("{demandSignal}", fill(ctx.demandSignal));

  let responseText: string;
  try {
    const msg = await createMessage(
      { max_tokens: 4096, messages: [{ role: "user", content: prompt }] },
      { route: "ideas.generate-script", tier: "smart" }
    );
    const block = msg.content[0];
    responseText = block.type === "text" ? block.text : "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Script generation failed: ${msg}` },
      { status: 500 }
    );
  }

  try {
    const raw = responseText.match(/\[[\s\S]*\]/)?.[0] ?? responseText;
    const beats = JSON.parse(raw) as unknown[];
    if (!Array.isArray(beats)) throw new Error("not an array");
    return NextResponse.json({ beats });
  } catch {
    return NextResponse.json(
      { error: "Could not parse AI response", raw: responseText.slice(0, 500) },
      { status: 500 }
    );
  }
}
