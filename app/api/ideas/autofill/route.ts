import { NextRequest, NextResponse } from "next/server";
import { createMessage } from "@/lib/ai";

export const dynamic = "force-dynamic";

// Single-idea field extractor used by the in-editor "Autofill from PDF" button.
// Distinct from /api/ideas/import (which extracts many ideas and saves them).
// This one returns the full nested field object across all 6 editor sections —
// the editor merges them into the open item without overwriting anything the
// user already filled. Uses Claude Sonnet for higher-quality structured pulls.

const PROMPT = `You are extracting structured content from a video content plan document.
Return a single raw JSON object only — no markdown, no preamble, no explanation.
Extract every field you can find. Use null for anything not present.

=== SCRIPT BEATS — CRITICAL INSTRUCTION ===
You MUST produce a "script" array with exactly these 5 beat labels in order:
  HOOK, RE-HOOK, DEMO, RESULT, CTA

What each beat means — map the document's content accordingly:
- HOOK      (0:00–0:03) The very first thing said on camera. The opening line that stops the scroll. Usually a bold claim, question, or surprising fact. Pull from any "hook", "opener", or "first line" content in the doc.
- RE-HOOK   (0:03–0:07) A second sentence that deepens curiosity or restates the promise so viewers don't leave after the hook. Pull from any secondary hook, bridge, or "keep watching" line.
- DEMO      (0:07–0:30) The meat — the tutorial steps, screen recording narration, code walkthrough, or main educational content. Combine all instructional/demo content from the doc into this beat.
- RESULT    (0:30–0:45) Show the payoff. What the viewer now has, can do, or just learned. Pull from "result", "outcome", "what you built", or summary content.
- CTA       (0:45–0:55) The closing call-to-action. What to do next (follow, comment, save). Pull from any "CTA", "outro", or "end card" content.

If the document does not have a section that maps cleanly to a beat, WRITE a short placeholder using context from the rest of the doc (e.g. infer a CTA from the topic). Never omit a beat or leave "content" empty — always write something.

For "retentionNote": add a short production tip for that beat (e.g. "Cut fast", "Show result on screen", "High energy"). These are director notes, not script lines.

Timestamps: use the ranges above if the doc doesn't specify exact times.

=== ALL OTHER FIELDS ===

{
  "title": string,
  "pillar": one of ["Claude Code", "Agents", "Comparisons", "Tutorials", "New Features"],
  "hookType": one of ["H1", "H2", "H3", "H4", "H5", "H6"],
  "format": one of ["Talking head", "Screen recording", "B-roll", "Tutorial", "Skit"],
  "lengthTarget": string,
  "postingWindow": one of ["Evening", "Late"],

  "demandSignal": {
    "text": string,
    "source": string,
    "date": string
  },
  "recognitionScore": number 1-5,

  "hook": {
    "line1": string (max 12 words — the spoken hook line),
    "line2": string (max 6 words — secondary pull),
    "firstTwoSeconds": string (visual/action direction for the first 2 seconds),
    "scorecard": {
      "recognition": boolean,
      "openLoop": boolean,
      "firstTwoS": boolean,
      "specificity": boolean,
      "identity": boolean
    }
  },

  "script": [
    { "timestamp": "0:00", "label": "HOOK",    "content": string, "retentionNote": string },
    { "timestamp": "0:03", "label": "RE-HOOK", "content": string, "retentionNote": string },
    { "timestamp": "0:07", "label": "DEMO",    "content": string, "retentionNote": string },
    { "timestamp": "0:30", "label": "RESULT",  "content": string, "retentionNote": string },
    { "timestamp": "0:45", "label": "CTA",     "content": string, "retentionNote": string }
  ],

  "captions": [
    { "text": string, "hashtags": string, "recommended": boolean }
  ],

  "engagement": {
    "triggerType": string,
    "triggerText": string,
    "firstComment": string,
    "endCard": string
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

  let responseText: string;
  try {
    if (isPdf) {
      const msg = await createMessage(
        {
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
        },
        { route: "ideas.autofill", tier: "smart" }
      );
      const block = msg.content[0];
      responseText = block.type === "text" ? block.text : "";
    } else {
      const text = buffer.toString("utf8");
      const msg = await createMessage(
        {
          max_tokens: 8192,
          messages: [
            { role: "user", content: PROMPT.replace("{extractedPdfText}", text) },
          ],
        },
        { route: "ideas.autofill", tier: "smart" }
      );
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
