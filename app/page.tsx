import { getAllContent, getCalendar } from "@/lib/data";
import { getInstagramCache } from "@/lib/instagram";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [allContent, igCache, calWeek] = await Promise.all([
    getAllContent(),
    getInstagramCache(),
    getCalendar(),
  ]);

  const videos = allContent.filter((i) => i.stage === "production");
  const ideas = allContent.filter((i) => i.stage === "idea");

  return (
    <DashboardClient
      igCache={igCache}
      videos={videos}
      ideas={ideas}
      calWeek={calWeek}
    />
  );
}
