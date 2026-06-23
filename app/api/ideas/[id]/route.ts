import { NextRequest, NextResponse } from "next/server";
import { getContentItem, saveContentItem, deleteContentItem } from "@/lib/data";
import { ContentItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const item = await getContentItem(params.id);
  if (!item) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(item);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const incoming = (await req.json()) as ContentItem;
  const existing = await getContentItem(params.id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });
  incoming.id = params.id;
  incoming.createdAt = existing.createdAt;
  incoming.stage = existing.stage; // stage only changes via /promote
  const saved = await saveContentItem(incoming);
  return NextResponse.json(saved);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  await deleteContentItem(params.id);
  return NextResponse.json({ ok: true });
}
