"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

export const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { elevated?: boolean }
>(({ className, elevated, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-xl border border-white/[0.06] bg-surface",
      elevated
        ? "shadow-[0_0_0_1px_rgba(59,130,246,0.18),0_8px_30px_-12px_rgba(59,130,246,0.20),0_2px_8px_-2px_rgba(0,0,0,0.5)]"
        : "shadow-[0_1px_3px_rgba(0,0,0,0.4)]",
      className
    )}
    {...props}
  />
));
Card.displayName = "Card";

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn(
        "mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-zinc-500",
        className
      )}
      {...props}
    />
  );
}

const inputBase =
  "w-full rounded-[9px] border border-white/[0.07] bg-base px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 outline-none transition-[border-color,box-shadow] duration-150 focus-visible:border-[#3b82f6]/50 focus-visible:ring-2 focus-visible:ring-[#3b82f6]/20";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input ref={ref} className={cn(inputBase, className)} {...props} />
  )
);
Input.displayName = "Input";

export const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea ref={ref} className={cn(inputBase, "min-h-[80px] resize-y leading-relaxed", className)} {...props} />
));
Textarea.displayName = "Textarea";

export const Select = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(inputBase, "cursor-pointer appearance-none bg-[length:0.7rem] bg-[right_0.7rem_center] bg-no-repeat pr-9", className)}
    style={{
      backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2371717a' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E\")",
    }}
    {...props}
  >
    {children}
  </select>
));
Select.displayName = "Select";

type ButtonVariant = "primary" | "ghost" | "outline" | "subtle";
type ButtonSize = "sm" | "md";

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-[#3b82f6] to-[#0ea5e9] text-white shadow-[0_0_28px_rgba(59,130,246,0.40),0_2px_8px_rgba(14,165,233,0.20)] hover:shadow-[0_0_52px_rgba(59,130,246,0.65),0_8px_24px_rgba(14,165,233,0.30)] active:scale-[0.98]",
  outline:
    "border border-white/10 bg-white/[0.02] text-zinc-200 hover:bg-white/[0.06] hover:border-white/20 active:scale-[0.98]",
  ghost: "text-zinc-300 hover:bg-white/[0.06] hover:text-white active:scale-[0.98]",
  subtle: "bg-white/[0.06] text-zinc-200 hover:bg-white/[0.1] active:scale-[0.98]",
};

const sizes: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
};

export const Button = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: ButtonVariant;
    size?: ButtonSize;
  }
>(({ className, variant = "outline", size = "md", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex select-none items-center justify-center whitespace-nowrap rounded-[9px] font-semibold outline-none transition-[transform,background-color,border-color,color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40 disabled:pointer-events-none disabled:opacity-50",
      variants[variant],
      sizes[size],
      className
    )}
    {...props}
  />
));
Button.displayName = "Button";

export function Chip({
  active,
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors duration-150 outline-none focus-visible:ring-2 focus-visible:ring-accent/40",
        active
          ? "bg-accent/20 text-accent-foreground ring-1 ring-inset ring-accent/40"
          : "bg-white/[0.04] text-zinc-400 hover:bg-white/[0.08] hover:text-zinc-200",
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
