"use client";

import { useEffect } from "react";
import { X, Globe, ExternalLink, Sparkles } from "lucide-react";
import { AutofillFields, ResearchSummary } from "@/lib/api";

export function ResearchSummaryModal({
  title,
  fields,
  summary,
  onApply,
  onDiscard,
}: {
  title: string;
  fields: AutofillFields;
  summary: ResearchSummary;
  onApply: (fields: AutofillFields) => void;
  onDiscard: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDiscard();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onDiscard]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onDiscard(); }}
    >
      <div
        className="flex w-full max-w-xl flex-col overflow-hidden rounded-[18px]"
        style={{
          background: "var(--surface)",
          border: "1px solid rgba(59,130,246,0.18)",
          boxShadow:
            "0 0 0 1px rgba(59,130,246,.18), 0 0 80px rgba(59,130,246,.12), 0 40px 120px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.06)",
          maxHeight: "85vh",
        }}
      >
        {/* Header */}
        <div
          className="flex shrink-0 items-start justify-between px-6 pt-5 pb-4"
          style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div>
            <div
              className="mb-1.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.2em]"
              style={{ color: "var(--blue)", fontFamily: "var(--font-mono)" }}
            >
              <Globe className="h-3 w-3" strokeWidth={2.5} />
              Research Findings
            </div>
            <h2
              className="text-base font-bold leading-snug"
              style={{ color: "var(--text)", letterSpacing: "-0.02em" }}
            >
              {title || "Untitled Idea"}
            </h2>
          </div>
          <button
            onClick={onDiscard}
            className="ml-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2"
            style={{
              background: "rgba(255,255,255,0.06)",
              color: "var(--text-muted)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.10)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.06)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            }}
            aria-label="Discard"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Findings */}
          <div
            className="rounded-xl p-4"
            style={{ background: "rgba(59,130,246,0.06)", border: "1px solid rgba(59,130,246,0.14)" }}
          >
            <p
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{ color: "var(--text-muted)" }}
            >
              {summary.findings || "No findings returned."}
            </p>
          </div>

          {/* Sources */}
          {summary.sources.length > 0 && (
            <div>
              <p
                className="mb-2.5 text-[11px] font-bold uppercase tracking-[0.2em]"
                style={{ color: "var(--text-dim)", fontFamily: "var(--font-mono)" }}
              >
                Sources
              </p>
              <ul className="space-y-1.5">
                {summary.sources.map((url, i) => (
                  <li key={i}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-sm break-all transition-colors"
                      style={{ color: "var(--blue-light)" }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.color = "var(--blue)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLAnchorElement).style.color = "var(--blue-light)";
                      }}
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" strokeWidth={2} />
                      {url}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex shrink-0 items-center justify-end gap-3 px-6 py-4"
          style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}
        >
          <button
            onClick={onDiscard}
            className="rounded-[9px] px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2"
            style={{ color: "var(--text-muted)", background: "rgba(255,255,255,0.05)" }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.09)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(255,255,255,0.05)";
              (e.currentTarget as HTMLButtonElement).style.color = "var(--text-muted)";
            }}
          >
            Discard
          </button>
          <button
            onClick={() => onApply(fields)}
            className="flex items-center gap-2 rounded-[9px] px-5 py-2 text-sm font-semibold text-white transition-[box-shadow] focus-visible:outline-none focus-visible:ring-2"
            style={{
              background: "linear-gradient(135deg, var(--blue), var(--sky))",
              boxShadow: "0 0 28px rgba(59,130,246,.40), 0 2px 8px rgba(14,165,233,.20)",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 0 52px rgba(59,130,246,.65), 0 8px 24px rgba(14,165,233,.30)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.boxShadow =
                "0 0 28px rgba(59,130,246,.40), 0 2px 8px rgba(14,165,233,.20)";
            }}
          >
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
            Apply to idea
          </button>
        </div>
      </div>
    </div>
  );
}
