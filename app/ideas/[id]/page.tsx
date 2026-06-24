import { notFound } from "next/navigation";
import { getContentItem } from "@/lib/data";
import { IdeaEditor } from "@/components/ideas/IdeaEditor";

export const dynamic = "force-dynamic";

export default async function IdeaPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const item = await getContentItem(id);
  if (!item || item.stage !== "idea") notFound();
  return <IdeaEditor initial={item} />;
}
