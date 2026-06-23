import { cn } from "@/lib/utils";
import {
  Pillar,
  Status,
  PILLAR_COLORS,
  STATUS_COLORS,
  STATUS_LABELS,
  Verdict,
} from "@/lib/types";

export function PillarBadge({ pillar, className }: { pillar: Pillar; className?: string }) {
  const c = PILLAR_COLORS[pillar];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[12px] font-medium ring-1 ring-inset",
        c.bg,
        c.text,
        c.ring,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {pillar}
    </span>
  );
}

export function StatusBadge({ status, className }: { status: Status; className?: string }) {
  const c = STATUS_COLORS[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-[3px] text-[12px] font-medium",
        c.bg,
        c.text,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", c.dot)} />
      {STATUS_LABELS[status]}
    </span>
  );
}

const VERDICT_STYLE: Record<Exclude<Verdict, "">, string> = {
  WIN: "bg-emerald-500/15 text-emerald-300",
  MEH: "bg-amber-500/15 text-amber-300",
  FLOP: "bg-rose-500/15 text-rose-300",
};

export function VerdictBadge({ verdict, className }: { verdict: Verdict; className?: string }) {
  if (!verdict)
    return (
      <span className={cn("inline-flex rounded-full bg-zinc-700/40 px-2.5 py-0.5 text-xs text-zinc-400", className)}>
        —
      </span>
    );
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold",
        VERDICT_STYLE[verdict],
        className
      )}
    >
      {verdict}
    </span>
  );
}
