"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Bot, Lock, Loader2 } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const rawNext = params.get("next") || "/";
  // Only same-origin relative paths — never an absolute/protocol-relative URL.
  const next = rawNext.startsWith("/") && !rawNext.startsWith("//") ? rawNext : "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: password }),
      });
      if (res.ok) {
        router.replace(next);
        router.refresh();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error || "Invalid key");
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center px-6">
      <form
        onSubmit={submit}
        className="w-full max-w-[380px] rounded-[18px] border border-white/[0.08] bg-[#111111]/80 p-8 backdrop-blur-xl shadow-[0_0_0_1px_rgba(59,130,246,0.18),0_0_80px_rgba(59,130,246,0.12),0_40px_120px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.06)]"
      >
        <div className="mb-7 flex flex-col items-center text-center">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-gradient-to-br from-[#3b82f6] to-[#06b6d4] shadow-[0_0_28px_rgba(59,130,246,0.45)]">
            <Bot className="h-6 w-6 text-white" strokeWidth={1.75} />
          </div>
          <h1 className="mt-4 text-[19px] font-bold tracking-tight text-white">
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
          </h1>
          <p className="mt-1 font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#3b82f6]">
            Content Studio
          </p>
        </div>

        <label className="mb-2 block font-mono text-[10.5px] font-bold uppercase tracking-[0.18em] text-zinc-500">
          Access key
        </label>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600" strokeWidth={1.75} />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoFocus
            autoComplete="off"
            spellCheck={false}
            placeholder="AP-XXXXX-XXXXX-XXXXX-XXXXX"
            className="w-full rounded-[9px] border border-white/[0.08] bg-[#1a1a1a] py-2.5 pl-9 pr-3 text-sm text-zinc-100 outline-none transition-[border-color,box-shadow] duration-200 placeholder:text-zinc-600 focus-visible:border-[#3b82f6]/60 focus-visible:ring-2 focus-visible:ring-[#3b82f6]/30"
          />
        </div>

        {error && (
          <p className="mt-3 text-[12.5px] text-[#ef4444]">{error}</p>
        )}

        <button
          type="submit"
          disabled={busy || !password}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-[9px] bg-gradient-to-br from-[#3b82f6] to-[#0ea5e9] py-2.5 text-sm font-semibold text-white shadow-[0_0_28px_rgba(59,130,246,0.40),0_2px_8px_rgba(14,165,233,0.20)] outline-none transition-[box-shadow,transform] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:shadow-[0_0_52px_rgba(59,130,246,0.65),0_8px_24px_rgba(14,165,233,0.30)] focus-visible:ring-2 focus-visible:ring-[#3b82f6]/50 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} /> : null}
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <LoginForm />
    </Suspense>
  );
}
