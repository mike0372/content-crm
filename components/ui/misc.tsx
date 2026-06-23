"use client";

import { useState } from "react";
import { Check, Copy, Cloud, CloudOff, Loader2 } from "lucide-react";
import { SaveState } from "@/lib/useAutosave";
import { cn } from "@/lib/utils";

export function SaveIndicator({ state }: { state: SaveState }) {
  const map: Record<SaveState, { icon: React.ReactNode; label: string; cls: string }> = {
    idle: { icon: <Cloud className="h-3.5 w-3.5" strokeWidth={1.75} />, label: "All changes saved", cls: "text-zinc-500" },
    dirty: { icon: <Loader2 className="h-3.5 w-3.5" strokeWidth={1.75} />, label: "Editing…", cls: "text-zinc-500" },
    saving: { icon: <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />, label: "Saving…", cls: "text-[#3b82f6]" },
    saved: { icon: <Check className="h-3.5 w-3.5" strokeWidth={1.75} />, label: "Saved", cls: "text-emerald-400" },
    error: { icon: <CloudOff className="h-3.5 w-3.5" strokeWidth={1.75} />, label: "Save failed", cls: "text-rose-400" },
  };
  const m = map[state];
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs font-medium", m.cls)}>
      {m.icon}
      {m.label}
    </span>
  );
}

export function CopyButton({
  text,
  label = "Copy",
  className,
}: {
  text: string;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          /* ignore */
        }
      }}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[9px] border border-white/10 bg-white/[0.03] px-2.5 py-1.5 text-xs font-medium text-zinc-300 outline-none transition-colors hover:bg-white/[0.08] focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 active:scale-[0.98]",
        className
      )}
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-emerald-400" strokeWidth={1.75} />
      ) : (
        <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
      )}
      {copied ? "Copied" : label}
    </button>
  );
}
