import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAllVideos, getCalendar, getIdeas, getPerformanceLog } from "@/lib/data";

export const dynamic = "force-dynamic";

const client = new Anthropic();

function buildSystemPrompt(
  videos: Awaited<ReturnType<typeof getAllVideos>>,
  calendar: Awaited<ReturnType<typeof getCalendar>>,
  ideas: Awaited<ReturnType<typeof getIdeas>>,
  performance: Awaited<ReturnType<typeof getPerformanceLog>>
): string {
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

CONVERSATION RULES:
1. Ask at most 2–3 targeted clarifying questions before proposing a change. Never ask questions already answered in the conversation.
2. When the user's target item is ambiguous, show its title/details so they can confirm it's the right one.
3. Once you have all the information needed, propose a diff showing exactly what will change.
4. For read-only questions ("what is X?", "show me Y"), respond directly with type "message" — no diff needed.
5. Remember the full conversation history — never re-ask things already answered.
6. Be concise and direct. Markdown is OK in the content field.
7. When referencing videos or ideas, always use their title (not raw IDs) in your content.

RESPONSE FORMAT — always output valid JSON matching this exact schema (no markdown fences, no preamble):
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
  const { messages } = await req.json();

  const [videos, calendar, ideas, performance] = await Promise.all([
    getAllVideos(),
    getCalendar(),
    getIdeas(),
    getPerformanceLog(),
  ]);

  const systemPrompt = buildSystemPrompt(videos, calendar, ideas, performance);

  const response = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    system: systemPrompt,
    messages,
  });

  const raw = response.content[0].type === "text" ? response.content[0].text : "";

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = { type: "message", content: raw };
  }

  return NextResponse.json(parsed);
}
