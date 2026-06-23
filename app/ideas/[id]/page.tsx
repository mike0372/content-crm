import { notFound } from "next/navigation";
import { getContentItem } from "@/lib/data";
import { IdeaEditor } from "@/components/ideas/IdeaEditor";

export const dynamic = "force-dynamic";

export default async function IdeaPage({
  params,
}: {
  params: { id: string };
}) {
  const item = await getContentItem(params.id);
  if (!item || item.stage !== "idea") notFound();
  return <IdeaEditor initial={item} />;
}
