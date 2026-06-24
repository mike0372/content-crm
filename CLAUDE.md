# CLAUDE.md — Content Calendar CRM (AutoPilot AI)

## Project identity

**Product:** AutoPilot AI — Custom CRM for managing an Instagram Reels pipeline.
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 3 · Supabase (Postgres) · `@supabase/supabase-js` · `@anthropic-ai/sdk` · `@dnd-kit` · `@react-pdf/renderer` · `recharts` · `lucide-react`
**Theme:** Dark-only. Never add a light theme.

### Routes
| Route | Purpose |
|---|---|
| `/` | **Overview dashboard** (default home — aggregates all sections) |
| `/board` | Kanban board |
| `/calendar` | Calendar view |
| `/video/[id]` | Video detail / editor |
| `/ideas` | Ideas bank |
| `/performance` | Instagram performance (raw API cache + charts) |
| `/login` | Password sign-in (no chrome; sets the session cookie) |

### Auth
- **`middleware.ts`** gates every page + API route. **Opt-in:** when `AUTH_SECRET` is unset the app stays fully open (local dev). Once `AUTH_SECRET` + `APP_PASSWORD` are set, all routes require the `ap_session` httpOnly cookie — except `/login`, `/api/auth/*`, and cron calls bearing the right `x-cron-secret`.
- `POST /api/auth/login` — constant-time password check vs `APP_PASSWORD`; on success sets `ap_session` = `AUTH_SECRET` (httpOnly, sameSite=lax, secure in prod, 30-day). `POST /api/auth/logout` clears it. Sidebar has a "Sign out" button; `SidebarLayout` renders `/login` without the sidebar/agent chrome.

### Data layer
- **Supabase (Postgres)** is the source of truth — project ref `ygqexrticqsjhrnrwlxu`. The local `/data/*.json` files are legacy seed/backup only; the app no longer reads or writes them.
- Tables (schema in Supabase migrations `init_content_crm_schema`):
  - `content_items` — unified ContentItem store (`stage` = "idea" | "production"); scalar columns + JSONB for nested fields (`hook`, `script`, `captions`, `engagement`, `checklist`, `results`, `demand_signal`, `status_history`). `updated_at` auto-set by trigger. `instagram_media_id` (text, nullable) binds an item to its posted reel so live IG metrics flow back into the editor (see Linked Reel below).
  - `calendars` — one row per ISO week (`week` PK, `days` JSONB)
  - `performance_log` — upserted/deleted from `content_items` when status → ANALYZED
  - `instagram_account` + `instagram_posts` — full Meta Graph API data (account stats + every fetched post field incl. insights). `instagram_posts.avg_watch_time` (numeric, seconds) holds the `ig_reels_avg_watch_time` reels insight, fetched in a **separate** Graph call so a failure can't zero the core metrics. Stale posts (outside the latest media window) are pruned on each sync.
