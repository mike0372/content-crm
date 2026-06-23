# CLAUDE.md — Content Calendar CRM (AutoPilot AI)

## Project identity

**Product:** AutoPilot AI — Custom CRM for managing an Instagram Reels pipeline.
**Stack:** Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 3 · `@anthropic-ai/sdk` · `@dnd-kit` · `@react-pdf/renderer` · `recharts` · `lucide-react`
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

### Data layer
- Local-first: JSON files in `/data/`
  - `/data/content/[id].json` — unified ContentItem store (stage: "idea" or "production")
  - `/data/calendars/[YYYY-WW].json` — one file per week
  - `/data/performance-log.json` — auto-synced when status → ANALYZED
  - `/data/instagram-cache.json` — Graph API cache written by `lib/instagram.ts`
  - Legacy `/data/videos/` and `/data/ideas.json` auto-migrated to `/data/content/` on first run
- Read/written via API route handlers in `app/api/**`
- `lib/data.ts` — central data access (`getAllContent`, `getAllVideos`, `getIdeas`, `getCalendar`)
- `lib/instagram.ts` — Graph API sync (`getInstagramCache`, `syncInstagram`)
- No external database. No ORM.

### Environment variables (`.env.local`)
- `INSTAGRAM_ACCESS_TOKEN` — Facebook Graph API token
- `INSTAGRAM_BUSINESS_ACCOUNT_ID` — IG Business account ID
- `ANTHROPIC_API_KEY` — for the AI Agent panel

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
npm run lint
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
