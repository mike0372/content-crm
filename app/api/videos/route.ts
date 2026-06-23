import { NextRequest, NextResponse } from "next/server";
import { getAllVideos, saveContentItem, createVideo } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const videos = await getAllVideos();
  return NextResponse.json(videos);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const video = createVideo(body ?? {});
  await saveContentItem(video);
  return NextResponse.json(video, { status: 201 });
}
