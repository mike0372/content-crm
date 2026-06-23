# AutoPilot AI — Brand Guidelines

> Source of truth, reverse-engineered from the live site **https://autopilotai.site/**.
> Follow these exactly when building any AutoPilot AI surface (landing pages, the CRM, dashboards, PDFs, emails).
> Dark theme only. When in doubt, match the site.

---

## 1. Brand identity

- **Name:** AutoPilot AI — always written `AutoPilot` + `AI`, where **`AI` is the accent-colored span** (blue gradient or `--blue`).
- **Product persona:** **Sofia** — "AI Receptionist". Refer to the agent as *Sofia*, capitalized.
- **Category:** AI voice receptionist + booking automation for **HVAC businesses (USA)**.
- **Taglines:**
  - Primary hero: *"Never Miss Another Call. Never Lose Another Job."*
  - Footer: *"Built for HVAC. Powered by AI."*
  - Meta: *"AI receptionist that answers 24/7, books jobs automatically, and fills your calendar — while you're on the roof."*
- **Contact:** mihnea@autopilotai.digital · © 2026 AutoPilot AI.
- **Logo treatment:** wordmark only (no icon mark). `AutoPilot` in `--text` white, `AI` in blue. Use Geist, weight 700–900, tight tracking.

---

## 2. Color palette

Dark, near-black base with a single electric **blue→cyan** accent system. **Blue is the only brand hue** — do not introduce purple/indigo, teal-green, etc. Green is reserved strictly for success/"active" states; red strictly for loss/error.

### CSS variables (use these names)
```css
:root {
  /* Surfaces — layering base → surface → surface2 */
  --bg:        #0a0a0a;   /* page background */
  --surface:   #111111;   /* cards / panels */
  --surface2:  #1a1a1a;   /* elevated / hover / inputs */
  --border:    #222222;   /* hairline borders */

  /* Text */
  --text:      #ffffff;   /* primary */
  --text-muted:#9ca3af;   /* body / secondary */
  --text-dim:  #6b7280;   /* captions / meta */

  /* Brand accent — blue → cyan */
  --blue-dark: #2563eb;
  --blue:      #3b82f6;   /* primary accent */
  --blue-light:#60a5fa;   /* highlights, badge text */
  --cyan:      #06b6d4;   /* gradient end */
  --sky:       #0ea5e9;   /* gradient end (buttons) */
  --sky-dark:  #0284c7;
}
```

Extra near-black shades used for section transitions: `#080808 #070707 #0d0d0d #0f0f0f #131313`.

### Semantic colors
| Purpose | Color |
|---|---|
| Success / active / "answered" | `#22c55e` (glow `0 0 8px #22c55e`), bright `#4ade80` |
| Error / loss / "missed" | `#ef4444`, soft `#f87171` |
| Info accent | `--blue` `#3b82f6` |

### Usage rules
- Background is **always** `--bg` / near-black. Never light backgrounds (except print/PDF — see §11).
- Accent blue is for: links, CTAs, section labels, focus rings, key stats, glows.
- Don't flood with blue — it's an **accent**. Most of the UI is grayscale (white text on near-black) with blue punctuation.

---

## 3. Typography

Three families, loaded via `next/font` (local woff2). Pairing = **Geist sans (UI/body) + Geist Mono (labels/eyebrows/numbers) + Instrument Serif italic (accent words only)**.

```css
--font-geist: "Geist", sans-serif;          /* body + headings */
--font-mono:  "Geist Mono", monospace;       /* eyebrows, stats, code, timers */
--font-serif: "Instrument Serif", serif;     /* italic accent words inside headings */
```

