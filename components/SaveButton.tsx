"use client";

import { useState } from "react";
import { Save, Check, Loader2, AlertCircle } from "lucide-react";
import { apiSave } from "@/lib/api";
import { cn } from "@/lib/utils";

type Status = "idle" | "saving" | "saved" | "error";

// Global Save button (sidebar). Flushes any open editor's pending autosave via
// the "app:flush-save" event, then confirms everything is committed in Supabase.
export function SaveButton({ collapsed }: { collapsed: boolean }) {
  const [status, setStatus] = useState<Status>("idle");
  const [info, setInfo] = useState("");

  async function handleSave() {
    if (status === "saving") return;
    setStatus("saving");
    // Tell every open editor to flush its debounced autosave right now.
    window.dispatchEvent(new Event("app:flush-save"));
    // Give those PUTs a moment to land before we read back.
    await new Promise((r) => setTimeout(r, 800));
    try {
      const res = await apiSave();
      const t = new Date(res.savedAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      });
      setInfo(`${res.total} items · ${t}`);
      setStatus("saved");
      setTimeout(() => setStatus("idle"), 4000);
    } catch {
      setInfo("Could not reach Supabase");
      setStatus("error");
      setTimeout(() => setStatus("idle"), 4000);
    }
  }

  const saved = status === "saved";
  const error = status === "error";

  return (
    <div className="space-y-1">
      <button
        onClick={handleSave}
        disabled={status === "saving"}
        title={collapsed ? "Save to Supabase" : undefined}
        className={cn(
          "group relative flex w-full items-center rounded-[9px] py-2 text-sm font-semibold outline-none transition-[colors,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 disabled:opacity-70",
          collapsed ? "justify-center px-0" : "gap-3 px-3",
          saved
            ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-inset ring-emerald-500/30"
            : error
            ? "bg-rose-500/15 text-rose-300 ring-1 ring-inset ring-rose-500/30"
            : "bg-gradient-to-r from-[#3b82f6] to-[#06b6d4] text-white shadow-[0_0_22px_rgba(59,130,246,0.35),0_2px_8px_rgba(14,165,233,0.18)] hover:shadow-[0_0_40px_rgba(59,130,246,0.55),0_6px_18px_rgba(14,165,233,0.28)] active:scale-[0.98]"
        )}
      >
        <span className="shrink-0">
          {status === "saving" ? (
            <Loader2 className="h-[18px] w-[18px] animate-spin" strokeWidth={1.75} />
          ) : saved ? (
            <Check className="h-[18px] w-[18px]" strokeWidth={2} />
          ) : error ? (
            <AlertCircle className="h-[18px] w-[18px]" strokeWidth={1.75} />
          ) : (
            <Save className="h-[18px] w-[18px]" strokeWidth={1.75} />
          )}
        </span>
        <span
          className="flex-1 overflow-hidden whitespace-nowrap text-left transition-[opacity,max-width] duration-200"
          style={{ opacity: collapsed ? 0 : 1, maxWidth: collapsed ? 0 : 200 }}
        >
          {status === "saving"
            ? "Saving…"
            : saved
            ? "Saved"
            : error
            ? "Save failed"
            : "Save"}
        </span>
      </button>
      {!collapsed && info && (saved || error) && (
        <p
          className={cn(
            "px-1 text-[10.5px] leading-tight",
            error ? "text-rose-400/80" : "text-zinc-500"
          )}
        >
          {info}
        </p>
      )}
    </div>
  );
}
