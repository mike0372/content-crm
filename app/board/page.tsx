import { getAllVideos } from "@/lib/data";
import { BoardClient } from "@/components/board/BoardClient";

export const dynamic = "force-dynamic";

export default async function BoardPage() {
  const videos = await getAllVideos();
  return <BoardClient initialVideos={videos} />;
}
