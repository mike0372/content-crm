"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock, Loader2 } from "lucide-react";
import { Button, Input } from "@/components/ui/controls";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/";

  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error || "Login failed");
      }
      router.replace(next);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed");
      setBusy(false);
    }
  }

  return (
    <div className="w-full max-w-sm">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-[14px] bg-gradient-to-br from-[#3b82f6] to-[#0ea5e9] shadow-[0_0_28px_rgba(59,130,246,0.4)]">
          <Lock className="h-5 w-5 text-white" strokeWidth={2} />
        </div>
        <h1 className="text-[19px] font-bold tracking-[-0.025em] text-white">AutoPilot AI</h1>
        <p className="mt-1 text-[13px] text-zinc-500">Enter your password to continue</p>
      </div>

      <form
        onSubmit={submit}
        className="rounded-2xl border border-white/[0.06] bg-surface p-6 shadow-[0_0_0_1px_rgba(59,130,246,0.18),0_8px_30px_-12px_rgba(59,130,246,0.20),0_2px_8px_-2px_rgba(0,0,0,0.5)]"
      >
        <Input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          autoComplete="current-password"
          aria-label="Password"
        />

        {error && <p className="mt-3 text-[13px] text-rose-400">{error}</p>}

        <Button
          type="submit"
          variant="primary"
          disabled={busy || !password}
          className="mt-4 w-full"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />}
          {busy ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <Suspense>
        <LoginForm />
      </Suspense>
    </div>
  );
}
