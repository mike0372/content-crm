import { getIdeas } from "@/lib/data";
import { IdeasClient } from "@/components/ideas/IdeasClient";

export const dynamic = "force-dynamic";

export default async function IdeasPage() {
  const ideas = await getIdeas();
  return <IdeasClient initialIdeas={ideas} />;
}
