import { NextRequest, NextResponse } from "next/server";
import { getIdeas, saveIdeas, saveContentItem, createIdeaItem } from "@/lib/data";
import { ContentItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await getIdeas());
}

export async function PUT(req: NextRequest) {
  const ideas = (await req.json()) as ContentItem[];
  return NextResponse.json(await saveIdeas(ideas));
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const idea = createIdeaItem(body);
  await saveContentItem(idea);
  return NextResponse.json(idea, { status: 201 });
}
