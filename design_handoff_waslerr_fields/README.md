# Handoff: Waslerr Fields — Premium Subliminal Audio Website

## Overview
Waslerr Fields is a premium, luxury marketing website for a brand selling **subliminal audio** for manifestation, mindset, confidence, wealth, attraction, focus and self-improvement. The aesthetic is **classy, dark, cinematic and futuristic** — black / dark-navy backgrounds, gold + silver accents, glassmorphism cards, ambient particle and resonance animations. Reference points: Apple, Tesla, Stripe, Linear.

The site is **3 pages**:
1. **Home** (`Waslerr Fields.dc.html`) — hero → featured "Top picks" → free fields → "three ways into the subconscious" → reviews → FAQ → custom-code request → "Join the party" community → footer.
2. **Fields** (`Fields.dc.html`) — full catalog of every field, filterable by line (All / Desire Code / Akashic Field), each with audio preview.
3. **Method** (`Method.dc.html`) — "How subliminals rewire the mind" explainer (4-step timeline).

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes showing the intended look and behavior. They are **not production code to copy directly**. The task is to **recreate these designs in the target codebase's environment** (e.g. React/Next.js, Vue, etc.) using its established patterns, component library and conventions. If no environment exists yet, pick the most appropriate modern stack (Next.js + Framer Motion is a strong fit for the cinematic motion here) and implement there.

> Note: the HTML uses a lightweight in-house component runtime (`support.js`, `.dc.html` files). Ignore that runtime — it is only the prototyping harness. Read the markup, styles and the logic class for intent; reimplement idiomatically.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, motion and copy are all intentional. Recreate the UI faithfully using the codebase's libraries. Exact tokens are listed below.

---

## Design Tokens

### Color
| Token | Hex / value | Use |
|---|---|---|
| Background base | `#060709` | Page background (near-black) |
| BG radial navy | `rgba(40,58,110,.26)` | Top-right ambient glow |
| BG radial crimson | `rgba(74,14,14,.13)` | Lower-left ambient warmth |
| Gold | `#d4af37` | Primary accent |
| Gold light | `#f6e7b4` | Gradient top / highlights |
| Gold deep | `#b8862b` | Gradient bottom |
| **Gold gradient** | `linear-gradient(135deg,#f6e7b4 0%,#d4af37 48%,#b8862b 100%)` | CTAs, prices, headings accent, badges |
| Silver (body) | `#c9cdd6` | Primary body text |
| Muted | `#7e8492` | Secondary text, eyebrows |
| Heading white | `#f1f2f6` / `#f3f4f7` | Display headings |
| Rule / border | `rgba(255,255,255,.09)` | Hairline borders, dividers |
| Glass fill | `rgba(255,255,255,.035)` | Card / chip background |
| Glass fill 2 | `rgba(255,255,255,.06)` | Hover / raised glass |
| Akashic accent | `#5fa8c9` | Akashic category label (cyan) — the ONLY non-gold accent |

The palette is **black + gold/silver + glassmorphism**. Gold gradient is the signature. Cyan (`#5fa8c9`) appears only as the "Akashic" category tag to distinguish it from "Desire".

### Typography
- **Display / headings:** `'Cormorant Garamond', serif` — weights 400/500, often italic for the accent clause. Sizes use `clamp()`, e.g. hero `clamp(46px,8.2vw,104px)`, section H2 `clamp(34px,5vw,58px)`. Letter-spacing `-0.02em`. `text-wrap: balance`.
- **Body / UI:** `'Geist', sans-serif` — weights 300 (body), 400, 500 (buttons/labels). Body 14–17.5px, line-height ~1.6.
- **Eyebrows / technical / meta:** `'Geist Mono', monospace` — 10–12px, `letter-spacing: .1em–.3em`, `text-transform: uppercase`. Used for section indexes ("01 · Top picks"), freq labels ("432 Hz · Theta · 60m"), badges.
- Google Fonts: `Cormorant Garamond` (ital 300–600), `Geist` (300–600), `Geist Mono` (400–500).

