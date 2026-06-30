import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("agent_conversations")
    .select("id, title, created_at, updated_at, message_count")
    .order("updated_at", { ascending: false });

  // Table may not exist yet — return empty list rather than crashing the UI
  if (error) {
    if (error.message?.includes("agent_conversations") || error.code === "42P01") {
      return NextResponse.json([]);
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data ?? []);
}

export async function POST(req: NextRequest) {
  const body = await req.json() as { title?: string; messages?: unknown[] };
  if (!body.title || !Array.isArray(body.messages)) {
    return NextResponse.json({ error: "title and messages required" }, { status: 400 });
  }

  const sb = getSupabase();
  const { data, error } = await sb
    .from("agent_conversations")
    .insert({ title: body.title, messages: body.messages })
    .select("id")
    .single();

  if (error) {
    if (error.message?.includes("agent_conversations") || error.code === "42P01") {
      return NextResponse.json(
        { error: "Conversation history not yet set up — run scripts/add-edward-conversations.sql in Supabase" },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id: data.id });
}