- **Sync = full save to Supabase.** Every in-app "Sync" button → `apiRefreshInstagram()` → **POST `/api/sync`** → `lib/sync.ts` `syncAll()`, which (1) fetches live Meta/Graph data and upserts `instagram_account` + `instagram_posts`, and (2) reconciles the website's own CRM data — counts videos/ideas and rebuilds `performance_log` from current `content_items` via `rebuildPerformanceLog()`. Content rows are also written on every edit; the sync guarantees the whole picture is in Supabase, never in a local file. Returns `{ instagram, counts, calendarWeek, syncedAt }`. Also usable as a Vercel Cron target (optional `CRON_SECRET` header). The old `/api/instagram` (POST) still works for an IG-only sync; `/api/instagram/sync` (POST) also runs an IG-only sync and returns the full cache (used by the Linked Reel "Refresh" button).
- **In-editor idea features** (`components/ideas/`): the Idea editor has (1) **Autofill from PDF/TXT** — `POST /api/ideas/autofill` runs Claude Haiku on one document and returns parsed fields; the editor merges only fields the user left empty and flashes a transient "AI" tag. Distinct from `/api/ideas/import` (bulk extract + save on the list page). (2) **Linked Reel** (`LinkedReelSection.tsx`) — picks a reel from the IG cache (`GET /api/instagram`), stores `instagramMediaId`, shows live read-only metrics, and "Pull into Results" writes IG values into `results{}` + sets status → ANALYZED. Board cards show a chain badge when `instagramMediaId` is set.
- **Reel results analysis (production `/video/[id]` RESULTS tab)** — when an item is POSTED/ANALYZED and unlinked, the tab shows a **link screen** (pick from the IG cache reel grid, or paste a URL/media ID; "Fill manually instead" reveals the original form). Once `instagramMediaId` is set it shows a **linked panel**: reel header (Refresh stats = `POST /api/instagram/sync`, Unlink), a **per-metric verdict** table (WIN/OK/FLOP), an auto-computed-but-overridable **overall verdict**, an AI **"Generate lesson"** button (`POST /api/results/lesson` → Claude Haiku), and **Pull into Results** (writes live values into `results{}` + status → ANALYZED). Verdict logic lives in `lib/reelVerdict.ts` (`computeMetrics`, `overallVerdict`, pure/client-safe). Skip rate was replaced by **avg watch time** (real Graph data); FB views / top source / follows are still optional manual inputs that feed their verdicts. All writes go through the editor's existing autosave (`apiSaveVideo` → PUT `/api/videos/[id]`). Board cards (`VideoCard`) show a chain badge when linked and a cyan **"Link reel"** deep-link (`/video/[id]?tab=results`) when POSTED + unlinked; `initialTab` matching is case-insensitive. The dashboard's Instagram panel shows **Avg Watch Time** (averaged from the cache) and **Win Rate** (% of synced reels that crossed the 1K-views WIN benchmark) — both pulled straight from the IG cache, no manual entry.
- RLS is **enabled with no policies** on every table — access is server-side only via the service_role key (which bypasses RLS). Never use the anon key for these tables from the browser.
- `lib/supabase.ts` — `getSupabase()` lazy server-only client (service_role).
- `lib/data.ts` — central data access (`getAllContent`, `getAllVideos`, `getIdeas`, `getCalendar`, `saveContentItem`, …). Maps DB rows ↔ `ContentItem`. Public signatures unchanged from the old JSON layer.
- `lib/instagram.ts` — Graph API sync (`getInstagramCache`, `syncInstagram`) reads/writes the IG tables.
- `scripts/migrate-to-supabase.mjs` — one-time importer: local `/data/*.json` → Supabase (`node scripts/migrate-to-supabase.mjs`).
- **Live sync (polling, server-only)** — Board, Calendar, and Ideas stay in step across tabs/devices via `lib/useLiveSync.ts` (`useLiveSync(fetcher, onData, {intervalMs})`): re-fetches the existing server API on an 8s interval + on window focus/visibility, never touching the DB from the browser (RLS posture unchanged). `mute(ms)` suppresses applying fetched data after a local write so optimistic DnD/autosave is never clobbered; status drives `LiveIndicator`/`ConnectionBar` (`components/ui/LiveIndicator.tsx`) — green "Live" dot when synced, amber bar when reconnecting. Optimistic DnD reverts on save failure and shows `components/ui/Toast.tsx` ("Sync failed — retrying"). Client getters `apiGetVideos`/`apiGetIdeas`/`apiGetCalendar` (no-store) feed the polling.

### Environment variables (`.env.local`)
- `SUPABASE_URL` — Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` — service_role key (server-only data access; bypasses RLS — never expose)
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — present for any future browser client (unused server-side)
- `INSTAGRAM_ACCESS_TOKEN` — Facebook Graph API token
- `INSTAGRAM_BUSINESS_ACCOUNT_ID` — IG Business account ID
- `ANTHROPIC_API_KEY` — for the AI Agent panel
- `APP_ACCESS_KEY` — the access key typed on `/login` (legacy alias `APP_PASSWORD` still accepted). Auth is OFF until this + `AUTH_SECRET` are both set
- `AUTH_SECRET` — 256-bit random string used to HMAC-sign session cookies (NOT the value stored in the cookie). Setting it turns auth ON for the whole app, local and Vercel
- `CRON_SECRET` — optional; required in the `x-cron-secret` header for cron sync calls (bypasses the auth gate)

### Auth gate (single-key login)
- **What:** one access key gates the entire app (every page + every `/api/*` route) via `middleware.ts`. Enter the key at `/login`; valid → a signed session cookie is set; idle 3h → disconnected.
- `lib/auth.ts` — Edge+Node-safe (Web Crypto only) core: `signSession`/`verifySession` (HMAC-SHA256 token carrying an `exp`), `safeEqual` (constant-time), `SESSION_COOKIE`, `SESSION_TTL_MS` (3h).
- `middleware.ts` — verifies the signed cookie, **slides** the 3h window (re-mints when >5min old), 401s APIs / redirects pages to `/login` with a same-origin-only `?next=`. Cron header bypass. Unset `AUTH_SECRET` ⇒ app open (dev fallback).
- `app/api/auth/login` — constant-time key check, in-memory IP rate-limit (8 tries / 10min → 429), mints the 3h cookie (`httpOnly`, `secure` in prod, `sameSite=lax`). `app/api/auth/logout` — clears it.
- Cookie is a signed token, never the raw secret/key; the key never reaches the client bundle. Rotate access by changing `APP_ACCESS_KEY`; invalidate all sessions by changing `AUTH_SECRET`.

---

## Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.

## Self-updating rule
After completing any task that meaningfully changes the project's structure, ask yourself:
> "Would a future coding session need to know this to avoid confusion or wasted work?"

If yes, update this file before finishing. Things that qualify:
- New routes added to `app/`
- New persistent data files or changes to the `/data/` schema
- New libraries added to `package.json` that affect how UI or data is handled
- New shared components, hooks, or utilities in `lib/` or `components/` that should be reused
- API routes added or renamed in `app/api/`
- Changes to how the app is run or deployed

Things that do NOT qualify: one-off bug fixes, styling tweaks, content changes, refactors that don't change the interface.

Update only the relevant section (routes table, data layer, stack line, etc.). Do not rewrite the whole file.

---

## Running the app

```bash
npm run dev        # http://localhost:3000
npm run build
npx tsc --noEmit   # typecheck (use this — `next lint` is removed in Next 16)
```

**Never use `serve.mjs`, `screenshot.mjs`, or a static `index.html` workflow — this is a Next.js app.**

---

## Brand: AutoPilot AI

Full spec lives in `brand_assets/BRAND_GUIDELINES.md`. Key facts:

### Color palette (use CSS variables — do not use Tailwind defaults)
```css
--bg:        #0a0a0a;   /* page background */
--surface:   #111111;   /* cards / panels */
--surface2:  #1a1a1a;   /* elevated / hover / inputs */
--border:    #222222;

