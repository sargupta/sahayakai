# SahayakAI Flutter — DESIGN RUBRIC

**Purpose.** A concrete, checkable rubric that PREVENTS the layout/design failures the previous Flutter attempt hit. Every item is pass/fail — no "looks fine" judgments. Ground truth = the web design system (`sahayakai-main/src/app/globals.css` + `sahayakai-main/docs/DESIGN_TOKENS.md`) plus project design memory (no emojis; 11 Indic languages never Hindi-only; voice-first; rural+urban; dignity in teacher-facing copy; 48dp touch targets).

**How to use.** Every screen must pass Section 12 (15-point pre-merge checklist) before merge. Sections 1–11 are the standards those 15 points reference. When a value is given, use that exact value — do not approximate, do not invent a new one.

**Target.** Native Flutter, Material 3 (`useMaterial3: true`), Android-first, min phone width 360dp, up to 7"/10" tablets.

---

## 0. Canonical token constants (put these in `lib/theme/` and never hardcode elsewhere)

These are the ONLY design values allowed in the app. Map them once, reference by name forever. Hex values are the source-of-truth HSL from `globals.css` converted to sRGB.

### Colors — light (`ColorScheme.light`)
| Token | HSL (source) | Hex | Flutter role |
|---|---|---|---|
| primary (Saffron) | `28 70% 59%` | `#FF9933` | `colorScheme.primary` |
| onPrimary | `0 0% 100%` | `#FFFFFF` | `colorScheme.onPrimary` |
| secondary (Green) | `123 37% 25%` | `#2C5F2D` | `colorScheme.secondary` |
| onSecondary | `0 0% 100%` | `#FFFFFF` | `colorScheme.onSecondary` |
| accent (Navy) | `240 100% 25%` | `#000080` | `colorScheme.tertiary` (rare use) |
| background | `40 20% 99.5%` | `#FFFEFB` | `scaffoldBackgroundColor` / `surface` |
| foreground (text) | `222 47% 11%` | `#1B2637` | `colorScheme.onSurface` |
| card | `0 0% 100%` | `#FFFFFF` | `Card` / `surfaceContainerLowest` |
| muted | `210 40% 96%` | `#F1F5F9` | `surfaceContainerHigh` (grouping blocks) |
| muted-foreground | `215 16% 47%` | `#6B7686` | `onSurfaceVariant` (secondary text) |
| border | `220 16% 93%` | `#E8EBF0` | `outlineVariant` / dividers |
| input border | `220 16% 90%` | `#DFE3EA` | input `enabledBorder` |
| ring (focus) | `28 70% 59%` | `#FF9933` | focus indicator |
| destructive | `0 84% 60%` | `#EF4444` | `colorScheme.error` |
| onDestructive | `0 0% 100%` | `#FFFFFF` | `colorScheme.onError` |

### Colors — dark (`ColorScheme.dark`)
| Token | HSL (source) | Hex |
|---|---|---|
| background | `222 18% 9%` | `#131722` |
| foreground | `210 30% 96%` | `#EFF3F8` |
| card | `222 16% 13%` | `#1B1F29` |
| popover | `222 16% 14%` | `#1D212C` |
| primary | `28 80% 60%` | `#F5993D` |
| secondary | `123 33% 40%` | `#448746` |
| muted | `222 14% 17%` | `#252932` |
| muted-foreground | `215 16% 64%` | `#98A0AE` |
| accent (hover surf) | `222 15% 20%` | `#2B2F3A` |
| border/input | `222 13% 22%` | `#30343E` |
| destructive | `0 62% 45%` | `#B92B2B` |

**PASS:** every color used in the app resolves to a `Theme.of(context).colorScheme.*` role or a named constant in `lib/theme/app_colors.dart`.
**FAIL:** any `Color(0xFF…)` literal outside `lib/theme/`; any `Colors.orange`/`Colors.blue` Material default; any color that isn't in the tables above.

