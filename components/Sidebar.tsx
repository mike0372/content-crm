"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  BarChart3,
  Lightbulb,
  Bot,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Home,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { SaveButton } from "@/components/SaveButton";

const NAV = [
  { href: "/", label: "Overview", icon: Home, hint: "Dashboard" },
  { href: "/board", label: "Board", icon: LayoutDashboard, hint: "Kanban pipeline" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, hint: "Weekly grid" },
  { href: "/performance", label: "Performance", icon: BarChart3, hint: "Analyzed reels" },
  { href: "/ideas", label: "Ideas", icon: Lightbulb, hint: "Idea bank" },
];

export function Sidebar({
  collapsed,
  onToggle,
  agentOpen,
  onToggleAgent,
}: {
  collapsed: boolean;
  onToggle: () => void;
  agentOpen?: boolean;
  onToggleAgent?: () => void;
}) {
  const pathname = usePathname();

  return (
    <aside
      style={{ width: collapsed ? 56 : 232 }}
      className="fixed inset-y-0 left-0 z-30 flex flex-col border-r border-white/[0.09] bg-[rgba(9,24,40,0.45)] backdrop-blur-[40px] backdrop-saturate-[180%] shadow-[inset_-1px_0_0_rgba(255,255,255,0.05)] transition-[width] duration-300 overflow-hidden"
    >
      {/* Logo */}
      <div className="group flex h-16 shrink-0 items-center gap-2.5 px-[10px]">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] shadow-[0_0_28px_rgba(59,130,246,0.45),0_4px_14px_-2px_rgba(59,130,246,0.30)] transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:scale-105 group-hover:rotate-3">
          <Bot className="h-5 w-5 text-white" strokeWidth={1.75} />
        </div>
        <div
          className="leading-tight overflow-hidden transition-[opacity,width] duration-200"
          style={{ opacity: collapsed ? 0 : 1, width: collapsed ? 0 : "auto" }}
        >
          <div className="whitespace-nowrap text-[15px] font-bold tracking-tight text-white">
            AutoPilot{" "}
            <span
              style={{
                background: "linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              AI
            </span>
          </div>
          <div className="whitespace-nowrap font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#3b82f6]">
            Content Studio
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 px-[6px] py-2">
        <div
          className="overflow-hidden transition-[opacity,max-height] duration-200 px-2 pb-2 pt-3 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#3b82f6]"
          style={{ opacity: collapsed ? 0 : 1, maxHeight: collapsed ? 0 : 40 }}
        >
          Pipeline
        </div>
        {NAV.map(({ href, label, icon: Icon, hint }, i) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              title={collapsed ? label : hint}
              style={{ animationDelay: `${i * 55}ms` }}
              className={cn(
                "group relative flex animate-slide-in-left items-center rounded-[9px] py-2 text-sm font-medium outline-none transition-[colors,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:translate-x-0.5 focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40",
                collapsed ? "justify-center px-0" : "gap-3 px-3",
                active
                  ? "bg-[#3b82f6]/12 text-white"
                  : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
              )}
            >
              {active && !collapsed && (
                <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 animate-scale-in rounded-r-full bg-[#3b82f6]" />
              )}
              {active && collapsed && (
                <span className="absolute bottom-1 left-1/2 h-[3px] w-4 -translate-x-1/2 animate-scale-in rounded-full bg-[#3b82f6]" />
              )}
              <Icon
                className={cn(
                  "icon-pop h-[18px] w-[18px] shrink-0 transition-[color,transform]",
                  active ? "text-[#3b82f6]" : "text-zinc-500 group-hover:text-zinc-300"
                )}
                strokeWidth={1.75}
              />
              <span
                className="flex-1 overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-200"
                style={{ opacity: collapsed ? 0 : 1, maxWidth: collapsed ? 0 : 200 }}
              >
                {label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* AI Agent section */}
      {onToggleAgent && (
        <div className="px-[6px] pb-2">
          <div
            className="overflow-hidden transition-[opacity,max-height] duration-200 px-2 pb-2 pt-3 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#06b6d4]"
            style={{ opacity: collapsed ? 0 : 1, maxHeight: collapsed ? 0 : 40 }}
          >
            Assistant
          </div>
          <button
            onClick={onToggleAgent}
            title={collapsed ? "AI Agent" : undefined}
            className={cn(
              "group relative flex w-full items-center rounded-[9px] py-2 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[#06b6d4]/40",
              collapsed ? "justify-center px-0" : "gap-3 px-3",
              agentOpen
                ? "bg-[#06b6d4]/12 text-white"
                : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
            )}
          >
            {agentOpen && !collapsed && (
              <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-[#06b6d4]" />
            )}
            {agentOpen && collapsed && (
              <span className="absolute bottom-1 left-1/2 h-[3px] w-4 -translate-x-1/2 rounded-full bg-[#06b6d4]" />
            )}
            <div className="relative shrink-0">
              <Sparkles
                className={cn(
                  "h-[18px] w-[18px] transition-colors",
                  agentOpen ? "text-[#06b6d4]" : "text-zinc-500 group-hover:text-zinc-300"
                )}
                strokeWidth={1.75}
              />
              {agentOpen && (
                <span className="absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-[#06b6d4] animate-pulse shadow-[0_0_6px_rgba(6,182,212,0.8)]" />
              )}
            </div>
            <span
              className="flex-1 overflow-hidden whitespace-nowrap text-left transition-[opacity,max-width] duration-200"
              style={{ opacity: collapsed ? 0 : 1, maxWidth: collapsed ? 0 : 200 }}
            >
              AI Agent
            </span>
          </button>
        </div>
      )}

      {/* Global save */}
      <div className="px-[6px] pb-1 pt-1">
        <SaveButton collapsed={collapsed} />
      </div>

      {/* Help link */}
      <div className="px-[6px] pb-2">
        <Link
          href="/help"
          title={collapsed ? "Help" : "How this CRM works"}
          className={cn(
            "group relative flex items-center rounded-[9px] py-2 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40",
            collapsed ? "justify-center px-0" : "gap-3 px-3",
            pathname === "/help" || pathname.startsWith("/help/")
              ? "bg-[#3b82f6]/12 text-white"
              : "text-zinc-400 hover:bg-white/[0.05] hover:text-zinc-100"
          )}
        >
          <HelpCircle
            className={cn(
              "h-[18px] w-[18px] shrink-0 transition-colors",
              pathname === "/help" ? "text-[#3b82f6]" : "text-zinc-500 group-hover:text-zinc-300"
            )}
            strokeWidth={1.75}
          />
          <span
            className="flex-1 overflow-hidden whitespace-nowrap transition-[opacity,max-width] duration-200"
            style={{ opacity: collapsed ? 0 : 1, maxWidth: collapsed ? 0 : 200 }}
          >
            Help
          </span>
        </Link>
      </div>

      {/* Bottom card */}
      <div
        className="border-t border-white/[0.06] p-4 transition-[opacity,max-height] duration-200 overflow-hidden"
        style={{ opacity: collapsed ? 0 : 1, maxHeight: collapsed ? 0 : 120 }}
      >
        <div className="rounded-xl bg-gradient-to-br from-[#3b82f6]/10 to-[#06b6d4]/5 p-3 ring-1 ring-inset ring-[#3b82f6]/20 shadow-[0_0_0_1px_rgba(59,130,246,0.10),inset_0_1px_0_rgba(255,255,255,0.04)]">
          <p className="text-xs font-semibold text-zinc-200">Synced to Supabase</p>
          <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
            All data lives in your <code className="text-[#60a5fa]/80">Supabase</code> Postgres database.
          </p>
        </div>
      </div>

      {/* Toggle button — rides the right edge */}
      <button
        onClick={onToggle}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute right-0 top-[68px] translate-x-1/2 z-10 flex h-[22px] w-[22px] items-center justify-center rounded-full border border-white/30 bg-[rgba(15,28,50,1)] text-zinc-200 shadow-[0_0_0_3px_rgba(9,24,40,0.7),0_3px_10px_rgba(0,0,0,0.6)] transition-[colors,box-shadow] duration-150 hover:border-[#3b82f6]/70 hover:text-[#3b82f6] hover:shadow-[0_0_0_3px_rgba(9,24,40,0.7),0_3px_10px_rgba(0,0,0,0.6),0_0_10px_rgba(59,130,246,0.25)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/50 active:scale-95"
      >
        {collapsed ? (
          <ChevronRight className="h-3 w-3" strokeWidth={2.5} />
        ) : (
          <ChevronLeft className="h-3 w-3" strokeWidth={2.5} />
        )}
      </button>
    </aside>
  );
}