### Type scale & treatment (match these)
| Token | Font | Size | Weight | Tracking | Notes |
|---|---|---|---|---|---|
| Hero title | Geist | `clamp(38px,4.5vw,62px)` | 900 | `-2.5px` | `line-height:1.04` |
| Section title | Geist | `clamp(30px,3.5vw,46px)` | 900 | `-1.8px` | white→`rgba(220,230,255,.9)` gradient text clip |
| Accent word (`.highlight`) | **Instrument Serif** | `1.06em` | normal **italic** | `-1px` | blue→cyan gradient text clip |
| Section label / eyebrow | Geist **Mono** | `11.5px` | 700 | `2.5px` UPPERCASE | color `--blue` |
| Body / sub | Geist | `18px` | 400 | — | `line-height:1.65`, color `--text-muted`, max-width ~480px |
| Button | Geist | `16px` | 600 | — | — |
| Badge / pill | Geist | `12.5px` | 500 | — | — |
| Stat value | Geist Mono | large | 900 | — | animated count-up |

**Signature move:** big bold sans heading with **one phrase swapped to Instrument Serif italic in the blue→cyan gradient**. Use sparingly (one accent phrase per heading).

---

## 4. Gradients

```css
/* Primary CTA / fills */
linear-gradient(135deg, #3b82f6, #0ea5e9)     /* blue → sky */
linear-gradient(135deg, #2563eb, #0284c7)     /* deeper variant */

/* Heading text clip (cool white) */
linear-gradient(135deg, #ffffff, rgba(220,230,255,.9))

/* Accent text clip (the serif highlight) */
linear-gradient(135deg, var(--blue) 0%, var(--cyan) 100%)

/* Ambient radial glows / orbs */
radial-gradient(circle, rgba(59,130,246,.32), transparent)
radial-gradient(circle, rgba(6,182,212,.15), transparent)

/* Section fade to black */
linear-gradient(180deg, #0d0d0d 0, var(--bg))
```

---

## 5. Shadows & glows

Shadows are **blue-tinted glows + deep black drops + inset top highlight**. Never flat gray `shadow-md`.

```css
/* Elevated card */
box-shadow: 0 0 0 1px rgba(59,130,246,.18),
            0 0 80px rgba(59,130,246,.12),
            0 40px 120px rgba(0,0,0,.55),
            inset 0 1px 0 rgba(255,255,255,.06);

/* Primary button */
box-shadow: 0 0 28px rgba(59,130,246,.40),
            0 2px 8px rgba(14,165,233,.20);
/* button hover — intensify */
box-shadow: 0 0 52px rgba(59,130,246,.65),
            0 8px 24px rgba(14,165,233,.30);

/* Hero focal (phone) */
box-shadow: 0 0 60px rgba(59,130,246,.55),
            0 0 120px rgba(6,182,212,.20),
            0 8px 32px rgba(14,165,233,.30);

/* Success dot */
box-shadow: 0 0 8px #22c55e;
```

---

## 6. Radius scale

`6px` (small), `9px` (**buttons / inputs — default**), `12–14px` (cards), `18px` (large cards), `28–42px` (feature panels), `100px / 9999px` (pills & dots).

---

## 7. Components

### Buttons
- **Primary:** blue→sky gradient, white text, `padding:12px 23px`, `radius:9px`, `font:16px/600`, glow shadow, often a trailing ` →`. Hover lifts + intensifies glow.
- **Secondary:** transparent, white text, `1px solid rgba(255,255,255,.18)` border, same padding/radius/size.
- **`btn-lg`** variant for hero/section CTAs.
- CTAs almost always end with **` →`** and use action+benefit copy ("Book a Free Demo →", "Start Recovering Revenue →", "Fix It — Book a Free Demo →").

### Badge / pill (eyebrow chip)
- `background: rgba(59,130,246,.08)`, `border:1px solid rgba(59,130,246,.28)`, `radius:100px`, `padding:6px 16px`, `12.5px/500`, text `--blue-light`. Often leads with a small status **dot** (success-green for "active", blue for info).

### Cards
- `background: --surface`, hairline `--border`, generous radius (12–18px), the elevated glow shadow on key cards, optional `inset 0 1px 0 rgba(255,255,255,.06)` top highlight.

