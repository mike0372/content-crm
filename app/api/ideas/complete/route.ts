import { NextRequest, NextResponse } from "next/server";
import { createMessage } from "@/lib/ai";

export const dynamic = "force-dynamic";

// One-click "Complete idea with AI". Optional research phase (web_search_20260209)
// followed by two sequential Sonnet calls:
//   1. write the script from the hook (+ research context if requested)
//   2. write every other section from the hook + the script just created
// Returns { fields, researchSummary? } so the editor can show findings before merging.

interface CompleteContext {
  title?: string;
  pillar?: string;
  format?: string;
  lengthTarget?: string;
  hookLine1?: string;
  hookLine2?: string;
  firstTwoSeconds?: string;
  demandSignal?: string;
  research?: boolean;
}

const RESEARCH_PROMPT = `You are a research assistant for an Instagram Reel creator in the AI/tech niche.
Use web search to research the following topic so we can create a compelling 45-60 second reel.

Topic: {title}
Content pillar: {pillar}

Search for two things:
1. DEMAND: What are people currently searching for, asking about, or struggling with related to this topic? Look for Reddit posts, YouTube comments, forums, or search trend data.
2. CONTENT: What are the key facts, examples, recent developments, or data points that would make a reel on this topic genuinely useful and shareable?

After researching, respond in exactly this format (no extra text before FINDINGS:):

FINDINGS:
[Write 2-3 paragraphs of actionable research insights for the content creator. Be specific — include real data points, popular questions, and content angles that would resonate.]

SOURCES:
- [URL 1]
- [URL 2]
- [URL 3]`;

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
{researchContext}
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
{researchContext}
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

  async function ask(prompt: string): Promise<string> {
    const msg = await createMessage(
      { max_tokens: 4096, messages: [{ role: "user", content: prompt }] },
      { route: "ideas.complete", tier: "smart" }
    );
    const block = msg.content[0];
    return block.type === "text" ? block.text : "";
  }

  try {
    let researchSummary: { findings: string; sources: string[] } | undefined;
    let researchContext = "";

    if (ctx.research) {
      const researchPrompt = RESEARCH_PROMPT
        .replace("{title}", fill(ctx.title))
        .replace("{pillar}", fill(ctx.pillar));

      const researchMsg = await client.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 2048,
        tools: [{ name: "web_search" as const, type: "web_search_20260209" as const }],
        messages: [{ role: "user", content: researchPrompt }],
      });

      // Collect Claude's text analysis and URLs from search result blocks
      const textParts: string[] = [];
      const sources: string[] = [];

      for (const block of researchMsg.content) {
        if (block.type === "text") {
          textParts.push(block.text);
        } else if (block.type === "web_search_tool_result" && Array.isArray(block.content)) {
          for (const result of block.content) {
            if (result.type === "web_search_result" && result.url) {
              sources.push(result.url);
            }
          }
        }
      }

      const fullText = textParts.join("\n\n").trim();

      // Parse FINDINGS: / SOURCES: sections from Claude's structured response
      const findingsMatch = fullText.match(/FINDINGS:\s*([\s\S]*?)(?=\nSOURCES:|$)/i);
      const sourcesMatch = fullText.match(/SOURCES:\s*([\s\S]*?)$/i);

      const findings = findingsMatch?.[1]?.trim() ?? fullText;

      // Supplement structured sources with any URLs Claude listed in text
      const textSourceBlock = sourcesMatch?.[1]?.trim() ?? "";
      const textUrls = textSourceBlock
        .split("\n")
        .map((line) => line.replace(/^[-*•]\s*/, "").trim())
        .filter((url) => url.startsWith("http"));

      const allSources = [...new Set([...sources, ...textUrls])].slice(0, 6);

      researchSummary = { findings, sources: allSources };
      researchContext = findings
        ? `\nResearch context (use this to inform the content):\n${findings}\n`
        : "";
    }

    // 1. Script from the hook (+ research if available)
    const scriptPrompt = SCRIPT_PROMPT
      .replace("{title}", fill(ctx.title))
      .replace("{hookLine1}", fill(ctx.hookLine1))
      .replace("{hookLine2}", fill(ctx.hookLine2))
      .replace("{firstTwoSeconds}", fill(ctx.firstTwoSeconds))
      .replace("{pillar}", fill(ctx.pillar))
      .replace("{format}", fill(ctx.format))
      .replace("{lengthTarget}", fill(ctx.lengthTarget))
      .replace("{researchContext}", researchContext);

    const scriptText = await ask(scriptPrompt);
    const scriptRaw = scriptText.match(/\[[\s\S]*\]/)?.[0] ?? scriptText;
    const script = JSON.parse(scriptRaw) as unknown[];

    // 2. Everything else from the hook + the script
    const restPrompt = REST_PROMPT
      .replace("{title}", fill(ctx.title))
      .replace("{hookLine1}", fill(ctx.hookLine1))
      .replace("{hookLine2}", fill(ctx.hookLine2))
      .replace("{firstTwoSeconds}", fill(ctx.firstTwoSeconds))
      .replace("{pillar}", fill(ctx.pillar))
      .replace("{format}", fill(ctx.format))
      .replace("{researchContext}", researchContext)
      .replace("{script}", JSON.stringify(script));

    const restText = await ask(restPrompt);
    const restRaw = restText.match(/\{[\s\S]*\}/)?.[0] ?? restText;
    const rest = JSON.parse(restRaw) as Record<string, unknown>;

    return NextResponse.json({ fields: { ...rest, script }, researchSummary });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `AI completion failed: ${msg}` },
      { status: 500 }
    );
  }
}
