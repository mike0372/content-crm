"use client";

import { useEffect } from "react";
import { X, Clapperboard } from "lucide-react";
import { ContentItem, BeatLabel } from "@/lib/types";

const BEAT_COLORS: Record<
  BeatLabel,
  { bg: string; text: string; border: string; accent: string }
> = {
  HOOK: {
    bg: "#fef2f2",
    text: "#dc2626",
    border: "#fca5a5",
    accent: "#ef4444",
  },
  "RE-HOOK": {
    bg: "#fff7ed",
    text: "#c2410c",
    border: "#fdba74",
    accent: "#f97316",
  },
  DEMO: {
    bg: "#eff6ff",
    text: "#1d4ed8",
    border: "#93c5fd",
    accent: "#3b82f6",
  },
  RESULT: {
    bg: "#f0fdf4",
    text: "#15803d",
    border: "#86efac",
    accent: "#22c55e",
  },
  CTA: {
    bg: "#faf5ff",
    text: "#6d28d9",
    border: "#c4b5fd",
    accent: "#8b5cf6",
  },
};

export function FilmingScriptModal({
  item,
  onClose,
}: {
  item: ContentItem;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const beats = item.script ?? [];

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-black/70 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {/* Paper */}
      <div className="mx-auto my-10 w-full max-w-2xl rounded-2xl bg-white px-10 py-10 shadow-2xl">
        {/* Close */}
        <div className="mb-8 flex items-start justify-between">
          <div>
            <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-gray-400">
              <Clapperboard className="h-3 w-3" strokeWidth={2.5} />
              Filming Script
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">
              {item.title || "Untitled Idea"}
            </h1>
          </div>
          <button
            onClick={onClose}
            className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500 transition-colors hover:bg-gray-200 hover:text-gray-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {beats.length === 0 ? (
          <p className="italic text-gray-400">
            No script beats yet — generate a script in the editor first.
          </p>
        ) : (
          <div className="space-y-0">
            {beats.map((beat, i) => {
              const colors = BEAT_COLORS[beat.label];
              const isLast = i === beats.length - 1;
              return (
                <div key={beat.id ?? i}>
                  {/* Beat block */}
                  <div className="py-7">
                    {/* Label row */}
                    <div className="mb-4 flex items-center gap-3">
                      <span
                        className="inline-flex items-center rounded-md px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-[0.15em]"
                        style={{
                          backgroundColor: colors.bg,
                          color: colors.text,
                          border: `1.5px solid ${colors.border}`,
                        }}
                      >
                        {beat.label}
                      </span>
                      {beat.timestamp && (
                        <span className="font-mono text-sm font-medium text-gray-400">
                          {beat.timestamp}
                        </span>
                      )}
                    </div>

                    {/* Content — large, readable */}
                    <p
                      className="text-[21px] font-medium leading-[1.6] text-gray-900"
                      style={{ wordBreak: "break-word" }}
                    >
                      {beat.content ? (
                        beat.content
                      ) : (
                        <span className="italic text-gray-300">No content</span>
                      )}
                    </p>

                    {/* Retention note */}
                    {beat.retentionNote && (
                      <p className="mt-3 text-sm italic text-gray-400">
                        {beat.retentionNote}
                      </p>
                    )}
                  </div>

                  {/* Divider */}
                  {!isLast && (
                    <div
                      className="h-px w-full"
                      style={{ backgroundColor: colors.border }}
                    />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