### Stats
- Big Geist-Mono value with **count-up animation**, blue accent, small muted label under it.

---

## 8. Backgrounds & atmosphere

Layered depth, never flat:
- **Grid overlay:** faint white lines `linear-gradient(90deg, rgba(255,255,255,.025) ...)` both axes (the `hero-grid` / `cta-grid-overlay`).
- **Orbs:** large blurred blue/cyan `radial-gradient` circles floating behind content (`cta-orb-1/2`, `phone-glow`).
- **Section fades:** `linear-gradient(180deg,#0d0d0d,var(--bg))` to blend sections.
- Keep contrast high: bright content over near-black, glows for focus.

---

## 9. Motion

- **Easing:** `cubic-bezier(.16, 1, .3, 1)` (spring-like ease-out). This is *the* brand easing.
- **Duration:** `~.3s` for interactions; longer for ambient.
- **Patterns:** `fade-up` on scroll (staggered via `.stagger`), count-up stats, glow intensify on hover, subtle float on orbs.
- Animate **transform / opacity / box-shadow** only. Never `transition: all` on layout properties beyond these.

---

## 10. Iconography

- **Library:** Lucide. **`strokeWidth: 1.75`** (site default), size 22–28 in features, 13 inline.
- Icons seen: phone, bot, layout-dashboard, trending-down, zap, moon, check.
- Monoline, inherit `currentColor` (white or blue). No filled/duotone icons.

---

## 11. Voice & tone

- **Audience:** HVAC owners/operators — busy tradespeople, not techies. Talk to them on the job ("while your crew is out", "while you're on the roof").
- **Tone:** confident, direct, ROI-first, zero jargon. Short punchy lines. Em-dashes for rhythm.
- **Always lead with money & speed:** missed calls = lost revenue; respond in seconds; 24/7.
- **Reassurance closers:** "No contracts." "No pitch decks. No pressure." "Cancel anytime — no fine print."
- **Concrete numbers over adjectives:** `$5k–$20k/mo lost`, `$14k+/mo recovered`, `100% answered`, `<45s`, `24/7`, `48–72 hrs to live`, `5-minute rule / 80%`.
- **Capitalize** Sofia, AutoPilot AI. Use "Custom CRM" for the dashboard product.

### Messaging pillars
1. **Never miss a call** (24/7 coverage, after-hours, weekends).
2. **Speed wins** (instant pickup, <5 min or the lead is gone).
3. **Books the job automatically** (qualifies → checks availability → books in <2 min).
4. **Everything logged in the Custom CRM** (calls, leads, bookings, performance).
5. **Risk-free** (month-to-month, first-install guarantee, live in 48–72 hrs).

### Product facts (keep accurate)
- Routes the client's **existing number** through Sofia (no new number).
- Integrations: **ServiceTitan, Jobber, Housecall Pro, Google Calendar** (others on request).
- Setup handled for them; onboarding call; live in **48–72 hours**.
- Plans month-to-month; "Complete" plan includes the **Custom CRM**.

---

## 12. Print / PDF exception

The web brand is dark-only. For printed/PDF artifacts, invert to a **light document** (white bg, near-black ink) but keep the **blue accent** (`#3b82f6`) for headers, rules, and key figures, and keep the Geist/Mono pairing. Don't print on near-black.

---

## 13. Do / Don't

**Do**
- Near-black canvas, white text, blue→cyan accents, blue-tinted glows.
- One Instrument Serif italic accent phrase per heading.
- Geist Mono uppercase eyebrows with wide tracking.
- CTAs with benefit copy + trailing `→`.
- Concrete revenue/speed numbers.

**Don't**
- No light theme on web. No purple/indigo/default-Tailwind blue (use `--blue #3b82f6`, not `blue-600`).
- No flat gray shadows. No `transition: all`.
- No serif for body or for whole headings — italic accent words only.
- No vague hype without a number behind it.
- Don't rename Sofia or lowercase the brand.
