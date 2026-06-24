"use client";

import { useCallback, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// Minimal transient error toast for failed writes (e.g. drag-and-drop sync
// failures). One message at a time, auto-dismisses.
export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((msg: string, ms = 4000) => {
    setMessage(msg);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), ms);
  }, []);

  return { message, show };
}

export function Toast({ message }: { message: string | null }) {
  return (
    <div
      className={cn(
        "fixed bottom-[5.5rem] left-1/2 z-[65] -translate-x-1/2 transition-[opacity,transform] duration-300",
        message
          ? "translate-y-0 opacity-100"
          : "pointer-events-none translate-y-3 opacity-0"
      )}
    >
      <div className="flex items-center gap-2.5 rounded-2xl border border-rose-500/25 bg-[rgba(22,8,8,0.9)] px-4 py-3 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.7),0_0_0_1px_rgba(255,255,255,0.04)] backdrop-blur-xl">
        <AlertTriangle className="h-4 w-4 text-rose-400" strokeWidth={2} />
        <span className="text-sm text-rose-100">{message ?? ""}</span>
      </div>
    </div>
  );
}
