import { cn } from "@/lib/utils";

// Static, GPU-cheap page backdrop. Layered radial "orbs" over a dark base —
// no animation, no SVG filters. Replaces the old animated gradient that
// re-rastered the viewport every frame.
export function StaticBackground({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "fixed inset-0 -z-10 pointer-events-none overflow-hidden",
        className
      )}
      style={{
        background:
          "radial-gradient(60% 50% at 18% 12%, rgba(59,130,246,0.18), transparent 60%)," +
          "radial-gradient(55% 45% at 85% 18%, rgba(6,182,212,0.14), transparent 60%)," +
          "radial-gradient(70% 60% at 60% 100%, rgba(37,99,235,0.16), transparent 65%)," +
          "linear-gradient(180deg, #060d18 0%, #04080f 100%)",
      }}
    />
  );
}
