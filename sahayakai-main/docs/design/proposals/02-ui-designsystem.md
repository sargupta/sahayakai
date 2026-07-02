# 02 — Design System: Tokens, Color, Type, Elevation

**Lens:** Design system (tokens/color/type/spacing/elevation/components).
**Verdict:** The bones are good — HSL-var tokens, a Phase-1 radius/shadow/motion layer, an Indic-aware font stack, and disciplined utility grammar (`.type-*`, `.container-*`). What holds it back from "premium" is a **flat-primary color story** (one saffron used at 90% opacity for every state), **shadows too weak to register**, a **flag-literal palette** (saffron/green/navy fighting for the same 10% accent slot), and **type hierarchy that leans on size, not contrast**. Below is a first-principles refinement. No app code touched.

---

## 1. Audit — where it reads cheap

| Area | Current | Problem |
|---|---|---|
| **Color states** | `hover:bg-primary/90`, `/80`, `/10` everywhere | Opacity-shifting a single saffron = muddy, low-contrast hovers. Premium systems use a *tuned* darker step, not transparency over an unknown bg. |
| **Palette** | `--primary` saffron, `--secondary` deep-green, `--accent` navy | Three max-saturation flag colors, none reserved as a true neutral-brand. Green+navy rarely appear, so they read as unused debt. `--accent` is even repurposed to a grey hover surface in dark mode — the token lies. |
| **Neutrals** | `--muted 210 40% 96%`, `--border 220 16% 93%` | Cool blue-grey neutrals under a *warm* saffron brand → subtle temperature clash. Borders at 93% L are nearly invisible; cards float on nothing. |
| **Elevation** | `shadow-soft` = `0 1px 3px /0.03` | Alpha 0.03–0.04 is below perceptual threshold on most screens. Cards look like flat rectangles with a hairline. No layered ambient+key shadow. |
| **Radius** | Dual system: legacy `rounded-lg`=12 + new `surface-*` | Two radius vocabularies coexist; `md`=10 vs `surface-md`=12 drift. Buttons use `rounded-md`, cards `var(--radius)` — curvature not unified. |
| **Type** | Outfit headline / Inter body, hierarchy mostly via `text-3xl/2xl/lg` | Weight jumps are fine, but tracking/optical-size unused; large saffron display headings on warm-white have low contrast. Fonts are **render-blocking** (`<link>` in `<head>`, no `preload`+`font-display` control beyond `swap`). |
| **Buttons** | Single fill + `/90` hover, no press/active depth | Reads generic-shadcn. No gradient, ring, or elevation to feel tactile — the "AI-slop default." |

---

## 2. Refined palette (saffron-forward)

**Principle:** one **warm saffron brand ramp** as the star; **warm-tinted neutrals** (not cool blue-grey) so the whole UI feels lit by the same light; green/navy demoted to **semantic-only**.

### Brand — Saffron ramp (replace opacity-hacks with real steps)
Extend the existing `--saffron-*` into a full 50–900 ramp and drive states off it:

| Token | HSL | Hex | Role |
|---|---|---|---|
| `saffron-50` | `30 100% 97%` | `#FFF7ED` | tint bg (badges, hover wells) |
| `saffron-100` | `30 96% 92%` | `#FFEAD5` | subtle fill |
| `saffron-200` | `29 95% 84%` | `#FED7AA` | borders on tint |
| `saffron-300` | `28 90% 73%` | `#FDBA74` | disabled brand |
| `saffron-400` | `28 85% 66%` | `#FB9E52` | hover-light |
| **`saffron-500`** | `28 78% 56%` | `#F08A2E` | **`--primary`** (slightly deeper than `#FF9933` for AA text contrast) |
| `saffron-600` | `24 82% 48%` | `#DE6D14` | **hover / pressed** |
| `saffron-700` | `20 82% 40%` | `#B4520F` | active, on-tint text |
| `saffron-800` | `18 80% 32%` | `#8A3D0C` | headings on tint |
| `saffron-900` | `16 78% 24%` | `#5E2907` | max emphasis |

