"use client";

import { cn } from "@/lib/utils";
import type { SyncStatus } from "@/lib/useLiveSync";

// Small "Live" status chip for page headers. Green dot = realtime polling is
// healthy; amber = the last fetch failed and we're retrying. Uses brand mono
// micro-label styling.
export function LiveIndicator({
  status,
  className,
}: {
  status: SyncStatus;
  className?: string;
}) {
  const live = status === "synced";
  return (
    <span
      title={live ? "Live — auto-syncing" : "Reconnecting to server…"}
      className={cn(
        "inline-flex select-none items-center gap-1.5 rounded-full border px-2.5 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.14em] transition-colors duration-300",
        live
          ? "border-emerald-500/25 bg-emerald-500/[0.07] text-emerald-400"
          : "border-amber-500/25 bg-amber-500/[0.07] text-amber-400",
        className
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {live && (
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400/70" />
        )}
        <span
          className={cn(
            "relative inline-flex h-1.5 w-1.5 rounded-full",
            live ? "bg-emerald-400" : "bg-amber-400"
          )}
        />
      </span>
      {live ? "Live" : "Reconnecting"}
    </span>
  );
}

// Thin connection bar pinned to the top of the viewport. Hidden while synced
// (the header dot covers the healthy state); slides down in amber when the
// connection drops, so a lost link is impossible to miss.
export function ConnectionBar({ status }: { status: SyncStatus }) {
  const down = status === "reconnecting";
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "fixed inset-x-0 top-0 z-[70] flex items-center justify-center gap-2 overflow-hidden border-b border-amber-500/20 bg-[rgba(40,28,5,0.92)] backdrop-blur-md transition-[height,opacity] duration-300",
        down ? "h-7 opacity-100" : "pointer-events-none h-0 opacity-0"
      )}
    >
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
      <span className="font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] text-amber-300">
        Reconnecting…
      </span>
    </div>
  );
}
