"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileSpreadsheet, Upload, Loader2 } from "lucide-react";
import { Card, Button } from "@/components/ui/controls";

export function DataCard() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function download(url: string) {
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const cd = res.headers.get("Content-Disposition") || "";
      const name = /filename="([^"]+)"/.exec(cd)?.[1] || "autopilot-export";
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = name;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Export failed");
    } finally {
      setBusy(false);
    }
  }

  async function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!window.confirm("Restore this backup? Items are merged by id — nothing is deleted.")) return;
    setBusy(true);
    setErr(null);
    setMsg(null);
    try {
      const bundle = JSON.parse(await file.text());
      const res = await fetch("/api/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bundle),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setMsg(`Restored ${data.content} items · ${data.calendars} weeks.`);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-zinc-200">Your data</h3>
      <p className="mt-1 text-[13px] text-zinc-500">
        Download a full backup or restore one. Daily auto-backups also run server-side.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => download("/api/export")} disabled={busy}>
          <Download className="h-3.5 w-3.5" strokeWidth={1.75} /> Export JSON
        </Button>
        <Button variant="outline" size="sm" onClick={() => download("/api/export?format=csv")} disabled={busy}>
          <FileSpreadsheet className="h-3.5 w-3.5" strokeWidth={1.75} /> Reels CSV
        </Button>
        <Button variant="subtle" size="sm" onClick={() => fileRef.current?.click()} disabled={busy}>
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />
          ) : (
            <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
          )}
          Restore
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={onImport}
        />
      </div>

      {msg && <p className="mt-3 text-[13px] text-emerald-400">{msg}</p>}
      {err && <p className="mt-3 text-[13px] text-rose-400">{err}</p>}
    </Card>
  );
}