> Keep `#FF9933` as the **marketing/flag** saffron (hero, logo) but let the **product** primary be `saffron-500` `#F08A2E` — it holds 4.5:1 on white for small text; `#FF9933` does not.

### Warm neutrals (retune the greys)
| Token | HSL | Hex |
|---|---|---|
| `--background` | `40 30% 99%` | `#FFFDFB` (keep warm off-white) |
| `--foreground` | `24 20% 12%` | `#231C18` (warm near-black, not blue) |
| `--muted` | `36 24% 96%` | `#F7F3EE` (warm, replaces cool `#F9FAFB`) |
| `--muted-foreground` | `28 8% 42%` | `#6E655F` |
| `--border` | `32 18% 88%` | `#E7E0D8` (raise contrast ~5% so edges show) |
| `--input` | `32 16% 84%` | `#DCD3C9` |
| `--card` | `0 0% 100%` | white — keep, so cards separate from warm bg |

### Semantic (demote flag colors here)
| Token | Hex | Use |
|---|---|---|
| `--success` = green | `#2C5F2D` → light `#3D8B40` | saved/confirmed only |
| `--info` = navy | `#1E3A8A` (soften from `#000080`) | info callouts only |
| `--warning` | `#D97706` | quota near-limit |
| `--destructive` | `#DC2626` | keep |

### Dark mode
Current dark is already strong (layered `9%→13%→17%`). Refinements: warm the base a hair (`24 14% 9%` instead of blue `222 18% 9%`) to stay in-family with the warm-light brand, and set dark `--primary` to `saffron-400 #FB9E52` for glow on near-black. Keep `--accent` as an elevation surface but **rename it `--surface-2`** in the token doc so it stops masquerading as a brand accent.

---

## 3. Type scale + Indic strategy

**Fonts.** Keep Outfit (display) + Inter (body) — good pairing. Two fixes:
1. **Self-host via `next/font`** (`next/font/google` for Inter/Outfit) instead of the render-blocking `<link>`. Gives automatic `font-display: swap`, size-adjust fallback metrics (kills CLS), and preload. This is the single highest-leverage perf+polish win.
2. **Indic:** current on-demand Noto injection is correct. Add **`size-adjust` fallback metrics** per Noto family so the swap from system → Noto doesn't reflow Bengali/Tamil. Keep min line-height 1.6 (1.7 for body) — already codified in `.indic-text`, good.

**Modular scale (1.25 major-third), weight-led hierarchy:**

| Token | Size / LH | Weight | Font | Use |
|---|---|---|---|---|
| `display` | 48/1.05 | 800 | Outfit | hero only |
| `h1` | 30/1.15, tracking `-0.02em` | 700 | Outfit | page title |
| `h2` | 24/1.2, `-0.01em` | 600 | Outfit | section |
| `h3` | 20/1.3 | 600 | Outfit | card title |
| `body-lg` | 18/1.6 | 500 | Inter | lead paragraph |
| `body` | 16/1.6 | 400 | Inter | default (bump from current 14 — 14 is small for rural readers) |
| `caption` | 13/1.4, `+0.04em`, uppercase | 600 | Inter | labels |

> Negative tracking on Outfit headings is what separates "designed" from "default." **Never apply negative tracking to Indic scripts** — guard with `:lang()` or keep it on Latin-only display strings.

---

## 4. Spacing / radius / border / elevation

**Spacing:** adopt an 8pt grid explicitly (4,8,12,16,24,32,48,64). Tailwind already gives this; the fix is *usage discipline* — the audited pages mix `gap-3/4/6/8` and `space-y-2/3/5` freely. Codify: **section gap 32/48, card padding 16→24, inline gap 8/12.**

**Radius — collapse to one ramp** (retire legacy `md`/`lg` split):
| Token | px | Use |
|---|---|---|
| `--radius-sm` | 8 | chips, inputs |
| `--radius-md` | 12 | buttons, inputs, small cards |
| `--radius-lg` | 16 | primary cards |
| `--radius-xl` | 24 | hero/result shell |
| `--radius-pill` | 9999 | orbs, badges |

