"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type SaveState = "idle" | "dirty" | "saving" | "saved" | "error";

/**
 * Debounced autosave. Returns the current save state and a `schedule` fn
 * that re-arms the 800ms debounce timer with the latest value.
 */
export function useAutosave<T>(
  save: (value: T) => Promise<unknown>,
  ms = 800
) {
  const [state, setState] = useState<SaveState>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<T | null>(null);
  const saveRef = useRef(save);
  saveRef.current = save;

  const run = useCallback(async () => {
    timer.current = null; // mark timer as no longer pending so cleanup doesn't double-fire
    if (latest.current === null) return;
    const value = latest.current;
    setState("saving");
    try {
      await saveRef.current(value);
      setState("saved");
    } catch {
      setState("error");
    }
  }, []);

  const schedule = useCallback(
    (value: T) => {
      latest.current = value;
      setState("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(run, ms);
    },
    [run, ms]
  );

  // flush on unmount
  useEffect(() => {
    return () => {
      if (timer.current) {
        clearTimeout(timer.current);
        if (latest.current !== null) saveRef.current(latest.current);
      }
    };
  }, []);

  // flush immediately when the global Save button fires "app:flush-save"
  useEffect(() => {
    const onFlush = () => {
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      if (latest.current !== null) run();
    };
    window.addEventListener("app:flush-save", onFlush);
    return () => window.removeEventListener("app:flush-save", onFlush);
  }, [run]);

  return { state, schedule };
}
