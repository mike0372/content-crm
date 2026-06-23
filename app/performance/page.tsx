import { getInstagramCache, syncInstagram } from "@/lib/instagram";
import { PerformanceClient } from "@/components/performance/PerformanceClient";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  let cache = await getInstagramCache();
  if (!cache) {
    try { cache = await syncInstagram(); } catch { /* show empty state */ }
  }
  return <PerformanceClient initialData={cache} />;
}