**Elevation — actually visible, dual-layer (ambient + key):**
| Token | Value |
|---|---|
| `--shadow-xs` | `0 1px 2px rgb(24 20 16 / .06)` |
| `--shadow-sm` | `0 1px 3px rgb(24 20 16 / .08), 0 1px 2px rgb(24 20 16 / .06)` |
| `--shadow-md` | `0 4px 12px -2px rgb(24 20 16 / .10), 0 2px 6px -2px rgb(24 20 16 / .07)` |
| `--shadow-lg` | `0 12px 28px -6px rgb(24 20 16 / .14), 0 4px 10px -4px rgb(24 20 16 / .08)` |
| `--shadow-focus` | `0 0 0 3px hsl(28 78% 56% / .35)` |

Warm-black (`24 20 16`) shadow tint instead of pure black = shadows that belong to a warm room, not a grey one. Roughly **2–3× the current alpha** so cards read as surfaces.

**Borders:** move to `1px` warm border **+ shadow-sm together** on cards (border for definition, shadow for lift). Add `border-t` accent bar only on hero/result cards, not everywhere (current `.card-accent-bar` risks over-use).

---

## 5. Component styling direction (premium, not AI-slop)

- **Button (primary):** `saffron-500` fill, `saffron-600` hover, `saffron-700` active, `shadow-xs` at rest → `shadow-sm` on hover, `active:translate-y-px` for tactile press, `--shadow-focus` ring. Optional 1px top inner-highlight (`inset 0 1px 0 rgb(255 255 255 /.15)`) for a lit, dimensional fill. This alone erases the generic look.
- **Button (secondary/outline):** warm border + `bg-card`, hover fills `saffron-50` with `saffron-200` border — not the current grey `hover:bg-accent`.
- **Card:** `--radius-lg (16)`, warm `1px` border, `--shadow-sm` resting / `--shadow-md` on interactive hover, `hover:-translate-y-0.5` for lift. Keep the left-accent-bar pattern from `dashboard-home` but standardize to `border-l-2 border-l-primary` as the one "featured" motif.
- **Input:** `--radius-md`, warm border, on focus → `saffron-500` border + `--shadow-focus` ring (replace the offset double-ring, which looks like a bug on tinted bg). Height 44px (already good for touch).
- **Badge/chip:** `saffron-50` bg + `saffron-700` text + `saffron-200` border for brand chips (the hero already does this well — promote it to the `Badge` component as a `brand` variant).
- **Tabs:** active = `saffron-500` fill is heavy; consider **underline-indicator** tabs (2px `saffron-500` bottom border, transparent bg) for a lighter, more premium feel on content-dense pages. Keep the pill variant for segmented controls.
- **Skeleton:** add a **shimmer sweep** gradient (currently plain `animate-pulse`) — cheap, high perceived-quality.

---

## 6. Quick wins vs big bets

**Quick wins (½–1 day each, high impact):**
1. Retune neutrals to warm + raise border contrast (5 var edits).
2. Bump shadow alphas 2–3× with warm tint (4 vars) — instant depth.
3. Add `saffron-400/600/700/900` steps; point button hover/active at real steps, not `/90`.
4. `active:translate-y-px` + focus-ring on Button; shimmer on Skeleton.
5. Rename `--accent` → `--surface-2` in DESIGN_TOKENS.md (stop the lie).

**Big bets (planned, cross-cutting):**
1. **Self-host fonts via `next/font`** + Noto `size-adjust` metrics — perf + CLS + polish.
2. **Collapse the dual radius system** to one ramp; migrate `rounded-md/lg` call-sites.
3. **Semantic color migration** — move green/navy to `--success`/`--info`, sweep components off raw `secondary`/`accent`.
4. **Body text 14→16** app-wide (accessibility for rural readers) — needs layout QA on dense pages.
5. Underline-tab variant + `brand` Badge variant as first-class components.

**Guardrails:** Lucide-only (already honored — no emoji found). Every Indic string must keep LH ≥1.6 and **no negative tracking**. Test every palette change against the `.force-light` marketing subtree (it hard-copies `:root` values — must be updated in lockstep or it drifts).
