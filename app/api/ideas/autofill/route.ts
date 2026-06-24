import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const dynamic = "force-dynamic";

// Single-idea field extractor used by the in-editor "Autofill from PDF" button.
// Distinct from /api/ideas/import (which extracts many ideas and saves them).
// This one returns the full nested field object across all 6 editor sections —
// the editor merges them into the open item without overwriting anything the
// user already filled. Uses Claude Sonnet for higher-quality structured pulls.

const PROMPT = `You are extracting structured content from a video content plan PDF.
Return a single raw JSON object only — no markdown, no preamble, no
explanation. Extract every field you can find. Use null for anything
not present. All text fields should be extracted verbatim where possible.

{
  title: string,
  pillar: one of [Claude Code, Agents, Comparisons, Tutorials, New Features],
  hookType: one of [H1, H2, H3, H4, H5, H6],
  format: one of [Talking head, Screen recording, B-roll, Tutorial, Skit],
  lengthTarget: string,
  postingWindow: one of [Evening, Late],

  demandSignal: {
    text: string,
    source: string,
    date: string
  },
  recognitionScore: number 1-5,

  hook: {
    line1: string (max 12 words),
    line2: string (max 6 words),
    firstTwoSeconds: string,
    scorecard: {
      recognition: boolean,
      openLoop: boolean,
      firstTwoS: boolean,
      specificity: boolean,
      identity: boolean
    }
  },

  script: [
    {
      timestamp: string,
      label: one of [HOOK, RE-HOOK, DEMO, RESULT, CTA],
      content: string,
      retentionNote: string
    }
  ],

  captions: [
    {
      text: string,
      hashtags: string,
      recommended: boolean
    }
  ],

  engagement: {
    triggerType: string,
    triggerText: string,
    firstComment: string,
    endCard: string
  }
}

Document text: {extractedPdfText}`;

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
        max_tokens: 8192,
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
              {
                type: "text",
                text: PROMPT.replace(
                  "{extractedPdfText}",
                  "(see attached document)"
                ),
              },
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
        max_tokens: 8192,
        messages: [
          { role: "user", content: PROMPT.replace("{extractedPdfText}", text) },
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

  try {
    const raw = responseText.match(/\{[\s\S]*\}/)?.[0] ?? responseText;
    const fields = JSON.parse(raw) as Record<string, unknown>;
    return NextResponse.json({ fields });
  } catch {
    return NextResponse.json(
      { error: "Could not parse AI response", raw: responseText.slice(0, 500) },
      { status: 500 }
    );
  }
}