### Radius (`lib/theme/app_radius.dart`)
| Name | Value | Use |
|---|---|---|
| `radiusSm` | `6.0` | chips, pills, inline tags |
| `radiusMd` | `12.0` | **default** — cards, buttons, inputs |
| `radiusLg` | `20.0` | hero / onboarding surfaces only |
| `radiusPill` | `9999.0` (use `StadiumBorder`) | voice orbs, badges, full pills |

**FAIL:** any `BorderRadius.circular(14)`, `.circular(16)`, `.circular(8)` or other off-scale value.

### Elevation / shadow (`lib/theme/app_shadows.dart`)
Match web's soft grammar — do NOT use Material's default heavy elevations.
| Name | Web equiv | Flutter `BoxShadow` |
|---|---|---|
| `shadowSoft` | `0 1px 2px /0.04` | `BoxShadow(color: onSurface.withOpacity(.04), blurRadius: 2, offset: Offset(0,1))` — cards at rest |
| `shadowElevated` | `0 4px 12px /0.08` | `blurRadius: 12, offset: Offset(0,4), opacity .08` — hover/pressed/important |
| `shadowFloating` | `0 16px 40px /0.12` | `blurRadius: 40, offset: Offset(0,16), opacity .12` — dialogs, sheets, menus |

**PASS:** `Card`/`Material` elevation ≤ 1 with custom `shadowSoft`; sheets use `shadowFloating`.
**FAIL:** default `Card` elevation (Material 3 tonal flood), `elevation: 8`, drop shadows darker than `.12`.

### Spacing — 4dp grid (`lib/theme/app_spacing.dart`)
Allowed multiples only: **4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80, 96, 128**.
| Name | dp | Recipe use |
|---|---|---|
| `space1` | 4 | icon↔label gap |
| `space2` | 8 | tight internal |
| `space3` | 12 | **internal card gap** |
| `space4` | 16 | **default card padding**, form field rows |
| `space6` | 24 | card padding (tablet), block gap |
| `space8` | 32 | section gap |
| `space12` | 48 | page section break |

**FAIL:** any `EdgeInsets` / `SizedBox` using 5, 6, 10, 14, 15, 18, 22, 25, 30 dp (off-grid); any raw magic number not from this list.

### Motion (`lib/theme/app_motion.dart`)
| Name | Duration | Curve | Use |
|---|---|---|---|
| `motionMicro` | `150ms` | `easeOutQuart` | hover, focus, color, tap feedback |
| `motionSmall` | `250ms` | `easeOutQuart` | accordion, reveal, dropdown |
| `motionMedium` | `350ms` | `easeOutQuart` | page transition, dialog, bottom sheet |

`easeOutQuart = Cubic(0.16, 1.0, 0.3, 1.0)` — the SINGLE canonical curve. **FAIL:** `Curves.bounceIn`, `Curves.elasticOut`, `Curves.linear` on UI reveals, any duration <120ms or >400ms, more than one custom curve in the codebase.

### Typography (`lib/theme/app_text.dart`)
Fonts: **Outfit** (headings), **Inter** (body/UI), **Noto Sans <script>** (Indic runtime). Bundle Outfit weights 400/500/600/700/800 and Inter 300/400/500/600/700 as assets (do NOT rely on Google Fonts network fetch — rural = offline). Hierarchy is **weight-first, size-second** (size-only hierarchy breaks on Devanagari/Tamil conjuncts).

| Style | Font | Size (sp) | Weight | Height (line-height) | Maps to |
|---|---|---|---|---|---|
| `typeH1` | Outfit | 30 | w700 | 1.15 | page title / `displaySmall` |
| `typeH2` | Outfit | 24 | w600 | 1.20 | section title / `headlineSmall` |
| `typeH3` | Outfit | 18 | w600 | 1.30 | sub-section / `titleLarge` |
| `typeBodyLg` | Inter | 16 | w500 | 1.60 | lead paragraph / `bodyLarge` |
| `typeBody` | Inter | 14 | w400 | 1.60 | **default** body / `bodyMedium` |
| `typeCaption` | Inter | 12 | w500 | 1.40 | labels/eyebrow, `letterSpacing: 0.5`, UPPERCASE / `labelSmall` |

