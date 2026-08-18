# DIRECTION_brand.md — SahayakAI

## Creative Direction: **"The Ledger"** — Quiet Institutional Confidence

**Lens:** Creative Director / Brand. This document owns the *one idea*. Colour-math,
component tables, and screen specs get elaborated by the system/engineering lenses;
here I commit the concept, the mood, the identity, and the three moments a user
remembers. Everything is buildable on the existing Flutter/M3 stack today and honours
every hard constraint (AA contrast with ratios stated, 11-script Indic coverage,
48dp targets, no emoji, teacher dignity, the 747-test re-skin boundary).

---

## 1. Why the shipped app reads as "extremely boring" (diagnosis from the four screenshots)

Not one bug — a stack of defaults that add up to *utility software*, not a prestigious
institution's tool:

1. **Clinical pure-white, everywhere.** `#FEFEFD`/`#FFFFFF` scaffold + card + input.
   There is no paper, no warmth, no material. A ₹4-lakh-fee school's letterhead is
   ivory stock with an engraved crest; this is a hospital form.
2. **Interchangeable M3 boxes.** The dashboard (`03_dashboard.png`) is six identical
   rounded cards in a vertical stack — same radius, same shadow, same pink icon chip,
   same chevron. Nothing is more important than anything else. It reads as a *settings
   list*, not a workspace a department head is proud to open.
3. **The icon chips are pastel, not premium.** `primaryContainer #FBF2E9` behind a
   saffron glyph reads as a children's-app pastel. Premium brands earn colour; they
   don't tint every tile.
4. **Weak, single-family hierarchy.** Outfit-bold title over a grey Inter subtitle at
   nearly the same size, repeated. No display face, no serif, no gravitas, no
   editorial rhythm. "Welcome back" is a bold line floating in white space.
5. **Saffron is simultaneously timid and muddy.** As `#C2410C` on a large fill (the
   Generate button, `04_lessonplan.png`) it reads as a dull brown-orange, not confident
   saffron. And the *real* brand saffron `#FF9933` never gets a single moment to shine.
6. **Zero depth.** `elevation: 1` hairline shadows are so flat the screens look like
   greyboxes. No layering, no lift, no sense that a card is a physical object.
7. **Zero signature, zero motion.** The splash, the home, and the moment a lesson plan
   renders are all indistinguishable from a Flutter starter template. Nothing is
   *authored*. A result "renders" as a wall of text, like a chat dump.
8. **Utilitarian empty/forms.** The lesson-plan form is a stack of grey pills and grey
   inputs with a muddy CTA — no brand, no warmth, no confidence.

The through-line: **it looks generated, not curated.** The fix is not "more colour" or
"more animation" — a premium Indian school is defined by *restraint*. The fix is a
material, a masthead, and a seal.

---

## 2. The big idea — "The Ledger"

> SahayakAI should feel like a **beautifully bound institutional almanac** from a
> heritage school — ivory stock, ink-black type, a serif masthead, hairline ruled
> registers, and a single saffron wax-seal that authenticates the work. It is the
> teacher's ledger: everything they make is *recorded*, *composed*, and *sealed*, not
> "generated."

Emotional register: **composed, warm, authoritative, unhurried.** The confidence of a
principal's office — heritage without stuffiness, warmth without childishness, luxury
that whispers. It respects the teacher as a professional whose craft is being set in
type, not a user filling a form.

Three commitments that carry the whole concept:

- **Material: Ivory & Ink.** Replace clinical white with a warm ivory "paper" ground and
  a warm near-black "ink". Structure comes from **hairline rules** (the ledger's ruled
  lines), not from boxing everything in identical shadowed cards.
- **Masthead: a serif.** Introduce **one** editorial serif (Fraunces + Noto Serif per
  script) used *only* for signature moments — the wordmark, screen mastheads, the
  almanac date, and result titles. This single move does 80% of the premium lifting and
  instantly separates SahayakAI from every generic Outfit/Inter M3 app.
- **Seal: saffron as authentication.** Saffron stops being a timid tile-tint and becomes
  a **wax seal / ink stamp** — small, deliberate, high-value. It appears on the CTA, the
  active state, a 3dp "ribbon" accent, the monogram seal, and nowhere else. Scarcity is
  what makes it read as premium (and it keeps 60-30-10 honest).

