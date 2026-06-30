import { NextRequest, NextResponse } from "next/server";
import { getSupabase } from "@/lib/supabase";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sb = getSupabase();
  const { data, error } = await sb
    .from("agent_conversations")
    .select("id, title, messages, created_at")
    .eq("id", id)
    .single();

  if (error) {
    if (error.message?.includes("agent_conversations") || error.code === "42P01") {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json(data);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sb = getSupabase();
  const { error } = await sb
    .from("agent_conversations")
    .delete()
    .eq("id", id);

  if (error) {
    if (error.message?.includes("agent_conversations") || error.code === "42P01") {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
