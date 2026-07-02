# 10 — Designing for 11 Scripts at Once (i18n Design)

**Lens:** Localization / typographic system across Hindi, Bengali, Marathi, Telugu, Tamil, Gujarati, Kannada, Odia, Punjabi, Malayalam + English. Every rule below must survive **all 11 scripts**, never just Latin/Devanagari.

## 1. Current-state assessment

The plumbing is solid; the **typographic finish is Devanagari-first and opt-in**, which is where beauty leaks out.

- **`t()` is a flat 1495-key dictionary** (`language-context.tsx`) returning the English key as fallback. Good coverage (only 16 missing keys, but those *break the pre-commit i18n gate* — fix first), 333 orphans. When a key is missing, a Malayalam teacher silently sees English mid-sentence — a mixed-script row nobody designed.
- **Fragmented translation surfaces.** Beyond the central dictionary, components ship their own ad-hoc maps (`quiz-display.tsx` `QUIZ_CHROME_I18N`, `result-shell-i18n.ts`) keyed by ISO code, while others key by `Language`. Two lookup idioms, two coverage gaps, no single audit.
- **`.indic-text` is used in only 5 files.** It carries the *entire* script-readability contract (line-height 1.7, `overflow-wrap: anywhere`) yet almost nothing opts in. So most AI output and card bodies render Tamil/Malayalam/Bengali at Latin line-height — ascender/descender and matra collisions, exactly what the class exists to prevent.
- **One blanket line-height for all scripts.** `.indic-text` hard-codes 1.7 everywhere. Tamil and Malayalam (tall glyphs, stacked vowel signs) genuinely need it; Gujarati and Gurmukhi look *loose and cheap* at 1.7. There is no per-script tuning — the opposite of "all 11 look beautiful."
- **Font stack is correct but coarse.** Tailwind lists Inter → all Noto Sans families; `ensureIndicFontLoaded` lazy-injects the right Noto per language (~30 KB, English pays nothing). But every script shares one `font-size`, so Devanagari x-height and Kannada counters render at the size tuned for Inter.
- **Layout assumes English width.** `dashboard-home.tsx` hero is `text-4xl md:text-7xl`; QuickAction titles are single-line `leading-tight`. Telugu/Malayalam expansions and tall glyphs will clip or ride the icon. The `Works in हिंदी, ಕನ್ನಡ, தமிழ்…` strings are hard-coded, not `t()`.

## 2. Typographic system — per script (not per "Indic")

Introduce a **per-script token set** keyed off `<html lang>` (already synced via `BCP47_MAP`). Add `[lang]` attribute selectors in `globals.css` so tuning is automatic, not opt-in:

| Script (langs) | Font (Noto Sans) | line-height body | Size nudge vs Inter | Note |
|---|---|---|---|---|
| Latin (en) | Inter / Outfit | 1.5 | 1.00× | baseline |
| Devanagari (hi, mr) | Devanagari | 1.6 | 1.00× | ascenders/shirorekha |
| Bengali (bn) | Bengali | 1.7 | 1.00× | matras need most vertical room |
| Gurmukhi (pa) | Gurmukhi | 1.55 | 1.00× | 1.7 reads loose — tighten |
| Gujarati (gu) | Gujarati | 1.55 | 1.00× | no shirorekha, compact |
| Tamil (ta) | Tamil | 1.75 | +3% | tall, wide glyphs |
| Telugu (te) | Telugu | 1.7 | +2% | stacked below-base marks |
| Kannada (kn) | Kannada | 1.7 | +2% | large counters |
| Malayalam (ml) | Malayalam | 1.8 | +3% | tallest, most complex conjuncts |
| Odia (or) | Oriya | 1.7 | +2% | curved, dense |