**Indic rules (hard):**
- Minimum `height` (line-height) **1.4** for ANY text; body target **1.6**; AI-output blocks (lesson plans, quizzes, community) use **1.7** (the web `.indic-text` value).
- Minimum font size **12sp** for any teacher-facing text. No `9/10/11sp`.
- **Never** `height: 1.0` / `height: 1.1` on body — clips matras/diacritics. Headings may use ≤1.2 only if single-line AND weight ≥ w600.
- Use `textHeightBehavior: TextHeightBehavior(applyHeightToFirstAscent: true, applyHeightToLastDescent: true)` on Indic paragraph blocks so top matras / bottom vowel signs aren't cropped.
- `softWrap: true` always; long compound Sanskrit/Tamil words must wrap, never horizontal-scroll (see §8).

**FAIL:** `GoogleFonts` network call as the only font source; `TextStyle(fontSize: 11)`; any body `height` < 1.4; a heading rendered by size difference alone with equal weight.

---

## 1. Spacing scale & section rhythm — pass/fail

- [ ] Every `EdgeInsets`, `SizedBox`, `Gap`, `padding`, `margin` value is a member of the 4dp set (§0). **FAIL** on any off-grid value.
- [ ] Card padding = `space4` (16) on phone, `space6` (24) on tablet (≥600dp width). Not 12, not 20.
- [ ] Vertical rhythm inside a card = `space3` (12) between elements. Between cards/sections = `space8` (32). Between major page blocks = `space12` (48).
- [ ] Screen horizontal safe padding = `space4` (16) phone / `space6` (24) tablet. Consistent across ALL screens — measure two screens, they must match.
- [ ] No stacked `SizedBox` + `Padding` doing the same job (double-spacing). One spacing mechanism per gap.
- [ ] List separators use a single `space3`/`space4` — not mixed gaps in the same list.

## 2. Touch targets — pass/fail (rural, thumb-first)

- [ ] Every tappable element (`IconButton`, `InkWell`, chip, list row action, checkbox, radio, switch) has a hit area **≥ 48×48 dp**. Verify with `debugPaintSizeEnabled` or the widget's `constraints`.
- [ ] `IconButton` uses default `48` min or explicit `constraints: BoxConstraints(minWidth: 48, minHeight: 48)`. **FAIL:** `iconSize: 18` with no padding giving a 24dp target.
- [ ] Primary CTAs (voice call, generate, submit) are **≥ 56 dp tall** and full-width or ≥ 64dp wide — reachable one-handed.
- [ ] Adjacent tap targets have **≥ 8 dp** gap so fat-thumb mis-taps don't happen.
- [ ] The main voice-first action (start call / speak) is the largest, lowest, most reachable control on its screen (thumb zone, bottom third).
- [ ] Text links inside dense copy still expand to a 48dp tap row (wrap in `InkWell` with padding), not a 14sp hairline.

## 3. Typography hierarchy — pass/fail

