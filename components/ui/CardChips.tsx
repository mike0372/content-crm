"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, TriangleAlert } from "lucide-react";
import { Video, PostingWindow } from "@/lib/types";
import { cn } from "@/lib/utils";

// --- Posting window badge (real-time, Romania timezone) ----------------------

// Window timing keyed by the first word of the posting window.
// Evening = 19:00–22:00 RO · Night ("Late") = 23:00–00:00 RO (per brief);
// Morning / Midday derived from their existing labels.
const WINDOW_MINUTES: Record<string, [number, number]> = {
  Morning: [7 * 60, 9 * 60],
  Midday: [11 * 60, 13 * 60],
  Evening: [19 * 60, 22 * 60],
  Night: [23 * 60, 24 * 60],
};

function roMinutesNow(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Bucharest",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0") % 24;
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}

export function PostingWindowBadge({ window }: { window: PostingWindow | "" }) {
  const first = window ? window.split(" ")[0] : "";
  const label = first === "Night" ? "Late" : first || "—";
  const range = first ? WINDOW_MINUTES[first] : undefined;

  const [active, setActive] = useState(false);

  useEffect(() => {
    function check() {
      if (!range) return setActive(false);
      const now = roMinutesNow();
      setActive(now >= range[0] && now < range[1]);
    }
    check();
    const id = setInterval(check, 30_000);
    return () => clearInterval(id);
  }, [range]);

  return (
    <span
      title={window ? `${window} · ${active ? "live now" : "outside window"} (RO time)` : "No posting window set"}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors",
        active
          ? "bg-emerald-500/15 text-emerald-300"
          : "bg-zinc-500/15 text-zinc-400"
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          active ? "bg-emerald-400 shadow-[0_0_6px_#22c55e]" : "bg-zinc-500"
        )}
      />
      {label}
    </span>
  );
}

// --- Hook scorecard chip -----------------------------------------------------

export function ScorecardChip({ video }: { video: Video }) {
  const passes = Object.values(video.hook.scorecard).filter(Boolean).length;
  const empty = passes === 0;
  const strong = passes >= 4;

  return (
    <Link
      href={`/video/${video.id}?tab=HOOK`}
      title={empty ? "No hook scorecard yet — add one" : `Hook scorecard: ${passes}/5 passing`}
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent/40",
        empty && "bg-amber-400/15 text-amber-300 hover:bg-amber-400/25",
        !empty && strong && "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25",
        !empty && !strong && "bg-amber-500/15 text-amber-300 hover:bg-amber-500/25"
      )}
    >
      {empty ? (
        "Hook?"
      ) : (
        <>
          {passes}/5
          {strong ? (
            <Check className="h-3 w-3" strokeWidth={3} />
          ) : (
            <TriangleAlert className="h-3 w-3" strokeWidth={2.5} />
          )}
        </>
      )}
    </Link>
  );
}
