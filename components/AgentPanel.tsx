"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import {
  X, Send, Sparkles, RotateCcw, CheckCircle2, XCircle, Loader2,
  BookmarkPlus, BookmarkCheck, History, Trash2, MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ---- Types ------------------------------------------------------------------

type Role = "user" | "assistant";

interface DiffData {
  description: string;
  entityType: "video" | "idea" | "calendar";
  entityLabel: string;
  before: Record<string, unknown>;
  after: Record<string, unknown>;
  action: Record<string, unknown>;
}

interface AgentResponse {
  type: "question" | "diff" | "message";
  content: string;
  diff?: DiffData;
}

interface Message {
  role: Role;
  content: string;
  agentType?: "question" | "diff" | "message";
  diff?: DiffData;
  diffStatus?: "pending" | "approved" | "rejected" | "applying" | "done";
  greeting?: boolean; // display-only opener — excluded from API history
}

interface ConvoMeta {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
}

// ---- Helpers ----------------------------------------------------------------

function renderMarkdown(text: string) {
  return text.split("\n").map((line, li) => (
    <Fragment key={li}>
      {li > 0 && <br />}
      {line.split(/\*\*(.+?)\*\*/g).map((part, pi) =>
        pi % 2 === 1 ? <strong key={pi}>{part}</strong> : part
      )}
    </Fragment>
  ));
}

function renderValue(val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "object") return JSON.stringify(val, null, 2);
  return String(val);
}

function flattenDiff(
  before: Record<string, unknown>,
  after: Record<string, unknown>
) {
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return keys.map((k) => ({ key: k, before: before[k], after: after[k] }));
}