- [ ] All text uses a named style from §0 (`typeH1…typeCaption` / mapped `TextTheme`). **FAIL:** ad-hoc `TextStyle(fontSize: 17, fontWeight: w600)`.
- [ ] Headings render in Outfit; body/labels in Inter. No screen mixes a third family.
- [ ] Hierarchy is visible via **weight**, then size — an H2 and body of the same size must still differ by weight.
- [ ] Indic content blocks use `height ≥ 1.6` (1.7 for AI output). Test with a Bengali AND a Tamil string, not just English.
- [ ] No clipped glyphs: render the longest Indic sample (see §11 test strings) and confirm no top matra or bottom vowel sign is cut. Zoom the screenshot to verify.
- [ ] Max line length for reading text ≈ 66 chars — on tablet, constrain reading columns (don't let paragraphs run the full 10" width).
- [ ] `textScaleFactor` up to **1.3** does not break any screen (system font-size accessibility). Layouts flex, text does not overflow.

## 4. Color usage — pass/fail (60-30-10, saffron as accent)

- [ ] **60%** neutral surface (`background`/`card`/`muted`), **30%** text + structure (`foreground`/`border`), **10%** saffron accent. Saffron is an ACCENT, never a flood.
- [ ] Saffron (`primary`) appears only on: primary CTA, active/selected state, brand mark, focus ring. **FAIL:** saffron app bar background, saffron full-card fills, saffron page backgrounds.
- [ ] Green (`secondary`) only for success/"saved" states. **Never** in the same element as saffron.
- [ ] Navy (`tertiary`) is rare — high-attention info badge only.
- [ ] No raw gradients except the one sanctioned card-accent bar (`primary → primary/40`, 4dp tall top strip). **FAIL:** random purple/pink hero gradients, gradient backgrounds behind body text.
- [ ] Contrast: body text on its background ≥ **4.5:1** (WCAG AA); large text (≥18sp semibold) ≥ **3:1**. `muted-foreground #6B7686` on `#FFFFFF` = 4.6:1 → OK for ≥14sp. Verify any text placed on saffron uses `onPrimary #FFFFFF` (≥4.5:1).
- [ ] Dark mode uses the §0 dark tables — not auto-inverted colors. Elevation reads via layered surfaces (bg < card < muted < border), not a single flat navy.
- [ ] Status colors only from tokens: error = `#EF4444`, success = green `secondary`. No `Colors.red`/`Colors.green`.

## 5. Consistent card grammar — pass/fail

Every card (the default container) MUST be:
- [ ] Radius `radiusMd` (12), shadow `shadowSoft`, border `1dp outlineVariant`, padding `space4/space6`, internal gap `space3`.
- [ ] Same corner radius across ALL cards on a screen — no mixing 12 and 20.
- [ ] Optional 4dp saffron `card-accent-bar` top strip is the ONLY decorative flourish allowed.
- [ ] Icon-in-card uses the `tool-icon-wrap` pattern: 48×48 rounded-12 container, `primary/10` fill, `primary` icon, `shrink`.
- [ ] One card component (`AppCard`) reused everywhere — **FAIL:** three different bespoke `Container(decoration:…)` card looks across screens.

## 6. State coverage — pass/fail (EVERY screen, no exceptions)

For **every** screen/data surface, all five states are designed and reachable:
- [ ] **Loading** → skeleton placeholders (shimmer of the real layout), NOT a bare centered `CircularProgressIndicator` for full-screen loads. Skeletons match final content shape.
- [ ] **Empty** → illustration/Lucide icon + one-line dignified explanation + a clear next action. Never a blank white screen. Copy respects teacher dignity (§10).
- [ ] **Error** → human message in the user's language + a Retry button (≥48dp). No raw exception strings, no English-only stack text.
- [ ] **Offline** → explicit offline banner/state; cached content shown where possible; actions that need network are disabled with a "you're offline" hint (rural = intermittent 2G). Voice/AI actions must degrade gracefully.
- [ ] **Success/loaded** → the real content.

**FAIL:** any screen that shows only the happy path; any `FutureBuilder` without `hasError` + no-data branches; a spinner as the "empty" state.

## 7. Responsive — pass/fail (360dp → 10" tablet)

- [ ] No horizontal overflow at **360 dp** width (smallest common Android). Run each screen at 360, 411, 600, 800, 1280 logical px.
- [ ] No `RenderFlex overflowed` / yellow-black stripes in any state, any language, at `textScaleFactor` 1.0 and 1.3.
- [ ] Use `LayoutBuilder`/`MediaQuery` breakpoints: <600dp = single column; ≥600dp = 2-col grids / max reading width `672` (container-narrow) / `1024` (default) / `1280` (wide) equivalents.
- [ ] Fixed-height boxes are banned for text content — height wraps content (`IntrinsicHeight` / min constraints), so Indic wrap and font scaling don't clip.
- [ ] Images/media use `BoxFit` + `maxWidth: double.infinity`, never fixed pixel widths that overflow narrow phones.
- [ ] Tablet layouts don't just stretch phone UI: reading columns are constrained, not full-bleed 1000dp lines.

## 8. Overflow & wrapping — pass/fail

- [ ] Long Indic compound words wrap (`softWrap: true`, `overflow: TextOverflow.visible` in flexible parents) — never horizontal scroll of body text (web `.demo-safe-wrap` behavior).
- [ ] Rows with text + trailing widget wrap the text in `Expanded`/`Flexible` so it truncates or wraps, not the whole row overflowing.
- [ ] Tables / wide content live inside a horizontally scrollable container; the page body itself never scrolls sideways.
- [ ] Buttons with long translated labels (German-length Malayalam) don't clip — labels wrap to 2 lines or the button grows; no ellipsis on a primary CTA.

## 9. Safe areas & system chrome — pass/fail

- [ ] Every screen's scaffold body respects `SafeArea` (notch, status bar, gesture nav bar). No content under the status bar or behind the nav pill.
- [ ] `SystemUiOverlayStyle` set: status bar icons contrast the app bar (dark icons on light `background`, light icons in dark mode). Set per-theme, not hardcoded.
- [ ] Bottom action bars / FAB / voice button sit **above** the gesture inset (`MediaQuery.viewPadding.bottom`), not flush to screen edge.
- [ ] Keyboard: input screens use `resizeToAvoidBottomInset: true`; the focused field scrolls into view above the keyboard; no field hidden behind it.
- [ ] Edge-to-edge is deliberate (Android 15 default) — backgrounds extend, but interactive/text content stays inside safe insets.

## 10. Copy & dignity — pass/fail (teacher-facing)

- [ ] **No emojis anywhere.** Icons come from a Lucide-equivalent set only (§13). Grep the codebase for emoji — zero hits.
- [ ] **Never Hindi-only.** All 11 Indic languages are first-class; the language picker is reachable; no string is hardcoded English or Hindi. Every user-facing string is in the i18n table.
- [ ] Teacher-facing copy is respectful — no aggressive marketing jargon, no "fix your bad teaching" framing. Empty/error copy assumes competence.
- [ ] No em dashes in UI copy (project style). Numerals and dates localize per script where applicable.
- [ ] Voice-first: primary flows are operable by voice/one tap; text is a secondary path, never the only path for the core parent-call/AI action.

## 11. Anti-AI-slop — pass/fail

- [ ] **No generic centered hero stack** (big centered icon + centered H1 + centered subtitle + centered button) as a default screen skeleton. Content is left-aligned, real, and dense where content exists.
- [ ] **No random gradients**, no glassmorphism-for-decoration, no purple/indigo "AI" palette — only the saffron/green/navy system.
- [ ] **Real content density** — screens show actual teacher data (lesson plans, call logs, students), not three placeholder cards with lorem-ish filler and huge whitespace.
- [ ] No perfectly-symmetric 3-equal-cards-in-a-row "feature grid" filler. Layout follows information, not a template.
- [ ] No decorative stock illustrations that add nothing; icons are functional (Lucide), consistent stroke width.
- [ ] Buttons have real labels ("Start parent call", "Generate lesson plan"), not "Get Started" / "Learn More" filler.
- [ ] Consistent iconography: one icon family, one stroke weight (~1.5–2dp), one corner style. No mixing filled Material icons with outline Lucide.

**Indic test strings (paste into every text-heavy screen during QA):**
- Bengali: `শিক্ষকদের জন্য কৃত্রিম বুদ্ধিমত্তা সহায়ক`
- Tamil: `ஆசிரியர்களுக்கான செயற்கை நுண்ணறிவு உதவியாளர்`
- Devanagari (Marathi): `शिक्षकांसाठी कृत्रिम बुद्धिमत्ता सहाय्यक`
- Malayalam: `അധ്യാപകർക്കുള്ള നിർമ്മിത ബുദ്ധി സഹായി`

## 12. PRE-MERGE SCREEN QA — 15-point checklist (mandatory; any FAIL blocks merge)

Run against every new/changed screen, in this order. Screenshot evidence for the visual ones.

1. **Grid** — every spacing value is a 4dp-grid member (§1). No off-grid magic numbers.
2. **Touch** — every tappable ≥48dp; primary CTA ≥56dp in the thumb zone (§2).
3. **Type** — all text uses named styles; Outfit headings / Inter body; weight-first hierarchy (§3).
4. **Indic** — Bengali + Tamil + Malayalam test strings render with height ≥1.6, zero clipped matras/diacritics (§3, §11).
5. **Color** — 60-30-10; saffron is accent only; no stray gradients or Material default colors (§4).
6. **Contrast** — body ≥4.5:1, large text ≥3:1, verified in light AND dark (§4).
7. **Cards** — single card grammar (radius 12, shadowSoft, 1dp border, space4 padding) consistent across the screen (§5).
8. **States** — loading skeleton, empty, error+retry, offline all implemented and reachable (§6).
9. **360dp** — no horizontal overflow / no RenderFlex error at 360dp width (§7).
10. **Scale** — no overflow at `textScaleFactor` 1.3 (§3, §7).
11. **Wrap** — long Indic compound words wrap, never sideways-scroll body text (§8).
12. **Safe area** — SafeArea honored; status-bar style correct; content clears keyboard + gesture nav (§9).
13. **Dark mode** — screen fully themed via §0 dark tables; no hardcoded light colors leaking; verified by eye.
14. **Motion** — transitions use motionMicro/Small/Medium + easeOutQuart only; nothing janky, nothing >400ms (§0).
15. **No slop / no emoji / not Hindi-only** — no centered-hero filler; zero emojis; Lucide icons; all copy in i18n across 11 languages; teacher-dignity respected (§10, §11).

## 13. Icon system recommendation

- **Use `lucide_icons` (the Lucide Flutter package)** as the primary icon set — it is the direct Flutter equivalent of the web app's Lucide icons, so parity with the Next.js app is exact (same names, same 1.5–2dp stroke, same rounded terminals). This preserves visual continuity with the marketing site and web app.
- Set a single default stroke width and size token (e.g. icon size `20` inline / `24` standalone / `48` in `tool-icon-wrap`) in `app_theme`. One family, one weight, everywhere.
- **Do not** mix `Icons.*` (Material filled) with Lucide — pick Lucide and stay. If a specific glyph is missing in the Flutter Lucide port, add the SVG asset in the Lucide style rather than dropping in a filled Material icon.
- **Absolutely no emoji as icons** — this is a hard project rule and a common AI-slop tell.

## 14. Enforcement

- Centralize all tokens in `lib/theme/` (`app_colors.dart`, `app_radius.dart`, `app_spacing.dart`, `app_shadows.dart`, `app_motion.dart`, `app_text.dart`, `app_theme.dart`). Build one `AppCard`, one `PrimaryButton`, one `AppScaffold`, one `StateView` (loading/empty/error/offline).
- Add `custom_lint`/`dart_code_metrics` rules (or a CI grep) to flag: `Color(0x` outside `lib/theme/`, `fontSize:` literals outside `app_text.dart`, `BorderRadius.circular(` with non-{6,12,20} args, `EdgeInsets` off-grid values, any emoji codepoint, `Curves.` other than the sanctioned curve, `GoogleFonts` runtime network calls.
- Golden tests at 360dp and 800dp, light + dark, with the §11 Indic strings, for every reusable widget.
