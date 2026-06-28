import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getIdeas } from "@/lib/data";
import { getInstagramCache } from "@/lib/instagram";
import { CONTENT_TYPE_LABELS, ContentType } from "@/lib/types";

export const dynamic = "force-dynamic";

const NICHE_CONTEXT = `You are a content strategist for an Instagram creator in the AI/tech niche.
The creator makes content about Claude, AI coding tools, AI agents, and developer productivity.
Their audience is software developers and tech-savvy professionals interested in AI.
Their brand voice is confident, practical, and slightly edgy — not corporate.`;

const BRAINSTORM_PROMPT = `${NICHE_CONTEXT}

Seed idea: "{seedIdea}"
Content type to generate: {contentTypeLabel}
Format details: {formatDetails}

Top performing content (by views) for inspiration and pattern matching:
{topPerformers}

Existing ideas to avoid duplicating:
{existingIdeas}

Generate {count} distinct content ideas of type "{contentTypeLabel}". Each idea must be unique, specific, and immediately actionable.

Return a raw JSON array only, no markdown, no preamble.
Each object:
{
  "title": string (max 12 words, punchy and specific),
  "notes": string (2-3 sentences: what the content covers and why it will perform),
  "hookLine1": string (max 12 words — the opening line that stops the scroll),
  "pillar": one of ["Claude Code", "Agents", "Comparisons", "Tutorials", "New Features"],
  "contentType": "{contentType}"
}`;

const FORMAT_DETAILS: Record<ContentType, string> = {
  reel_short: "Short-form vertical video, 7–15 seconds. Single punchy insight or demo. No fluff.",
  reel_long:  "Vertical video, 30–60 seconds. Full story arc: hook → demo → result → CTA.",
  post:       "Single static image post. Strong visual + short caption.",
  carousel:   "Multi-slide swipeable post, 3–8 slides. Educational or story-based.",
  informative:"Dense single-image graphic. Stats, comparisons, checklists, or data visualizations.",
};

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
  }

  let body: { seedIdea: string; contentType: string; count?: number; single?: boolean; excludeTitles?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { seedIdea, contentType, count = 4, single = false, excludeTitles = [] } = body;
  if (!seedIdea?.trim()) {
    return NextResponse.json({ error: "seedIdea is required" }, { status: 400 });
  }

  const ct = (contentType as ContentType) ?? "reel_long";

  // Gather context in parallel
  const [existingIdeas, igCache] = await Promise.all([
    getIdeas().catch(() => []),
    getInstagramCache().catch(() => null),
  ]);

  const existingTitles = [
    ...existingIdeas.map((i) => i.title).filter(Boolean),
    ...excludeTitles,
  ].slice(0, 30);

  const topPerformers = igCache?.posts
    ? [...igCache.posts]
        .sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0))
        .slice(0, 5)
        .map((p) => `- "${p.caption?.slice(0, 80) ?? ""}" — ${p.plays ?? 0} plays`)
        .join("\n")
    : "(no IG data yet)";

  const prompt = BRAINSTORM_PROMPT
    .replace("{seedIdea}", seedIdea.trim())
    .replace("{contentTypeLabel}", CONTENT_TYPE_LABELS[ct])
    .replace("{contentType}", ct)
    .replace("{formatDetails}", FORMAT_DETAILS[ct])
    .replace("{topPerformers}", topPerformers || "(none)")
    .replace("{existingIdeas}", existingTitles.length > 0 ? existingTitles.map((t) => `- ${t}`).join("\n") : "(none)")
    .replace("{count}", String(single ? 1 : Math.min(Math.max(count, 1), 5)));

  const client = new Anthropic({ apiKey });

  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      messages: [{ role: "user", content: prompt }],
    });

    const text = msg.content[0]?.type === "text" ? msg.content[0].text : "";
    const raw = text.match(/\[[\s\S]*\]/)?.[0] ?? text;
    const ideas = JSON.parse(raw) as unknown[];

    if (single) {
      return NextResponse.json({ idea: ideas[0] ?? null });
    }
    return NextResponse.json({ ideas });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Brainstorm failed: ${msg}` }, { status: 500 });
  }
}