Implementation: `:root { --lh-body: 1.5 }` then `html[lang="ml-IN"] { --lh-body: 1.8; font-size: 103% }` etc., with `.indic-text` and `body p` consuming `var(--lh-body)`. **This makes correct rendering the default** — no component has to remember `.indic-text`. Retire the blanket 1.7. Keep Inter *first* in the stack so Hinglish/Latin numerals in a Kannada string stay on Inter.

## 3. Layout rules that survive expansion

Assume **any label can be 1.4× longer and ~20% taller** than English.

- **Buttons/chips:** never fixed-height single-line for text. Use `min-h`, vertical padding, `leading-snug`; allow 2-line wrap on chips rather than truncation. Icon + label must be `items-center` with `gap`, never absolute-positioned.
- **Cards (QuickActionCard, SuggestionCard):** titles `line-clamp-2` not `truncate`; reserve 2 lines of height so a 1-line English card and a 2-line Malayalam card align in the grid. Bodies already `line-clamp-2` — good.
- **Nav / sidebar labels:** allow wrap or a per-item `title` tooltip; never let Telugu clip under an icon.
- **Hero type:** cap the top end — `text-4xl md:text-6xl` (not `7xl`) for Indic, since tall scripts at 7xl overflow 360 px Android. Keep `overflow-wrap: anywhere` on all output containers (the `.demo-safe-wrap` pattern) app-wide, not demo-only.
- **Numerals & dates:** keep Western Arabic digits (teachers expect them); never split a number across a wrap.

## 4. Language-switching UX + feeling native

- `LanguagePill` is the right pattern — persistent, one-tap, shows the **endonym** (हिन्दी, ಕನ್ನಡ, தமிழ்) not the English name. Keep it; render each option in *its own* script (already does). Add the English exonym as the sub-label for discoverability (already present) and a search box once the list feels long.
- **Feel native, not translated-English:** the pill copy `SahayakAI works in 11 Indian languages` must itself be translated (it is, via `t()`). Audit tone per language — greetings (`Namaste`), honorifics, and teacher-register verbs should be locale-authentic, not literal. Spawn native-speaker review for the 200 highest-traffic keys.
- **Persist + no double-cost:** switching already writes profile + localStorage and re-injects the font; the dashboard voice-submit is ref-guarded against re-fire on language change — keep that invariant.

## 5. AI output that mixes scripts

AI results routinely interleave scripts (Kannada prose + English term + Western digits + a Sanskrit compound). Rules:

- Wrap **every** AI-output surface in `.indic-text` (or the new `[lang]`-driven default) so mixed rows get Indic line-height, not Inter's.
- Let the browser pick per-glyph fonts (the ordered stack already does this) — do **not** force one family on a mixed block.
- Set `lang` on the output container to the **AI-output** language (distinct from UI language; `quiz-display` already separates `selectedLanguage` vs `uiLangCode` — generalize that split everywhere).
- `overflow-wrap: anywhere` on output blocks so long conjunct compounds never horizontal-scroll.

## 6. Quick-wins vs big-bets

**Quick wins (days)**
1. Fix the 16 missing keys — unblocks the i18n gate. Prune 333 orphans.
2. Apply `.indic-text` to all AI-output + card-body surfaces (5 → all).
3. Split `.indic-text` line-height into per-`[lang]` CSS vars; tighten Gujarati/Gurmukhi, loosen Malayalam/Tamil.
4. `t()`-wrap the hard-coded `Works in हिंदी…` and `try:` strings in `dashboard-home.tsx`.
5. Cap Indic hero at `md:text-6xl`; `line-clamp-2` (not `truncate`) on all card/nav labels.

**Big bets (weeks)**
1. Unify the three translation surfaces (central dict + `QUIZ_CHROME_I18N` + `result-shell-i18n`) behind one `Language`-keyed API and one audit.
2. Native-speaker QA pass on the top-200 keys per language for register/honorifics — the difference between "translated" and "native."
3. Per-script visual regression snapshots (all 11) in CI so a Latin-width layout change can't silently break Malayalam.