Name to use internally: **"The Ledger."** One word the whole team can design against:
*would a heritage school's headmaster keep this in their ledger?*

---

## 3. Material system — Ivory & Ink (exact values + ratios)

Warm the neutrals; keep the accessible saffron split already hard-won in `AppColors`.

### 3.1 Light — "Ivory"
| Role | New hex | Was | Contrast (stated) |
|---|---|---|---|
| `background` (paper) | **`#FBF7F0`** ivory | `#FEFEFD` | ink on it = **15.8:1** |
| `surface` (raised sheet) | **`#FFFFFF`** | `#FFFFFF` | (kept — sheets sit *above* the paper) |
| `surfaceContainerLow` (inset well) | **`#F5EFE4`** | `#FAFAFA` | structural, non-text |
| `onSurface` (ink) | **`#1A1D24`** warm ink | `#0F1729` | on ivory = **15.8:1** ✓ AA |
| `onSurfaceVariant` (muted) | **`#5B6A7F`** | `#65758B` | on ivory = **4.74:1** ✓ AA¹ |
| `primary` (saffron seal) | `#C2410C` **(kept)** | — | white-on = 5.18:1, on-ivory = ~4.9:1 ✓ |
| `outline` (hairline rule) | **`#E6DED0`** | `#EAECF0` | decorative hairline (exempt) |
| `outlineVariant` | **`#EFE8DC`** | `#E1E4EA` | decorative |
| `secondary` (green) | `#28572B` **(kept)** | — | flag green, success only |
| `tertiary` (navy) | `#000080` **(kept)** | — | rare high-attention only |
| **`brandBrass`** (ornament) | **`#B08D57`** *new* | — | **decorative ONLY** — seal ring, ornaments, never text² |
| **`brandSaffron`** (moment) | `#FF9933` **(kept)** | — | large decorative only — the seal fill, splash mark |

¹ The existing `#65758B` passes 4.6:1 on pure white but drops to 4.4:1 on the warmer
ivory. Darkening to `#5B6A7F` restores AA (4.74:1). **This is the one required token
change to keep muted body text compliant on the new ground.**
² Brass never carries text or a small icon that must be read. It is a hairline/ornament
tone (seal ring, the 1px rule under a masthead). Kept off text so no AA obligation.

### 3.2 Dark — "Ink on Charcoal"
Warm the charcoal a hair so it reads as inked paper at night, keep the bright saffron.
| Role | New hex | Was |
|---|---|---|
| `background` | **`#16151B`** (warm charcoal) | `#13151B` |
| `surface` | **`#201E26`** | `#1C1F26` |
| `onSurface` | `#F2F5F8` **(kept)** | — |
| `onSurfaceVariant` | `#95A1B2` **(kept, 6.9:1)** | — |
| `primary` (saffron) | `#FFAB57` **(kept)** — 9.7:1 on dark ✓ | — |
| `outline` (hairline) | **`#332F2A`** (warm) | `#31353F` |
| `brandBrass` (ornament) | **`#8A6E43`** | — |

**Depth, not flatness.** Replace `elevation: 1` hairline shadows with the *paper*
grammar below. Cards become sheets that visibly lift off the ivory; hero surfaces float.

```dart
// AppShadows additions — "paper" depth (light-tuned; halve alpha in dark)
static final List<BoxShadow> paperRest = [           // default card / sheet
  BoxShadow(color: Color(0x14000000), offset: Offset(0, 1),  blurRadius: 2),   // 8%
  BoxShadow(color: Color(0x0F1A1D24), offset: Offset(0, 10), blurRadius: 24, spreadRadius: -8), // ink 6% long
];
static final List<BoxShadow> paperLift = [           // hero / result sheet
  BoxShadow(color: Color(0x14000000), offset: Offset(0, 2),  blurRadius: 4),
  BoxShadow(color: Color(0x141A1D24), offset: Offset(0, 24), blurRadius: 48, spreadRadius: -16),
];
```
The long, soft, low-opacity ink shadow (offset y=10–24, negative spread) is the single
biggest "cheap → expensive" lever after the serif. It reads as a real sheet on a desk.

