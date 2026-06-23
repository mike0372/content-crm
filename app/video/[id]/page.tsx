import { notFound } from "next/navigation";
import { getVideo } from "@/lib/data";
import { VideoEditor } from "@/components/video/VideoEditor";

export const dynamic = "force-dynamic";

export default async function VideoPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const video = await getVideo(params.id);
  if (!video) notFound();
  return <VideoEditor initial={video} initialTab={searchParams.tab} />;
}