--text:      #ffffff;
--text-muted:#9ca3af;
--text-dim:  #6b7280;

--blue-dark: #2563eb;
--blue:      #3b82f6;   /* primary accent */
--blue-light:#60a5fa;
--cyan:      #06b6d4;
--sky:       #0ea5e9;
```
Semantic: `#22c55e` = success/active, `#ef4444` = error/loss.

### Typography
- **Geist** (local woff) — body + headings (`--font-geist`)
- **Geist Mono** — eyebrows, stats, labels (`--font-mono`)
- **Instrument Serif italic** — one accent phrase per heading only (`--font-serif`)
- Section eyebrows: Geist Mono, 11.5px, 700, `letter-spacing: 2.5px`, UPPERCASE, color `--blue`
- Large headings: weight 900, `letter-spacing: -0.03em`, `line-height: 1.04`
- Body: 18px, 400, `line-height: 1.65`, color `--text-muted`

### Gradients
```css
linear-gradient(135deg, #3b82f6, #0ea5e9)       /* CTA fills */
linear-gradient(135deg, #ffffff, rgba(220,230,255,.9))  /* heading text clip */
linear-gradient(135deg, var(--blue), var(--cyan))       /* accent serif text clip */
radial-gradient(circle, rgba(59,130,246,.32), transparent) /* ambient orb */
```

### Shadows (never flat `shadow-md`)
```css
/* Card */
box-shadow: 0 0 0 1px rgba(59,130,246,.18),
            0 0 80px rgba(59,130,246,.12),
            0 40px 120px rgba(0,0,0,.55),
            inset 0 1px 0 rgba(255,255,255,.06);

/* Primary button */
box-shadow: 0 0 28px rgba(59,130,246,.40), 0 2px 8px rgba(14,165,233,.20);
/* hover */  0 0 52px rgba(59,130,246,.65), 0 8px 24px rgba(14,165,233,.30);
```

### Radius scale
`6px` small · `9px` buttons/inputs · `12–14px` cards · `18px` large cards · `28–42px` panels · `9999px` pills

### Icons
Lucide React · `strokeWidth: 1.75` · size 22–28 (features), 13 (inline) · inherit `currentColor`

### Motion
- Easing: `cubic-bezier(.16, 1, .3, 1)`
- Duration: `~0.3s` interactions
- Animate **`transform`, `opacity`, `box-shadow`** only
- **Never `transition-all`**

---

## Anti-Generic Guardrails
- **Colors:** Use `--blue #3b82f6`, never `blue-600` or `indigo-500`.
- **Shadows:** Blue-tinted glows + deep black drops. Never flat gray `shadow-md`.
- **Typography:** Geist sans for UI, Geist Mono for labels/stats, Instrument Serif italic for accent words only.
- **Gradients:** Layer radial ambient orbs behind content (grid overlay + orbs pattern).
- **Animations:** Only `transform` + `opacity` + `box-shadow`. Never `transition-all`.
- **Interactive states:** Every clickable element: hover + focus-visible + active. No exceptions.
- **Depth:** `--bg` → `--surface` → `--surface2` layering system. Not everything on the same z-plane.
- **Spacing:** Intentional consistent tokens, not random Tailwind steps.

---

## Hard Rules
- Dark theme only (except PDF export — see brand guidelines §12 for light-print exception)
- No default Tailwind `blue-*`/`indigo-*` as primary accent
- No `transition-all`
- No flat `shadow-md`
- No Instrument Serif except italic accent phrases inside headings
- Do not add sections, features, or pages not requested
- Do not "improve" existing designs beyond what is asked
- Do not generate `index.html`, `serve.mjs`, or `screenshot.mjs` — this is a Next.js app

---

## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content where needed.
- Do not improve or add to the reference design.
- Screenshot at `http://localhost:3000` using the browser or a screenshot tool. Compare against reference. Fix mismatches. Do at least 2 rounds.