### Spacing & layout
- Max content width: **1180px** (centered, 28px side padding).
- Section vertical padding: ~82px desktop; ~62px on ≤560px screens.
- Card grid: `repeat(auto-fit, minmax(270px, 1fr))`, gap 22px.
- Section stack pattern: **mono eyebrow → serif H2 → body → content**, each section `border-top: 1px solid rule`.

### Radius
- Cards: 16px · Large cards/pricing: 18px · Buttons: 7–8px · Chips/pills/badges: 999px · Logo tile: 9px.

### Shadow / glow
- Gold CTA: `0 10px 40px rgba(212,175,55,.24), 0 0 0 1px rgba(246,231,180,.4)`.
- Card hover lift: `0 30px 70px rgba(0,0,0,.5), 0 0 0 1px rgba(212,175,55,.25)` + border → `rgba(212,175,55,.35)`.
- Play button active: `0 0 22px rgba(212,175,55,.55)`.

### Motion
- Easing everywhere: `cubic-bezier(.22,1,.36,1)` (soft-out). **No bounce, no spring overshoot.**
- Durations: hover 200–350ms; reveals 800–1050ms; marquee 36–46s linear; resonance rings 11s ease-out.
- Scroll reveals: elements start `opacity:0; translateY(26–34px)`, animate to `opacity:1; translateY(0)` via IntersectionObserver, with small stagger (index × ~0.07s).

---

## Screens / Views

### 1 — Home (`Waslerr Fields.dc.html`)

**Sticky nav** — transparent at top, becomes `rgba(8,10,16,.72)` + `backdrop-filter: blur(14px) saturate(1.3)` + bottom hairline once `scrollY > 8`; padding shrinks. Left: monogram tile ("W", gold gradient, 9px radius, 0 0 24px gold glow) + wordmark "WASLERR FIELDS" (Geist 500, letter-spacing .28em). Right (desktop ≥860px): text links **Fields · Method · Reviews · Custom · Community** (muted → white on hover) + gold-gradient **"Begin"** button. Below 860px: links hide, an **animated hamburger** shows — three 18×1.5px bars that animate into an X (top bar `translateY(6.5px) rotate(45deg)`, middle `opacity:0`, bottom `translateY(-6.5px) rotate(-45deg)`); tapping opens a slide-down glass panel (`wf-menu-in` .38s) whose links fade-up in stagger (`wf-fadeup`, .04 + i×.05s).

**Hero** — full-viewport, centered. Background layers behind content (all `position:fixed`, `z-index:0`):
- `<canvas>` particle field — gold dots drifting, connected by faint lines when within 130px (constellation). Count ≈ `min(width,1400)/16` (or /26 in "Calm").
- Resonance rings — 3 concentric 1500px circles (gold/blue/gold) animating `wf-resonance` (scale .22→1, opacity 0→.55→0) on 11s loop, 3.6s staggered, centered ~46% vertically; plus a soft 560px gold radial core.
- Cursor: a lerped 620px gold radial "glow" follows the mouse (`screen` blend), and an 11px gold cursor dot + fading trail dots.
Content: a glass pill eyebrow ("Subliminal audio · engineered for the subconscious" with a pulsing gold dot), serif H1 **"Reprogram the mind. / Reshape your reality."** (second line gold-gradient italic), body subhead, two CTAs — primary gold **"Start your transformation"** + secondary glass "Try a field free", a star-rating trust line ("★★★★★ · 50,000+ listeners across 60 countries"), and an animated scroll cue at the bottom. Hero entrance: each `[data-anim]` element fades+rises with stagger via transition (driven in JS so it persists; do NOT rely on CSS `animation` fill-forwards). There is also a rotating conic-gradient ring + a static bordered ring behind the headline.