function formatRelativeDate(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---- DiffCard ---------------------------------------------------------------

function DiffCard({
  diff,
  status,
  onApprove,
  onReject,
}: {
  diff: DiffData;
  status: "pending" | "approved" | "rejected" | "applying" | "done";
  onApprove: () => void;
  onReject: () => void;
}) {
  const rows = flattenDiff(diff.before, diff.after);

  return (
    <div className="mt-1 animate-scale-in rounded-xl overflow-hidden border border-white/[0.08] bg-[rgba(9,18,32,0.70)] shadow-[0_4px_24px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-2 border-b border-white/[0.07] px-4 py-2.5 bg-white/[0.025]">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#3b82f6]">
          Proposed change
        </span>
        <span className="ml-auto text-[11px] text-zinc-500">{diff.entityLabel}</span>
      </div>

      <div className="divide-y divide-white/[0.05] px-4 py-1">
        {rows.map(({ key, before, after }) => (
          <div key={key} className="py-2.5 text-[12px]">
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">
              {key}
            </div>
            <div className="flex gap-2">
              <div className="flex-1 rounded-md bg-red-500/8 px-2.5 py-1.5 font-mono text-red-300/80 ring-1 ring-red-500/15 break-all whitespace-pre-wrap">
                {renderValue(before)}
              </div>
              <div className="flex items-center text-zinc-600 text-[10px]">→</div>
              <div className="flex-1 rounded-md bg-emerald-500/8 px-2.5 py-1.5 font-mono text-emerald-300/80 ring-1 ring-emerald-500/15 break-all whitespace-pre-wrap">
                {renderValue(after)}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="border-t border-white/[0.07] px-4 py-3 bg-white/[0.015]">
        {status === "pending" && (
          <div className="flex gap-2">
            <button
              onClick={onApprove}
              className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-[12px] font-semibold text-emerald-300 ring-1 ring-emerald-500/25 transition-colors hover:bg-emerald-500/25 hover:text-emerald-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400/50 active:scale-[0.98]"
            >
              <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
              Apply change
            </button>
            <button
              onClick={onReject}
              className="flex items-center justify-center gap-1.5 rounded-lg bg-zinc-700/40 px-3 py-1.5 text-[12px] font-semibold text-zinc-400 ring-1 ring-white/10 transition-colors hover:bg-zinc-700/60 hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/40 active:scale-[0.98]"
            >
              <XCircle className="h-3.5 w-3.5" strokeWidth={2} />
              Cancel
            </button>
          </div>
        )}
        {status === "applying" && (
          <div className="flex items-center gap-2 text-[12px] text-zinc-400">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[#3b82f6]" />
            Applying…
          </div>
        )}
        {status === "done" && (
          <div className="flex items-center gap-2 text-[12px] text-emerald-400">
            <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2} />
            Change applied
          </div>
        )}
        {status === "rejected" && (
          <div className="flex items-center gap-2 text-[12px] text-zinc-500">
            <XCircle className="h-3.5 w-3.5" strokeWidth={2} />
            Cancelled
          </div>
        )}
      </div>
    </div>
  );
}

// ---- ChatBubble -------------------------------------------------------------

function ChatBubble({
  msg,
  onApprove,
  onReject,
}: {
  msg: Message;
  onApprove: () => void;
  onReject: () => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="flex animate-fade-in-up justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-[#3b82f6]/15 px-4 py-2.5 text-[13px] text-zinc-100 ring-1 ring-[#3b82f6]/20">
          {msg.content}
        </div>
      </div>
    );
  }

  return (
    <div className="flex animate-fade-in-up flex-col gap-1">
      <div className="flex items-start gap-2">
        <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] shadow-[0_0_12px_rgba(59,130,246,0.35)]">
          <Sparkles className="h-3 w-3 text-white" strokeWidth={2} />
        </div>
        <div
          className={cn(
            "max-w-[88%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-[13px] leading-relaxed",
            msg.agentType === "question"
              ? "bg-[rgba(59,130,246,0.08)] text-zinc-200 ring-1 ring-[#3b82f6]/15"
              : "bg-white/[0.055] text-zinc-200 ring-1 ring-white/[0.07]"
          )}
        >
          {renderMarkdown(msg.content)}
        </div>
      </div>
      {msg.agentType === "diff" && msg.diff && (
        <div className="ml-8">
          <DiffCard
            diff={msg.diff}
            status={msg.diffStatus ?? "pending"}
            onApprove={onApprove}
            onReject={onReject}
          />
        </div>
      )}
    </div>
  );
}

// ---- Conversations history overlay ------------------------------------------

function ConversationsOverlay({
  convos,
  loading,
  deletingId,
  onClose,
  onLoad,
  onDelete,
}: {
  convos: ConvoMeta[];
  loading: boolean;
  deletingId: string | null;
  onClose: () => void;
  onLoad: (id: string) => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
}) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col bg-[rgba(9,14,26,0.97)] animate-fade-in">
      {/* Header */}
      <div className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-white/[0.08] px-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#3b82f6]/10 ring-1 ring-[#3b82f6]/20">
          <History className="h-3.5 w-3.5 text-[#3b82f6]" strokeWidth={1.75} />
        </div>
        <div className="leading-tight">
          <div className="text-[13px] font-bold text-white">Saved Conversations</div>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-zinc-500">
            {convos.length} saved
          </div>
        </div>
        <button
          onClick={onClose}
          title="Back to chat"
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40"
        >
          <X className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
        {loading && (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-zinc-600" />
          </div>
        )}

        {!loading && convos.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-6">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.03] ring-1 ring-white/[0.07] mb-5">
              <MessageSquare className="h-6 w-6 text-zinc-700" strokeWidth={1.5} />
            </div>
            <p className="text-[14px] font-semibold text-zinc-300">No saved conversations</p>
            <p className="mt-2 text-[12px] leading-relaxed text-zinc-600">
              Use the bookmark icon in the header to save your current chat with Edward.
            </p>
          </div>
        )}

        {!loading &&
          convos.map((c) => (
            <button
              key={c.id}
              onClick={() => onLoad(c.id)}
              className="group w-full flex items-center gap-3 rounded-xl px-4 py-3.5 text-left bg-white/[0.03] ring-1 ring-white/[0.06] hover:bg-white/[0.06] hover:ring-[#3b82f6]/25 transition-[background,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40"
            >
              {/* Icon */}
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-[#3b82f6]/10 ring-1 ring-[#3b82f6]/15 group-hover:bg-[#3b82f6]/15 transition-colors">
                <MessageSquare className="h-4 w-4 text-[#3b82f6]" strokeWidth={1.75} />
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-medium text-zinc-200 truncate leading-tight">
                  {c.title}
                </div>
                <div className="mt-1 flex items-center gap-1.5 text-[11px] text-zinc-600">
                  <span>{c.message_count} messages</span>
                  <span className="text-zinc-700">·</span>
                  <span>{formatRelativeDate(c.updated_at)}</span>
                </div>
              </div>

              {/* Delete */}
              <button
                onClick={(e) => onDelete(c.id, e)}
                title="Delete"
                className="flex-shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-zinc-700 opacity-0 group-hover:opacity-100 transition-[opacity,background,color] duration-150 hover:bg-[#ef4444]/12 hover:text-[#ef4444] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ef4444]/40"
              >
                {deletingId === c.id ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                )}
              </button>
            </button>
          ))}
      </div>
    </div>
  );
}

