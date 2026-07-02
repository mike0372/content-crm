import { NextRequest, NextResponse } from "next/server";
import type Anthropic from "@anthropic-ai/sdk";
import { createMessage } from "@/lib/ai";
import { getAllVideos, getCalendar, getIdeas, getPerformanceLog } from "@/lib/data";
import { getInstagramCache } from "@/lib/instagram";
import type { ContentItem } from "@/lib/types";

export const dynamic = "force-dynamic";

// Edward used to inject the ENTIRE database (every item's full JSON + the whole
// IG cache) into the system prompt on every message, and replayed the full
// conversation each turn — so cost and prompt size grew O(n) with the library
// and the chat, eventually overflowing the context window. Now we send a
// compact index of everything (so Edward still knows the whole landscape and
// every id) plus full detail only for the items relevant to the latest
// question, and we bound the replayed conversation to the most recent turns.

const MAX_TURNS = 12; // most recent messages replayed to the model
const RETRIEVE_K = 6; // items pulled in full for the current question
const RECENT_POSTS = 20;

function searchText(it: ContentItem): string {
  const beats = (it.script ?? []).map((b) => b.content).join(" ");
  return [it.title, it.hook?.line1, it.hook?.line2, it.pillar, it.format, it.demandSignal?.text, beats]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function compactItem(it: ContentItem): string {
  if (it.stage === "production") {
    const res =
      it.status === "ANALYZED"
        ? ` · ${it.results?.verdict ?? "?"} · ${(it.results?.viewsIG ?? 0) + (it.results?.viewsFB ?? 0)} views`
        : "";
    return `- [${it.id}] "${it.title}" · ${it.status} · ${it.pillar}${res}`;
  }
  return `- [${it.id}] "${it.title}" · idea · ${it.pillar} · recognition ${it.recognitionScore ?? "-"}`;
}

// Rank items by how many words from the latest question they contain; fall back
// to the most recent when the question has no usable terms.
function retrieve(items: ContentItem[], query: string, k: number): ContentItem[] {
  const terms = query.toLowerCase().split(/\W+/).filter((t) => t.length > 2);
  if (terms.length === 0) return items.slice(-k);
  const scored = items
    .map((it) => {
      const txt = searchText(it);
      let score = 0;
      for (const t of terms) if (txt.includes(t)) score++;
      return { it, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, k).map((s) => s.it);
}

function lastUserText(messages: Anthropic.MessageParam[]): string {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role !== "user") continue;
    const c = messages[i].content;
    if (typeof c === "string") return c;
    if (Array.isArray(c)) return c.map((b) => (b.type === "text" ? b.text : "")).join(" ");
  }
  return "";
}

function buildSystemPrompt(
  videos: ContentItem[],
  calendar: Awaited<ReturnType<typeof getCalendar>>,
  ideas: ContentItem[],
  performance: Awaited<ReturnType<typeof getPerformanceLog>>,
  instagram: Awaited<ReturnType<typeof getInstagramCache>>,
  query: string
): string {
  const account = instagram
    ? `@${instagram.username} (${instagram.name}) · ${instagram.followersCount} followers · ${instagram.mediaCount} posts · synced ${instagram.lastSync}`
    : "No Instagram data synced yet.";

  const igPosts = (instagram?.posts ?? [])
    .slice()
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, RECENT_POSTS)
    .map((p) => {
      const cap = (p.caption ?? "").replace(/\s+/g, " ").slice(0, 60);
      return `- [${p.id}] ${p.timestamp.slice(0, 10)} · ${p.mediaType} · ${p.plays || p.impressions} views · ${p.reach} reach · "${cap}"`;
    })
    .join("\n");

  const calLine = Object.entries(calendar.days)
    .map(([d, ids]) => `${d}: ${(ids as string[]).length ? (ids as string[]).join(", ") : "—"}`)
    .join(" | ");

  const relevant = retrieve([...videos, ...ideas], query, RETRIEVE_K);

  return `You are an AI assistant embedded in a content calendar CRM called AutoPilot AI — Content Studio.
Your job is to help users query their content data and make targeted changes through conversation.

CURRENT DATA (snapshot as of ${new Date().toISOString()}):

ACCOUNT: ${account}

VIDEOS (${videos.length}) — id, title, status, pillar:
${videos.map(compactItem).join("\n") || "(none)"}

IDEAS (${ideas.length}):
${ideas.map(compactItem).join("\n") || "(none)"}

CALENDAR (week ${calendar.week}) — ids per day: ${calLine}

RECENT INSTAGRAM POSTS:
${igPosts || "(none synced)"}

PERFORMANCE LOG: ${performance.length} analyzed entries (the ANALYZED videos above carry their verdict + views).

RELEVANT DETAIL — full fields for the items most related to the latest question. Use these ids/values for edits; if you need detail on an item not shown here, ask the user to name it:
${relevant.length ? JSON.stringify(relevant, null, 2) : "(none matched — answer from the index above or ask which item)"}

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
  let greeting = false;
  try {
    const body = (await req.json()) as { messages?: unknown; greeting?: boolean };
    messages = body.messages;
    greeting = body.greeting === true;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json(
      { error: "messages must be a non-empty array" },
      { status: 400 }
    );
  }

  // Bound the replayed history: keep the most recent turns, and make sure the
  // window still starts on a user turn (the API requires it).
  let history = messages as Anthropic.MessageParam[];
  if (history.length > MAX_TURNS) history = history.slice(-MAX_TURNS);
  while (history.length && history[0].role !== "user") history = history.slice(1);
  if (history.length === 0) history = [messages[messages.length - 1] as Anthropic.MessageParam];

  let raw: string;
  try {
    const [videos, calendar, ideas, performance, instagram] = await Promise.all([
      getAllVideos(),
      getCalendar(),
      getIdeas(),
      getPerformanceLog(),
      getInstagramCache(),
    ]);

    if (greeting) {
      const vCount = videos.length;
      const iCount = ideas.length;
      const followers = instagram?.followersCount ?? 0;
      const greetResponse = await createMessage(
        {
          max_tokens: 80,
          system: `You are Edward, a direct AI assistant for an Instagram Reels studio. Produce ONE greeting line only — like Alfred greeting Batman. Caveman short. Include 1-2 numbers from: ${vCount} videos in production, ${iCount} ideas banked, ${followers} followers. Address as Sir. No "Hello", no period required. Output raw JSON only: {"type":"message","content":"<one line>"}`,
          messages: [{ role: "user", content: "greet" }],
        },
        { route: "agent.greeting", tier: "fast" }
      );
      raw = greetResponse.content[0].type === "text" ? greetResponse.content[0].text : '{"type":"message","content":"Ready, Sir."}';
    } else {
      const systemPrompt = buildSystemPrompt(
        videos,
        calendar,
        ideas,
        performance,
        instagram,
        lastUserText(history)
      );

      const response = await createMessage(
        {
          max_tokens: 2048,
          system: systemPrompt,
          messages: history,
        },
        { route: "agent", tier: "fast" }
      );

      raw = response.content[0].type === "text" ? response.content[0].text : "";
    }
  } catch (err) {
    console.error("Edward agent route failed:", err);
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