---

## 4. Typography — introduce the masthead serif

Keep **Inter** (body) and **Outfit** (functional UI titles/labels) exactly as specified
in THEME_SPEC — they stay, the whole label/body scale is untouched. **Add one display
family** for signature moments only.

### 4.1 The serif (buildable, fully Indic-covered)
| Role | Latin | Indic fallback (all 9 scripts exist on Google Fonts) |
|---|---|---|
| **Display / Masthead** | **Fraunces** (`GoogleFonts.fraunces`) | Noto Serif Devanagari / Bengali / Tamil / Telugu / Kannada / Malayalam / Gujarati / Gurmukhi / Oriya |

Fraunces is an editorial "old-style" serif with soft bracketed serifs and optical-size
warmth — heritage-luxury, not cold. Critically, **`Noto Serif <script>` exists for every
one of the 11 languages**, so the serif identity survives across Devanagari, Bengali,
Tamil, Telugu, Kannada, Malayalam, Gujarati, Gurmukhi, and Oriya. Build the same
fallback-chain + warm-fonts pattern already in `app_text.dart`:

```dart
const List<String> kSerifIndicFallback = [
  'Noto Serif Devanagari', 'Noto Serif Bengali', 'Noto Serif Tamil',
  'Noto Serif Telugu', 'Noto Serif Kannada', 'Noto Serif Malayalam',
  'Noto Serif Gujarati', 'Noto Serif Gurmukhi', 'Noto Serif Oriya',
];
// warmSerifFonts(): call each GoogleFonts.notoSerif<Script>() + GoogleFonts.fraunces()
// at startup, exactly like warmIndicFonts(), so families register before fallback use.
```
Indic line-heights follow the same `isIndic` clamp (≥1.45 display / ≥1.7 body). No matra
clips because Noto Serif ships the full conjunct set. **If a serif ever fails to resolve
for a script, the chain falls back to the existing Outfit/Noto Sans — never a tofu box.**

### 4.2 New display slots (add to `AppText`, sparingly used)
| Slot | Font | Size | Weight | Height (Latin/Indic) | Letter-spacing | Use |
|---|---|---|---|---|---|---|
| `mastheadHero` | Fraunces | 34 | w600 | 1.25 / 1.45 | -0.5 | splash & result titles |
| `mastheadLarge` | Fraunces | 26 | w600 | 1.3 / 1.45 | -0.3 | screen mastheads ("Welcome back", tool result title) |
| `mastheadEyebrow` | Fraunces | 14 | w500 | 1.4 / 1.5 | +1.2 (small-caps feel, UPPERCASE) | section eyebrow ("YOUR TEACHING TOOLS") |
| `almanacNumeral` | Fraunces | 20 | w500 | 1.3 / 1.45 | 0 | the almanac date / index numerals |

Everything else — buttons, chips, inputs, nav, body — stays on Inter/Outfit at the
current sizes. The serif is a *spice*, present on roughly 3–4 strings per screen. That
restraint is the point.

---

## 5. Signature identity elements (the visual vocabulary)

1. **The Seal (monogram).** A saffron `#FF9933` engraved monogram inside a 1px brass
   hairline ring. Replaces the pastel-pink rounded-square logo. Reused as: splash mark,
   empty-state watermark (at 6% ink opacity), and a small section ornament. This is the
   crest — the single most repeatable brand asset.
2. **Ruled registers, not boxed cards.** The dashboard's six identical cards become an
   **editorial ruled list**: each tool is a row with a generous left margin, an
   almanac index numeral or a single refined Lucide glyph in a tinted seal (`primary` @
   10% ivory-warm, *not* pink pastel), the tool name in Outfit, a one-line description in
   muted ink, and a **1px hairline rule** (`outline #E6DED0`) between rows. Hierarchy
   returns via rhythm and rules instead of six drop-shadowed boxes.
3. **The Saffron Ribbon.** A 3dp saffron top-strip (`primary → primary @ 40%`, the one
   sanctioned gradient) on the *active* screen masthead and on a rendered result sheet.
   The ledger's bookmark ribbon. Tiny, deliberate, unmistakable.
