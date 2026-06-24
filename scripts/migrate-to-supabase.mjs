// One-time migration: local /data JSON files -> Supabase.
// Usage: node scripts/migrate-to-supabase.mjs
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const DATA = path.join(ROOT, "data");

// --- load .env.local manually (node doesn't read it) ---
async function loadEnv() {
  const raw = await fs.readFile(path.join(ROOT, ".env.local"), "utf8").catch(() => "");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fs.readFile(file, "utf8"));
  } catch {
    return fallback;
  }
}

async function listJson(dir) {
  const files = await fs.readdir(dir).catch(() => []);
  return files.filter((f) => f.endsWith(".json"));
}

function itemToRow(i) {
  return {
    id: i.id,
    stage: i.stage,
    status: i.status,
    title: i.title ?? "",
    pillar: i.pillar ?? "Claude Code",
    hook_type: i.hookType ?? "",
    format: i.format ?? "Talking head",
    length_target: i.lengthTarget ?? "",
    posting_window: i.postingWindow ?? "",
    source_url: i.sourceUrl ?? "",
    demand_signal: i.demandSignal ?? { text: "", source: "", date: "" },
    recognition_score: i.recognitionScore ?? 3,
    hook: i.hook ?? {},
    script: i.script ?? [],
    captions: i.captions ?? [],
    engagement: i.engagement ?? {},
    checklist: i.checklist ?? [],
    results: i.results ?? {},
    series_name: i.seriesName ?? "",
    part_number: i.partNumber ?? null,
    status_history: i.statusHistory ?? [],
    created_at: i.createdAt,
    updated_at: i.updatedAt,
  };
}

async function main() {
  await loadEnv();
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  const sb = createClient(url, key, { auth: { persistSession: false } });

  // ---- content_items ----
  const contentDir = path.join(DATA, "content");
  const contentFiles = await listJson(contentDir);
  const items = [];
  for (const f of contentFiles) {
    const v = await readJson(path.join(contentDir, f), null);
    if (v && v.id) items.push(itemToRow(v));
  }
  if (items.length) {
    const { error } = await sb.from("content_items").upsert(items, { onConflict: "id" });
    if (error) throw new Error(`content_items: ${error.message}`);
  }
  console.log(`content_items: ${items.length}`);

  // ---- calendars ----
  const calDir = path.join(DATA, "calendars");
  const calFiles = await listJson(calDir);
  const cals = [];
  for (const f of calFiles) {
    const c = await readJson(path.join(calDir, f), null);
    if (c && c.week) {
      cals.push({
        week: c.week,
        days: c.days ?? {},
        notes: c.notes ?? null,
        theme: c.theme ?? null,
      });
    }
  }
  if (cals.length) {
    const { error } = await sb.from("calendars").upsert(cals, { onConflict: "week" });
    if (error) throw new Error(`calendars: ${error.message}`);
  }
  console.log(`calendars: ${cals.length}`);

  // ---- performance_log ----
  const perf = await readJson(path.join(DATA, "performance-log.json"), []);
  if (Array.isArray(perf) && perf.length) {
    const rows = perf.map((r) => ({
      video_id: r.videoId,
      date: r.date ?? "",
      hook: r.hook ?? "",
      pillar: r.pillar ?? "",
      format: r.format ?? "",
      views: r.views ?? 0,
      skip_rate: r.skipRate ?? 0,
      top_source: r.topSource ?? "",
      verdict: r.verdict ?? "",
      lesson: r.lesson ?? "",
    }));
    const { error } = await sb.from("performance_log").upsert(rows, { onConflict: "video_id" });
    if (error) throw new Error(`performance_log: ${error.message}`);
  }
  console.log(`performance_log: ${Array.isArray(perf) ? perf.length : 0}`);

  // ---- instagram cache ----
  const ig = await readJson(path.join(DATA, "instagram-cache.json"), null);
  if (ig && ig.accountId) {
    const { error: accErr } = await sb.from("instagram_account").upsert(
      {
        account_id: ig.accountId,
        username: ig.username ?? "",
        name: ig.name ?? "",
        followers_count: ig.followersCount ?? 0,
        media_count: ig.mediaCount ?? 0,
        last_sync: ig.lastSync ?? new Date().toISOString(),
      },
      { onConflict: "account_id" }
    );
    if (accErr) throw new Error(`instagram_account: ${accErr.message}`);

    const posts = (ig.posts ?? []).map((p) => ({
      id: p.id,
      account_id: ig.accountId,
      caption: p.caption ?? "",
      media_type: p.mediaType ?? "",
      timestamp: p.timestamp ?? null,
      thumbnail_url: p.thumbnailUrl ?? null,
      media_url: p.mediaUrl ?? null,
      permalink: p.permalink ?? "",
      like_count: p.likeCount ?? 0,
      comments_count: p.commentsCount ?? 0,
      impressions: p.impressions ?? 0,
      reach: p.reach ?? 0,
      saved: p.saved ?? 0,
      plays: p.plays ?? 0,
      shares: p.shares ?? 0,
      synced_at: ig.lastSync ?? new Date().toISOString(),
    }));
    if (posts.length) {
      const { error } = await sb.from("instagram_posts").upsert(posts, { onConflict: "id" });
      if (error) throw new Error(`instagram_posts: ${error.message}`);
    }
    console.log(`instagram_account: 1, instagram_posts: ${posts.length}`);
  } else {
    console.log("instagram cache: none");
  }

  console.log("Migration complete.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
