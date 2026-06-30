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
  const incoming = (await req.json()) as ContentItem & { expectedUpdatedAt?: string };
  const existing = await getContentItem(id);
  if (!existing) return NextResponse.json({ error: "not found" }, { status: 404 });

  // Opt-in optimistic concurrency: when the caller tells us which version it
  // based its edit on and the stored row has since moved on, reject so the
  // client can reconcile instead of silently overwriting another device.
  if (
    incoming.expectedUpdatedAt &&
    existing.updatedAt &&
    existing.updatedAt !== incoming.expectedUpdatedAt
  ) {
    return NextResponse.json({ error: "conflict", current: existing }, { status: 409 });
  }
  delete incoming.expectedUpdatedAt;

  // append status history on status change
  if (incoming.status && incoming.status !== existing.status) {
    incoming.statusHistory = [
      ...(existing.statusHistory ?? []),
      { status: incoming.status, timestamp: new Date().toISOString() },
    ];
  }
  incoming.id = id;
  incoming.createdAt = existing.createdAt;
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