4. **Hairline discipline.** 1px warm hairlines are the primary structural device
   everywhere — under mastheads, between list rows, framing the ivory well of a form.
   Replaces heavy borders and identical card shadows.
5. **Saffron as scarcity.** Saffron only ever: CTA fill, active nav icon/label, focus
   ring, the ribbon, the seal. Grep target: saffron surface area < 10% of any screen.

---

## 6. The three "wow" moments

### Moment 1 — The Seal (splash / login, replaces `01_launch.png`)
Ivory ground. Centre: the saffron monogram seal presses in — `scale 0.92 → 1.0`,
opacity `0 → 1`, **150ms** `easeOutQuart`, a whisper of settle. Below it, the wordmark
**"SahayakAI" in Fraunces**, and a single **ink underline draws left-to-right** beneath
it (`width 0 → full`, **600ms** `easeOutQuart`) — the signature of authorship. The
login card is an ivory sheet with `paperRest`, the three value-props as a hairline ruled
list (not saffron-icon bullets), and one confident saffron CTA. The status bar goes warm
ivory. First impression: *a bound book being opened*, not an app login.

### Moment 2 — The Almanac (dashboard home, replaces `03_dashboard.png`)
A serif masthead: small-caps Fraunces eyebrow **"SahayakAI"**, then a warm greeting in
`mastheadLarge` Fraunces, then **today's date as an almanac line** (`almanacNumeral`,
e.g. *"Friday · 18 July"*) — instantly editorial, instantly not-a-template. Below, the
eyebrow **"YOUR TEACHING TOOLS"** and the **ruled register** of tools (§5.2). On first
paint the rows perform the **ink-settle** stagger (below). The result is a page that
looks *composed by an editor*, with clear rhythm and a single saffron ribbon on the
masthead — the antithesis of six grey boxes.

### Moment 3 — Inking the Page (result render, the payoff)
When a lesson plan / quiz / worksheet generates, it does **not** dump into a chat bubble.
It renders onto an **ivory result sheet** (`paperLift`, saffron ribbon at the top edge)
with a **Fraunces title**, a 1px hairline rule beneath it, and the content **settling in
block-by-block** — each block `opacity 0→1, translateY 8→0`, **350ms** `easeOutQuart`,
**40ms stagger** per block. It feels like a document being *printed and sealed*, the
teacher's craft set in type. This is the emotional core of "The Ledger": the app records
your work with the dignity of a real institution.

```dart
// "Ink-settle" — the signature reveal (flutter_animate, buildable today)
Widget inkSettle(Widget child, int index) => child
  .animate(delay: (index * 40).ms)
  .fadeIn(duration: 350.ms, curve: AppMotion.easeOutQuart)
  .moveY(begin: 8, end: 0, duration: 350.ms, curve: AppMotion.easeOutQuart);
```
All motion uses the *single* canonical `easeOutQuart` and stays within the 120–400ms
rubric ceiling. `flutter_animate` is the only new dependency, already sanctioned.

---

## 7. What changes vs. what is protected

**Changes (presentation layer only):** neutral tokens → ivory/ink; add Fraunces +
Noto Serif fallbacks + 4 display slots; add `paperRest`/`paperLift` shadows; the seal
mark; dashboard cards → ruled register; saffron ribbon; three signature moments; darken
`onSurfaceVariant` to `#5B6A7F` for AA on ivory.

**Protected (untouched):** all functional wiring and the 747 tests; the Inter/Outfit
body+label scale; the accessible saffron split (`#C2410C` light / `#FFAB57` dark) and
every stated ratio; 48dp targets; Lucide-only, no emoji; the 11-language Indic
line-height clamp; the 4dp spacing grid; the single `easeOutQuart` curve. This is a
re-skin of theme tokens + shared widgets + three hero screens, not a rewrite.

**AA sign-off:** ink `#1A1D24` on ivory `#FBF7F0` = 15.8:1; muted `#5B6A7F` on ivory =
4.74:1; saffron split ratios unchanged and already AA; brass and the seal are
decorative-only (no text obligation). Every text pairing introduced here passes WCAG AA.
