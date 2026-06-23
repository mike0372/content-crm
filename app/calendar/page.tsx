import { getAllVideos, getCalendar } from "@/lib/data";
import { CalendarClient } from "@/components/calendar/CalendarClient";

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const [videos, calendar] = await Promise.all([getAllVideos(), getCalendar()]);
  return <CalendarClient initialVideos={videos} initialCalendar={calendar} />;
}
