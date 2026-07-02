# 09 — Brand Identity & Illustration System

Reviewer's lens: Brand designer / illustrator. Read against `dashboard-home.tsx`, `community/page.tsx`, `layout/empty-state.tsx`, `organization/dashboard/components/empty-state.tsx`, `sahayak-avatar.tsx`, `logo.tsx`, `landing/script-marks.tsx`, and `public/`. Scope: visual identity + illustration, not code health.

## 1. Current-state assessment: warm palette, sterile surface

The **foundations are good and unusually principled**. The palette is the Indian tricolor done tastefully — saffron primary (`28° 70% 59%`), deep green secondary (`#2C5F2D`), navy accent (`#000080`) — over a warm off-white (`40 20% 99.5%`) instead of clinical `#fff`. Type pairs Outfit (headline) + Inter + a full Noto Sans Indic stack. `script-marks.tsx` is the single best brand instinct in the codebase: ghosted अ / க / আ / ಅ / ગ / ਅ glyphs at 6–7% opacity as ambient cultural texture. That's the whole brand idea, and it exists on exactly one screen.

Everywhere else the app is **visually barren**:
- **No illustration exists.** `find src -name "*.svg"` returns nothing. `public/images/` holds a *single* file — `sahayak_avatar.png`, a 640×640 JPEG used by exactly one component.
- **The logo is a raster PNG** (`/icons/icon-192x192.png`) — no vector mark, so it can't scale, recolor, animate, or theme. A company that ships an AI product has no scalable logo.
- **Iconography is a monoculture.** Per the taste audit (04), every tool is a Lucide glyph in `bg-primary/10 rounded-surface-md` — "a wall of orange-tinted squares." Icons carry 100% of the visual load and all look identical.
- **Empty states are intentionally illustration-free.** `layout/empty-state.tsx` documents this: illustrations were *removed* because "rural users often read illustrations literally ('where is the file cabinet?')." This is a real, hard-won UX finding and the illustration system below must respect it — not overrule it.
- **Achievement/celebration moments are unmarked.** No confetti, no earned-badge art, no warmth at the instant a teacher finishes their first lesson plan.

Net: the surface reads as competent SaaS, not as the warm, human, Bharat-rooted companion the brand claims in its own hero copy ("your personal AI companion").

## 2. Illustration system proposal

**Style: "Warm Chalk-Line Editorial."** Flat 2D, confident single-weight outlines (like chalk on slate), filled with the saffron/green/navy palette plus warm neutrals. Rounded, generous, never corporate-isometric. Motifs drawn from the *Indian classroom*, not clip-art India: slate & chalk, open textbook, takhti/wooden board, brass bell, chalk-dust rangoli arcs, banyan-tree shade, tiffin, seed-to-sapling growth. **Ban the clichés**: no Taj Mahal, no lotus-as-logo, no auto-rickshaw, no over-saturated "Incredible India" tourism palette, no folded-hands namaste-as-decoration.

**The literal-reading guardrail (critical).** The empty-state finding means illustration must be **decorative accent, never load-bearing instruction**. Rule: an illustration may sit *beside or behind* a clear Lucide icon + text label, but must never *replace* one. Empty states keep their icon+label+Example-card structure; illustration enters only as a soft rangoli-arc watermark behind them. This preserves the rural-comprehension win while removing the sterility.

**Placement map (where art goes):**
| Surface | Treatment | Load-bearing? |
|---|---|---|
| Dashboard hero | Faint chalk-line classroom horizon + `script-marks` behind the greeting | No — ambient |
| Empty states | Rangoli-arc watermark *behind* existing icon+label | No — accent only |
| Tool page headers | One bespoke spot illustration per tool (slate=lesson plan, growing sapling=quiz, brass bell=attendance…) | Semi — pairs with title, aids recognition |
| Onboarding | 3–4 warm scene illustrations (teacher at slate, students under banyan) | No — emotional framing |
| Achievement moments | Earned-badge art + chalk-dust confetti on first-generation / streaks | No — celebration |
| Community | Staff-room bench/chai-corner header illustration | No — sets "staff room" tone |

