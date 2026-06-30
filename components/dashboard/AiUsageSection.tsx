"use client";

import { Sparkles } from "lucide-react";
import type { AiUsageSummary } from "@/lib/ai";
import { Card } from "@/components/ui/controls";
import { cn } from "@/lib/utils";

const ROUTE_LABELS: Record<string, string> = {
  agent: "Edward (agent)",
  "ideas.brainstorm": "Brainstorm",
  "ideas.autofill": "Autofill",
  "ideas.import": "Import",
  "ideas.complete": "Complete idea",
  "ideas.generate-script": "Generate script",
  "results.lesson": "Reel lesson",
};

function usd(n: number): string {
  if (n === 0) return "$0.00";
  return n < 0.01 ? "<$0.01" : `$${n.toFixed(2)}`;
}

export function AiUsageSection({ usage }: { usage: AiUsageSummary }) {
  const { costUsd, calls, byRoute, budgetUsd, overBudget } = usage;
  const pct = budgetUsd ? Math.min(100, (costUsd / budgetUsd) * 100) : 0;

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-mono text-[28px] font-bold leading-none tracking-tight text-white">
            {usd(costUsd)}
          </div>
          <div className="mt-1.5 text-[13px] text-zinc-500">
            {calls} call{calls === 1 ? "" : "s"} this month
          </div>
        </div>
        <Sparkles className="h-5 w-5 shrink-0 text-[#3b82f6]" strokeWidth={1.75} />
      </div>

      {budgetUsd !== null && (
        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[12px]">
            <span className="text-zinc-500">Monthly budget</span>
            <span className={cn("font-mono", overBudget ? "text-rose-400" : "text-zinc-400")}>
              {usd(costUsd)} / {usd(budgetUsd)}
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className={cn(
                "h-full rounded-full",
                overBudget ? "bg-rose-500" : "bg-gradient-to-r from-[#3b82f6] to-[#0ea5e9]"
              )}
              style={{ width: `${pct}%` }}
            />
          </div>
          {overBudget && (
            <p className="mt-2 text-[12px] text-rose-400">
              Budget reached — AI calls pause until next month or until you raise the cap.
            </p>
          )}
        </div>
      )}

      {byRoute.length > 0 && (
        <div className="mt-4 space-y-1.5 border-t border-white/[0.06] pt-4">
          {byRoute.slice(0, 5).map((r) => (
            <div key={r.route} className="flex items-center justify-between text-[13px]">
              <span className="text-zinc-400">{ROUTE_LABELS[r.route] ?? r.route}</span>
              <span className="font-mono text-zinc-500">{usd(r.costUsd)}</span>
            </div>
          ))}
        </div>
      )}

      {calls === 0 && (
        <p className="mt-4 border-t border-white/[0.06] pt-4 text-[13px] text-zinc-600">
          No AI usage yet this month.
        </p>
      )}
    </Card>
  );
}