**Top picks** (`#wf-collection`) — eyebrow "01 · Top picks", H2 "Top picks.", body. A 3-card glass grid (currently: *Valentine Ultimate Male Aura* $151 [Desire, image], *Perfect Hairs* $320 [Desire, image-slot placeholder], *Porn-Addiction Freedom* $95 [Akashic, image-slot placeholder]). Below the grid a glass **"Browse all fields →"** button (arrow nudges on hover, `wf-arrow`) links to `Fields.dc.html`.
Card anatomy: image top (h 280px, `object-fit:cover`) with a "New release" gold badge top-left and a circular **preview play button** bottom-right; gradient scrim over image bottom; body = serif title, "Waslerr" sub, mono category label (gold for Desire, cyan for Akashic), 3-line-clamped description with a gold **"Read more"** toggle, and gold-gradient price. Hover: 3D tilt (`perspective(900px) rotateX/Y` up to 7°, translateY -6px) + glow follows cursor inside card + image zooms to scale 1.07 + border/shadow lift. (In "Calm" motion mode, tilt is disabled, only the lift remains.)

**Free fields** (`#wf-free`) — same card system, marked free ($0), for users to "give it a shot".

**Three ways into the subconscious** — explains Desire Code / Akashic Field / Custom Code (the three product lines), placed directly under the products.

**Reviews** (`#wf-reviews`, eyebrow "03 · Reviews") — auto-scrolling horizontal **marquee** of glassmorphism testimonial cards (360px wide), duplicated set, `wf-marq` 46s linear, **pauses on hover**, edge mask-fade left/right. Each: 5 gold stars, quote, avatar monogram + name + role.

**FAQ** (`#wf-faq`, eyebrow "04 · Questions") — glass accordion. Click toggles `max-height` (0 ↔ scrollHeight), "+" rotates 135° to "×", active panel border → gold, others close. Six Q&As about how subliminals work, audibility, frequency, safety, sleep listening, results timeline.

**Custom Code** (`#wf-custom`) — a request form for users who want a bespoke subliminal made (talk to creator / specify intention).

**Join the party** (`#wf-join`, eyebrow "Join the party") — H2 "Step inside the Waslerr circle." + 3 glass link-cards: **YouTube** (subscribe), **Discord** (join community), **1:1 with the creator** (book a session / mailto). Each card: 48px rounded gold-tinted icon tile, serif title, body, gold "→" CTA; hover lifts border to gold + shadow. Links are placeholders (`youtube.com/@waslerrfields`, `discord.gg/waslerrfields`, `mailto:hello@waslerrfields.com`) — replace with real URLs.

**Footer** — minimal luxury. Monogram + wordmark + tagline, animated social icons (X, Instagram, YouTube, TikTok — circular hairline buttons, hover fills gold), link columns (Collection, Company, Legal), legal disclaimer ("Audio supports mindset & self-improvement. Not medical treatment. Individual results vary.").

### 2 — Fields catalog (`Fields.dc.html`)
Sticky glass nav (Home · Fields · Method · Custom · Community + Begin). Header: eyebrow "The fields", H1 "Every field, one place.", body. **Filter chips: All fields / Desire Code / Akashic Field** — clicking filters the grid (cards fade+scale out/in), updates a live count line ("4 Desire Code fields"), and writes the URL hash (`#desire` / `#akashic`). On load, the hash pre-selects the filter (so home-page links like `Fields.dc.html#desire` land pre-filtered). Grid = same card system, 6 fields total (4 Desire, 2 Akashic). Background has the same resonance rings + cursor glow/trail. Footer: "Can't find your exact field?" → Request a Custom Code, a **Join the party** strip (YouTube/Discord/1:1 inline links), and "← Back to home".

