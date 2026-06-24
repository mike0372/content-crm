"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ============================================================================
// Polling-based live sync. Keeps the server-only Supabase model intact (no
// browser DB access) while giving near-realtime cross-tab/device updates:
// re-fetches the server API on an interval, on window focus, and when the tab
// becomes visible again. Tracks a connection status for the "Live" indicator.
//
// `mute(ms)` suppresses *applying* fetched data for a window after a local
// mutation (optimistic DnD, autosave, delete) so polling never clobbers an
// in-flight local change. Status keeps updating while muted. The mute is also
// re-checked AFTER the fetch resolves, so a poll already in flight when the
// user starts editing still won't overwrite their change.
// ============================================================================

export type SyncStatus = "synced" | "reconnecting";

interface Options {
  /** Poll cadence in ms while the tab is visible. Default 8000. */
  intervalMs?: number;
  /** When false, polling is paused entirely. Default true. */
  enabled?: boolean;
}

interface LiveSync {
  status: SyncStatus;
  lastSyncedAt: number | null;
  /** Suppress applying fetched data for `ms` (default 4000) after a local write. */
  mute: (ms?: number) => void;
  /** Force an immediate poll. */
  refresh: () => void;
}

export function useLiveSync<T>(
  fetcher: () => Promise<T>,
  onData: (data: T) => void,
  options: Options = {}
): LiveSync {
  const { intervalMs = 8000, enabled = true } = options;

  const [status, setStatus] = useState<SyncStatus>("synced");
  const [lastSyncedAt, setLastSyncedAt] = useState<number | null>(null);

  // Keep latest callbacks in refs so the polling effect never needs to restart.
  const fetcherRef = useRef(fetcher);
  const onDataRef = useRef(onData);
  fetcherRef.current = fetcher;
  onDataRef.current = onData;

  const mutedUntil = useRef(0);
  const inFlight = useRef(false);

  const mute = useCallback((ms = 4000) => {
    mutedUntil.current = Math.max(mutedUntil.current, Date.now() + ms);
  }, []);

  const tick = useCallback(async () => {
    if (inFlight.current) return;
    if (typeof document !== "undefined" && document.hidden) return;
    inFlight.current = true;
    try {
      const data = await fetcherRef.current();
      setStatus("synced");
      setLastSyncedAt(Date.now());
      // Re-check mute at apply time: covers polls that began before a local edit.
      if (Date.now() >= mutedUntil.current) onDataRef.current(data);
    } catch {
      setStatus("reconnecting");
    } finally {
      inFlight.current = false;
    }
  }, []);

  const refresh = useCallback(() => {
    void tick();
  }, [tick]);

  useEffect(() => {
    if (!enabled) return;

    const id = setInterval(tick, intervalMs);
    const onFocus = () => void tick();
    const onVisible = () => {
      if (!document.hidden) void tick();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      clearInterval(id);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [enabled, intervalMs, tick]);

  return { status, lastSyncedAt, mute, refresh };
}
