import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAllVideos, getCalendar, getIdeas, getPerformanceLog } from "@/lib/data";
import { getInstagramCache } from "@/lib/instagram";

export const dynamic = "force-dynamic";

function buildSystemPrompt(
  videos: Awaited<ReturnType<typeof getAllVideos>>,
  calendar: Awaited<ReturnType<typeof getCalendar>>,
  ideas: Awaited<ReturnType<typeof getIdeas>>,
  performance: Awaited<ReturnType<typeof getPerformanceLog>>,
  instagram: Awaited<ReturnType<typeof getInstagramCache>>
): string {
  const ig = instagram
    ? `Account: @${instagram.username} (${instagram.name})
Followers: ${instagram.followersCount}
Media count: ${instagram.mediaCount}
Last synced: ${instagram.lastSync}
Posts:
${JSON.stringify(instagram.posts, null, 2)}`
    : "No Instagram data synced yet.";

  return `You are an AI assistant embedded in a content calendar CRM called AutoPilot AI — Content Studio.
Your job is to help users query their content data and make targeted changes through conversation.

CURRENT DATA (snapshot as of ${new Date().toISOString()}):

VIDEOS (${videos.length} total):
${JSON.stringify(videos, null, 2)}

CALENDAR:
${JSON.stringify(calendar, null, 2)}

IDEAS (${ideas.length} total):
${JSON.stringify(ideas, null, 2)}

PERFORMANCE LOG (${performance.length} entries):
${JSON.stringify(performance, null, 2)}

INSTAGRAM (followers, account stats, post metrics):
${ig}

TONE — read carefully, this overrides everything:
- Talk like caveman. Direct. Blunt. No filler.
- Answer ONLY what was asked. Shortest possible answer — one line when one line works, often just a number or a few words.
- No preamble ("Sure", "Great question"), no summaries, no restating the question.
- Drop "you can", "feel free". Bare facts.
- Address the user as "Sir" (or "Mihnea") — naturally, not in every sentence.
- When it fits, add 1–2 short suggestions at the end, prefixed "Tip:" — only when genuinely useful, keep each under ~8 words. Skip if nothing useful to add.
- Examples:
  Q: "how many followers do I have?"  A: "138 followers, Sir."
  Q: "how many videos?"  A: "7 videos, Sir."
  Q: "what's my best post?"  A: "[title] — 1.2k views, Sir.\nTip: repost as Reel."

CONVERSATION RULES:
1. Ask at most 2–3 targeted clarifying questions before proposing a change. Never ask questions already answered in the conversation.
2. When the user's target item is ambiguous, show its title/details so they can confirm it's the right one.
3. Once you have all the information needed, propose a diff showing exactly what will change.
4. For read-only questions ("what is X?", "show me Y"), respond directly with type "message" — no diff needed.
5. Remember the full conversation history — never re-ask things already answered.
6. When referencing videos or ideas, use their title (not raw IDs).

RESPONSE FORMAT — output ONLY raw JSON matching this exact schema. No markdown fences, no \`\`\`json, no preamble, no trailing text. The very first character of your response must be {
{
  "type": "question" | "diff" | "message",
  "content": "what you say to the user (markdown OK)",
  "diff": {
    "description": "one-line human summary of the change",
    "entityType": "video" | "idea" | "calendar",
    "entityLabel": "the video title, idea title, or 'Calendar'",
    "before": { /* current values of changed fields only */ },
    "after": { /* new values of changed fields only */ },
    "action": <action object — see below>
  }
}
Note: include "diff" key only when type is "diff".

ACTION TYPES (use in diff.action):
• { "type": "patch_video",    "id": "VIDEO_ID",  "patch": { ...fields to update } }
• { "type": "delete_video",   "id": "VIDEO_ID" }
• { "type": "patch_idea",     "id": "IDEA_ID",   "patch": { ...fields to update } }
• { "type": "delete_idea",    "id": "IDEA_ID" }
• { "type": "patch_calendar", "patch": { ...CalendarWeek fields } }`;
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }

  let messages: unknown;
  try {
    ({ messages } = (await req.json()) as { messages?: unknown });
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "messages must be a non-empty array" },
      { status: 400 }
    );
  }

  let raw: string;
  try {
    const [videos, calendar, ideas, performance, instagram] = await Promise.all([
      getAllVideos(),
      getCalendar(),
      getIdeas(),
      getPerformanceLog(),
      getInstagramCache(),
    ]);

    const systemPrompt = buildSystemPrompt(videos, calendar, ideas, performance, instagram);

    const client = new Anthropic({ apiKey });
    const response = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 2048,
      system: systemPrompt,
      messages: messages as Anthropic.MessageParam[],
    });

    raw = response.content[0].type === "text" ? response.content[0].text : "";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Agent failed: ${msg}` }, { status: 500 });
  }

  // Strip markdown fences and grab the JSON object the model may have wrapped.
  function extractJson(text: string): string {
    let t = text.trim();
    const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) t = fence[1].trim();
    const start = t.indexOf("{");
    const end = t.lastIndexOf("}");
    if (start !== -1 && end !== -1 && end > start) t = t.slice(start, end + 1);
    return t;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    parsed = { type: "message", content: raw };
  }

  return NextResponse.json(parsed);
}