### 3 — Method (`Method.dc.html`)
Sticky glass nav. Eyebrow "The method", H1 **"How subliminals rewire the mind."**, body. A **4-step vertical timeline** (gold gradient spine, numbered nodes; step 04 node is filled gold with glow): 01 Choose your field → 02 Listen daily → 03 The subconscious absorbs → 04 Behaviour shifts, reality follows. Each step reveals on scroll. CTA row: gold "Explore the fields →" + glass "See pricing"-style secondary (note: pricing was removed sitewide — secondary should point to Fields or be dropped). Background resonance + cursor glow. Footer "← Back to home".

## Interactions & Behavior
- **Scroll reveals** — IntersectionObserver (threshold ~0.12, rootMargin `0px 0px -6% 0px`), unobserve after firing, stagger by sibling index. Honor `prefers-reduced-motion` by skipping transforms in production.
- **Cursor glow / dot / trail** — `mousemove` updates target; a rAF loop lerps the big glow (`+= (target-cur)*0.08`); trail spawns fading dots throttled to ~42ms. Desktop only — disable on touch.
- **Particle canvas** — rAF; respects DPR (capped 2); re-seeds on resize; connection lines under 130px.
- **Card tilt + glow** — pointer position → rotateX/Y + radial glow position; reset on leave.
- **Audio preview** — Web Audio API: two detuned sine oscillators (base freq from `data-freq`, +4.5Hz) through a 540Hz lowpass + gain ramp to 0.045; auto-stops after 30s; only one plays at a time; button toggles play/pause icon + gold active state. (In production, swap for real audio file previews.)
- **Filtering (Fields page)** — toggles display + opacity/scale transition; uses a token guard so rapid clicks don't race; updates count + URL hash; reads hash on init.
- **FAQ accordion**, **Read more clamp toggle**, **testimonial marquee pause-on-hover**, **mobile menu** — as described above.
- **Count-up stats** (if reused) — animate from 0 to target on first viewport entry, cubic ease-out, ~1.7s, with suffix/decimal support.

## State Management
- `accent` (Gold | Platinum | Emerald) and `motion` (Cinematic | Calm) are author-level tweak props that re-theme CSS variables / reduce motion. In a real app these can be theme constants; expose only if needed.
- Per-component runtime state: active audio source, open FAQ index, active filter category, mobile-menu open boolean, hero-entrance-played flag. All local UI state — no backend in the prototype.
- Real implementation will need: product/field data (title, line, price, freq label, description, artwork, free flag), cart/checkout, custom-code form submission, newsletter/community links.

## Assets
- `assets/products/valentine.jpg` — user-supplied poster for "Valentine Ultimate Male Aura" (included in this bundle). All other product cards use drop-in image placeholders — supply real artwork.
- Icons are inline SVGs (play, arrow, chevron, social: X/Instagram/YouTube/TikTok/Discord, chat). No icon library dependency; swap for Lucide or your set as preferred.
- Fonts via Google Fonts CDN (Cormorant Garamond, Geist, Geist Mono).
- No other raster imagery — the aesthetic is type + gradient + motion.

## Files
- `Waslerr Fields.dc.html` — Home (primary reference; read the markup + the `class Component` logic block for all behavior).
- `Fields.dc.html` — Fields catalog page.
- `Method.dc.html` — Method page.
- `assets/products/valentine.jpg` — product artwork.
- `preview/Waslerr Fields.html` — a fully self-contained, offline-openable bundle of the Home page. Open this in a browser to see the design live without any setup. (Generated output — read the `.dc.html` files for source.)

## Notes for implementation
- **Framer Motion + Next.js** is the recommended target for matching the cinematic motion. The resonance rings, particle canvas and cursor glow are plain `<canvas>` / rAF and port directly.
- Keep **all motion soft-out, no bounce.** Respect `prefers-reduced-motion`.
- The brand is **dark glassmorphism + gold gradient + serif/sans/mono trio** — do not introduce new accent colors beyond the cyan Akashic tag.
- Pricing was intentionally removed sitewide; do not reintroduce a pricing page unless asked.
- Replace placeholder community URLs and the creator email before shipping.
