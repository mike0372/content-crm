"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { AgentPanel } from "@/components/AgentPanel";

export function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "1") setCollapsed(true);
    setMounted(true);
  }, []);

  function toggle() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sidebar-collapsed", next ? "1" : "0");
      return next;
    });
  }

  const sidebarWidth = mounted ? (collapsed ? 56 : 232) : 232;

  // Auth pages render without the app chrome.
  if (pathname === "/login") {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <>
      <Sidebar
        collapsed={collapsed}
        onToggle={toggle}
        agentOpen={agentOpen}
        onToggleAgent={() => setAgentOpen((o) => !o)}
      />
      <main
        className="min-h-screen transition-[margin] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)]"
        style={{
          marginLeft: sidebarWidth,
          marginRight: agentOpen ? 420 : 0,
        }}
      >
        {children}
      </main>
      <AgentPanel open={agentOpen} onClose={() => setAgentOpen(false)} />
    </>
  );
}
