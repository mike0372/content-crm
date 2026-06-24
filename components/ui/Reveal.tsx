import { cn } from "@/lib/utils";

type Variant =
  | "fade-in"
  | "fade-in-up"
  | "fade-in-down"
  | "scale-in"
  | "slide-in-left"
  | "slide-in-right"
  | "pop";

const VARIANT_CLASS: Record<Variant, string> = {
  "fade-in": "animate-fade-in",
  "fade-in-up": "animate-fade-in-up",
  "fade-in-down": "animate-fade-in-down",
  "scale-in": "animate-scale-in",
  "slide-in-left": "animate-slide-in-left",
  "slide-in-right": "animate-slide-in-right",
  pop: "animate-pop",
};

// Mount-time entrance wrapper. Pure CSS animation (no JS, no "use client"),
// so it drops into both server and client components. Stagger lists by passing
// an incrementing `index` — each item delays `index * step` ms.
export function Reveal({
  children,
  variant = "fade-in-up",
  index = 0,
  step = 60,
  delay = 0,
  className,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  variant?: Variant;
  index?: number;
  step?: number;
  delay?: number;
  className?: string;
  as?: "div" | "span" | "section" | "li" | "tr";
}) {
  const ms = delay + index * step;
  return (
    <Tag
      className={cn(VARIANT_CLASS[variant], className)}
      style={ms ? { animationDelay: `${ms}ms` } : undefined}
    >
      {children}
    </Tag>
  );
}
