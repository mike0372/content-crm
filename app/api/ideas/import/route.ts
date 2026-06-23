import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { saveContentItem } from "@/lib/data";
import { ContentItem, PILLARS } from "@/lib/types";
import { createIdeaItem } from "@/lib/factories";

export const dynamic = "force-dynamic";

const SYSTEM = `You extract short-form video content ideas. The creator makes videos about Claude Code, AI agents, coding tutorials, AI feature comparisons, and new AI releases.`;

const EXTRACTION_PROMPT = `Extract every distinct content idea from this document. Output ONLY a valid JSON array — no markdown, no explanation.

Each object must have exactly these fields:
{
  "title": "punchy video title, max 60 chars",
  "hookLine1": "scroll-stopping hook line, 1-2 sentences",
  "pillar": "one of: Claude Code | Agents | Comparisons | Tutorials | New Features",
  "recognitionScore": 3
}

recognitionScore: 1 = generic/common, 5 = very specific/surprising/unique.`;

type ExtractedIdea = {
  title: string;
  hookLine1: string;
  pillar: string;
  recognitionScore: number;
};

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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
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
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4096,
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

  let extracted: ExtractedIdea[];
  try {
    const raw = responseText.match(/\[[\s\S]*\]/)?.[0] ?? responseText;
    extracted = JSON.parse(raw) as ExtractedIdea[];
    if (!Array.isArray(extracted)) throw new Error("not an array");
  } catch {
    return NextResponse.json(
      { error: "Could not parse AI response", raw: responseText.slice(0, 500) },
      { status: 500 }
    );
  }

  const newIdeas: ContentItem[] = extracted.map((e) =>
    createIdeaItem({
      title: String(e.title ?? "").slice(0, 120),
      hookLine1: String(e.hookLine1 ?? ""),
      pillar: PILLARS.includes(e.pillar as (typeof PILLARS)[number])
        ? (e.pillar as (typeof PILLARS)[number])
        : "Claude Code",
      recognitionScore: Math.min(
        5,
        Math.max(1, Math.round(Number(e.recognitionScore) || 3))
      ),
    })
  );

  for (const idea of newIdeas) {
    await saveContentItem(idea);
  }

  return NextResponse.json({ imported: newIdeas.length, ideas: newIdeas });
}