// ---- Main component ---------------------------------------------------------

export function AgentPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [greetingPending, setGreetingPending] = useState(false);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [convos, setConvos] = useState<ConvoMeta[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasUserMessages = messages.some((m) => m.role === "user");

  // Scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading, greetingPending]);

  // Focus input when panel opens
  useEffect(() => {
    if (open) textareaRef.current?.focus();
  }, [open]);

  // Auto-greet on mount
  useEffect(() => {
    void fetchGreeting();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function fetchGreeting() {
    setGreetingPending(true);
    try {
      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: "__greet__" }],
          greeting: true,
        }),
      });
      const data: AgentResponse = await res.json();
      setMessages((prev) => {
        if (prev.some((m) => m.role === "user")) return prev; // user already started
        return [{ role: "assistant", content: data.content, agentType: data.type, greeting: true }];
      });
    } catch {
      setMessages((prev) => {
        if (prev.some((m) => m.role === "user")) return prev;
        return [{ role: "assistant", content: "Ready, Sir.", agentType: "message", greeting: true }];
      });
    } finally {
      setGreetingPending(false);
    }
  }

  // Fetch history when overlay opens
  useEffect(() => {
    if (!historyOpen) return;
    setLoadingHistory(true);
    fetch("/api/agent/conversations")
      .then((r) => r.json())
      .then((d) => setConvos(Array.isArray(d) ? d : []))
      .catch(() => setConvos([]))
      .finally(() => setLoadingHistory(false));
  }, [historyOpen]);

  // ---- Conversation save/load/delete ----------------------------------------

  async function saveConversation() {
    if (!hasUserMessages || savedFlash) return;
    const firstUser = messages.find((m) => m.role === "user");
    if (!firstUser) return;
    const raw = firstUser.content;
    const title = raw.length > 60 ? raw.slice(0, 60) + "…" : raw;
    await fetch("/api/agent/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, messages }),
    });
    setSavedFlash(true);
    setTimeout(() => setSavedFlash(false), 1800);
  }

  async function loadConversation(id: string) {
    const res = await fetch(`/api/agent/conversations/${id}`);
    const data = await res.json();
    const loaded: Message[] = (data.messages as Message[]).map((m) => ({
      ...m,
      // Pending diffs from history can't be re-applied
      diffStatus: m.diffStatus === "pending" ? "rejected" : m.diffStatus,
    }));
    setMessages(loaded);
    setHistoryOpen(false);
  }

  async function deleteConversation(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setDeletingId(id);
    await fetch(`/api/agent/conversations/${id}`, { method: "DELETE" });
    setConvos((prev) => prev.filter((c) => c.id !== id));
    setDeletingId(null);
  }

  // ---- Chat -----------------------------------------------------------------

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    try {
      const apiMessages = next
        .filter((m) => !m.greeting && (m.role === "user" || (m.role === "assistant" && m.content)))
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: apiMessages }),
      });

      const data: AgentResponse = await res.json();

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.content,
          agentType: data.type,
          diff: data.diff,
          diffStatus: data.type === "diff" ? "pending" : undefined,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Something went wrong. Please try again.",
          agentType: "message",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(msgIndex: number) {
    const msg = messages[msgIndex];
    if (!msg.diff) return;

    setMessages((prev) =>
      prev.map((m, i) => (i === msgIndex ? { ...m, diffStatus: "applying" } : m))
    );

    try {
      await fetch("/api/agent/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: msg.diff.action }),
      });

      setMessages((prev) =>
        prev.map((m, i) => (i === msgIndex ? { ...m, diffStatus: "done" } : m))
      );

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: `Done! **${msg.diff!.description}** has been applied. Is there anything else you'd like to change?`,
          agentType: "message",
        },
      ]);
    } catch {
      setMessages((prev) =>
        prev.map((m, i) => (i === msgIndex ? { ...m, diffStatus: "pending" } : m))
      );
    }
  }

  function handleReject(msgIndex: number) {
    setMessages((prev) =>
      prev.map((m, i) => (i === msgIndex ? { ...m, diffStatus: "rejected" } : m))
    );
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "No problem — change cancelled. What would you like to do instead?",
        agentType: "message",
      },
    ]);
  }

  function handleReset() {
    setMessages([]);
    setInput("");
    void fetchGreeting();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  // ---- Render ---------------------------------------------------------------

  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/20 backdrop-blur-[2px] lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          "fixed inset-y-0 right-0 z-40 flex w-[420px] flex-col border-l border-white/[0.09] bg-[rgba(9,16,32,0.72)] backdrop-blur-[48px] backdrop-saturate-[160%] shadow-[-8px_0_40px_rgba(0,0,0,0.4)] transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] overflow-hidden",
          open ? "translate-x-0" : "translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-white/[0.08] px-5">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] shadow-[0_0_18px_rgba(59,130,246,0.40)]">
            <Sparkles className="h-3.5 w-3.5 text-white" strokeWidth={2} />
          </div>
          <div className="leading-tight">
            <div className="text-[13px] font-bold text-white">Edward</div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#06b6d4]">
              AI Assistant · Full DB access
            </div>
          </div>

          <div className="ml-auto flex items-center gap-1">
            {/* Save conversation */}
            <button
              onClick={saveConversation}
              disabled={!hasUserMessages}
              title={savedFlash ? "Saved!" : "Save conversation"}
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-md transition-[color,background] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40",
                savedFlash
                  ? "text-[#22c55e]"
                  : "text-zinc-500 hover:bg-white/[0.06] hover:text-zinc-300 disabled:opacity-25 disabled:cursor-not-allowed"
              )}
            >
              {savedFlash ? (
                <BookmarkCheck className="h-3.5 w-3.5" strokeWidth={2} />
              ) : (
                <BookmarkPlus className="h-3.5 w-3.5" strokeWidth={2} />
              )}
            </button>

            {/* History */}
            <button
              onClick={() => setHistoryOpen(true)}
              title="Saved conversations"
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40"
            >
              <History className="h-3.5 w-3.5" strokeWidth={2} />
            </button>

            {/* New chat */}
            <button
              onClick={handleReset}
              title="New conversation"
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40"
            >
              <RotateCcw className="h-3.5 w-3.5" strokeWidth={2} />
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              title="Close"
              className="flex h-7 w-7 items-center justify-center rounded-md text-zinc-500 transition-colors hover:bg-white/[0.06] hover:text-zinc-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/40"
            >
              <X className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 scroll-smooth">
          {messages.map((msg, i) => (
            <ChatBubble
              key={i}
              msg={msg}
              onApprove={() => handleApprove(i)}
              onReject={() => handleReject(i)}
            />
          ))}

          {(loading || greetingPending) && (
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] shadow-[0_0_12px_rgba(59,130,246,0.35)]">
                <Sparkles className="h-3 w-3 text-white" strokeWidth={2} />
              </div>
              <div className="flex items-center gap-1.5 rounded-2xl rounded-tl-sm bg-white/[0.055] px-4 py-3 ring-1 ring-white/[0.07]">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400 animate-bounce" />
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="flex-shrink-0 border-t border-white/[0.08] p-4">
          <div className="flex items-end gap-2 rounded-xl bg-white/[0.04] px-4 py-2.5 ring-1 ring-white/[0.08] focus-within:ring-[#3b82f6]/35 transition-shadow">
            <textarea
              ref={textareaRef}
              rows={1}
              value={input}
              onChange={(e) => {
                setInput(e.target.value);
                e.target.style.height = "auto";
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask Edward anything…"
              className="flex-1 resize-none bg-transparent text-[13px] text-zinc-200 placeholder-zinc-600 outline-none leading-relaxed"
              style={{ maxHeight: 120 }}
              disabled={loading}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="mb-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-[#3b82f6] text-white shadow-[0_0_12px_rgba(59,130,246,0.35)] transition-opacity disabled:opacity-30 hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#3b82f6]/60 active:scale-[0.95]"
            >
              <Send className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
          <p className="mt-2 text-center font-mono text-[10px] text-zinc-600">
            Enter to send · Shift+Enter for new line
          </p>
        </div>

        {/* Saved conversations overlay */}
        {historyOpen && (
          <ConversationsOverlay
            convos={convos}
            loading={loadingHistory}
            deletingId={deletingId}
            onClose={() => setHistoryOpen(false)}
            onLoad={loadConversation}
            onDelete={deleteConversation}
          />
        )}
      </aside>
    </>
  );
}