**Cultural authenticity + inclusivity.** This is an 11-language, all-India product — MEMORY flags "never Hindi-only." So: rotate motifs across regions (a Kerala coconut-frond arc, a Rajasthani jharokha window-frame, a Bengali alpona pattern, a Tamil kolam) rather than defaulting to North-Indian iconography. Depict teachers and students across skin tones, both genders, with and without hijab/turban/bindi, in both crowded-urban and single-room-rural settings. Keep faces abstract/inclusive (chalk-outline, not photoreal caste/region markers). Never render script *as decoration* in a language the viewer can't read as if it were their own — script-marks work because they're clearly ambient, not captions.

## 3. Iconography that complements Lucide

Keep Lucide as the **functional UI icon set** — buttons, nav, inline affordances (the "Lucide only" rule holds there). Add a **second, parallel tier: "Sahayak Spot Icons"** — a small library (~16) of larger, filled, saffron-palette *brand* glyphs for tool identity and section headers only. These are illustration-adjacent (slate, sapling, bell, tiffin, textbook), 2–3 colors, 48–96px, and solve the "wall of identical orange squares" by giving each tool a distinct recognizable mark while UI chrome stays clean Lucide. Rule of thumb: **Lucide for actions, Spot Icons for identity.** Never mix the two weights inside one control.

## 4. Brand-expression system (shapes, borders, textures)

- **The rangoli arc** — a repeatable set of concentric dotted/petalled arcs (derived from kolam) as the signature accent shape. Corner watermarks, section dividers, empty-state backdrops. This becomes the brand's "swoosh."
- **Chalk-dust texture** — a subtle grain/noise overlay (5–8% opacity) for hero and celebration surfaces, echoing slate. Ties to the chalk-line illustration language.
- **Script-marks, promoted** — take `script-marks.tsx` off the landing page and make it a reusable `<AmbientScript>` primitive available to any hero/empty surface, with a `density` prop.
- **Takhti border** — a warm wooden-frame border token for "showcase" cards (achievements, featured community posts), evoking the wooden writing board.
- **Tricolor hairline** — replace the stray `absolute top-0 h-1.5 bg-primary` ruler (flagged in 04) with a deliberate saffron→green→navy hairline used consistently as the page-top signature.

## 5. Sourcing & generation — efficient pipeline

- **Vectorize the logo first (P0).** Commission/redraw an SVG wordmark + standalone mark. Everything else (theming, animation, favicons, dark mode) unblocks from this. Non-negotiable.
- **SVG component system.** Author illustrations as React SVG components under `src/components/brand/` that consume CSS color variables (`hsl(var(--primary))`, `--secondary`, `--accent`) so art recolors for free in dark mode and never hardcodes hex. This mirrors how `google-g-icon.tsx` already inlines SVG. Ship as code, not `/public` PNGs — themeable, tree-shakeable, crisp.
- **AI-gen guidelines** (for drafting, then hand-cleaned to SVG): fixed prompt kernel — *"flat 2D editorial vector illustration, single-weight chalk-line outline, saffron/deep-green/navy palette on warm cream, Indian classroom motif, inclusive abstract figures, no photorealism, no Taj Mahal/rickshaw/tourism clichés, transparent background."* Generate → trace to SVG (so it stays crisp + recolorable) → run through the design-taste-enforcer skill → QA against the literal-reading and inclusivity rules above. Never ship a raw raster AI export into the UI.
- **Governance.** One page in `docs/design/` documenting the motif list, the cliché ban-list, and the "accent-not-instruction" rule so contributors don't regress to file-cabinet literalism or North-India default.

## 6. Quick-wins vs big-bets

**Quick wins (days):**
1. Vectorize the logo → SVG wordmark + mark (unblocks everything).
2. Promote `script-marks.tsx` → reusable `<AmbientScript>`; drop behind dashboard hero + empty states at low opacity.
3. Add the rangoli-arc watermark SVG behind existing empty states (accent only — structure untouched).
4. Replace the stray top ruler with the tricolor-hairline signature.
5. Chalk-dust confetti on first-generation success.

**Big bets (weeks):**
1. The 16-piece **Sahayak Spot Icon** library — one identity glyph per tool, killing the orange-square monoculture.
2. Full **onboarding illustration set** (3–4 warm classroom scenes) with regional rotation.
3. Bespoke **tool-header spot illustrations** across all ~14 generators for a coherent, illustration-rich product.
4. **Achievement/badge art** system tied to streaks and milestones.
