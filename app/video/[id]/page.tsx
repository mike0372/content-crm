import { notFound } from "next/navigation";
import { getVideo } from "@/lib/data";
import { VideoEditor } from "@/components/video/VideoEditor";

export const dynamic = "force-dynamic";

export default async function VideoPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const video = await getVideo(id);
  if (!video) notFound();
  return <VideoEditor initial={video} initialTab={tab} />;
}
