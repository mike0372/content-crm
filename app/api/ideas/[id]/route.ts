import { NextRequest, NextResponse } from "next/server";
import { getContentItem, saveContentItem, deleteContentItem } from "@/lib/data";
import { ContentItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const item = await getContentItem(id);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const incoming = (await req.json()) as ContentItem;
  const existing = await getContentItem(id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  incoming.id = id;
  incoming.createdAt = existing.createdAt;
  incoming.stage = existing.stage; // stage only changes via /promote
  const saved = await saveContentItem(incoming);
  return NextResponse.json(saved);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  await deleteContentItem(id);
  return NextResponse.json({ ok: true });
}
