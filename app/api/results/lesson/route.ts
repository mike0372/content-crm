import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

// One-line "lesson learned" generator for the RESULTS tab. Takes the computed
// metric verdicts for a linked reel and returns a single actionable sentence.
// Reuses the existing Anthropic SDK + Claude Haiku (same model as autofill).

const PROMPT = `You are a short-form video analyst. Given these metric verdicts for an Instagram Reel, write ONE sentence (max 15 words) identifying the single most important lesson for next time. Be specific.
Metrics: {metrics}
Return only the sentence, no preamble.`;

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  let metrics: unknown;
  try {
    ({ metrics } = (await req.json()) as { metrics: unknown });
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!metrics) {
    return NextResponse.json({ error: "No metrics provided" }, { status: 400 });
  }

  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: PROMPT.replace("{metrics}", JSON.stringify(metrics)),
        },
      ],
    });
    const block = msg.content[0];
    const lesson = block.type === "text" ? block.text.trim() : "";
    return NextResponse.json({ lesson });
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `Lesson generation failed: ${m}` },
      { status: 500 }
    );
  }
}
