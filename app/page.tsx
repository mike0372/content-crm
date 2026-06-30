import { getAllContent, getCalendar } from "@/lib/data";
import { getInstagramCache } from "@/lib/instagram";
import { getTokenHealth } from "@/lib/instagramToken";
import { getMonthlyAiUsage } from "@/lib/ai";
import { DashboardClient } from "@/components/dashboard/DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const [allContent, igCache, calWeek, tokenHealth, aiUsage] = await Promise.all([
    getAllContent(),
    getInstagramCache(),
    getCalendar(),
    getTokenHealth(),
    getMonthlyAiUsage(),
  ]);

  const videos = allContent.filter((i) => i.stage === "production");
  const ideas = allContent.filter((i) => i.stage === "idea");

  return (
    <DashboardClient
      igCache={igCache}
      videos={videos}
      ideas={ideas}
      calWeek={calWeek}
      tokenHealth={tokenHealth}
      aiUsage={aiUsage}
    />
  );
}
