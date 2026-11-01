# Platforms and code

This system is the source. The Next.js web app, the Flutter app and the website consume its token names; none of them defines its own colours, radii or type.

## One source, three outputs

`tokens.json` → `tokens.css` (web, this system) → Tailwind theme and `globals.css` variables (Next.js) → `AppColors`, `AppRadius`, `AppShadows`, `AppText` (Flutter). The names stay the same across all three: `saffron-500` is `--saffron-500`, `saffron500` in Dart and `bg-saffron-500` in Tailwind.

## Migration from what ships today

| Area | Next.js today | Flutter today | This system |
| --- | --- | --- | --- |
| Display / UI fonts | Outfit / Inter | Outfit / Inter (bundled) | Bricolage Grotesque / Instrument Sans, falling back to Noto Sans per script |
| Brand saffron (fill) | `--primary` `24 65% 47%` (renders #C6682A) | `lPrimary` #E0924D (retired value, 2.50:1) | `saffron-500` #C96A28 (`hsl(24.6 66.8% 47.3%)`) for the orb, dots and bars; `accent-fill` (`saffron-600` #A5551D) under white labels |
| Saffron as text | `--saffron-700` (#AC4815) | `lPrimaryText` #AC4815 | `saffron-600` #A5551D (eyebrows, links, actions), `saffron-700` #8A4A08 on tints |
| Neutrals | Cool slate (`--foreground` #0F1729, `--muted` slate) | `lForeground` #0F1729, `lMuted` slate | Warm ink `ink-900` #171310 … `ink-400`; milk grounds `milk-50` … `milk-500` |
| Green | `--secondary` deep green | `lSecondary` #28572B | `leaf-500` #2C5F2D, `leaf-700` for text |
| Third accent | `--accent` navy #000080 | `lTertiary` navy | `indigo-500` #2A3B8F, curriculum and working only |
| Error | `--destructive` #EF4343 | `lError` #EF4343 | `red-500` #C0392B (white 5.44:1), `red-700` for text |
| Cards | White cards, slate borders | `lCard` white, `lBorder` | Glass on the wash: `surface-glass` + `border-glass`; solid `surface-card` in sheets |
| Radius | `--radius` 12px; buttons 10px | Card 16 | Pills for everything pressable; containers step 12 → 38 |
| Mobile navigation | Bottom bar | `FloatingBottomNav`: a labelled glass bar with a Create action slot | `TabBar`: a four-icon capsule (home, library, community, profile); creation via the orb |
| Assistant | Floating VIDYA button; on the context-aware VIDYA branch (PR #158), one Live voice session with `VidyaPresence` (hero, workspace, compact) | Draggable orb (v3 work, Sept 2026); Gemini Live client behind a flag | `Orb` and `OrbHint` for the resting orb; `LiveOrb`, `LiveStatus` and the `ScreenLive*` screens for VIDYA Live; `VidyaPresence` on the web. One state model everywhere (see "VIDYA Live") |
| Library | One list | Library tab | Generations and Conversations (`LibraryRow`, `ConversationRow`, `LibraryCard`) |
| Shadows | Slate-tinted | `lShadowBase` #0F1729 | Warm ink-tinted; saffron-tinted on the CTA and orb |
| Smallest text | 10–11px metadata | 10–11px metadata | 12px floor in every script, following the system text size (decided 26 Oct 2026) |
| Theme | Light and dark | Light and dark | Light only; retire both dark modes (decided 26 Oct 2026) |

## Next.js

- Map semantic tokens onto the existing shadcn variable names during migration, so components keep working:
  - `--background` → `milk-200` on web pages, the wash on app shells
  - `--foreground` → `ink-900`
  - `--primary` → `accent-fill` (`saffron-600`): it fills buttons with white labels
  - `--secondary` → `leaf-500`
  - `--accent` → `indigo-500`
  - `--destructive` → `red-500`
  - `--muted-foreground` → `ink-600`
  - `--ring` → `saffron-600`
- Then replace the shadcn names page by page. Fonts move through `next/font` with Bricolage Grotesque (variable `opsz`, `wght`) and Instrument Sans.
- Under the repo's adopt-on-touch law, any PR touching a page with raw palette classes tokenizes that page.
- The context-aware VIDYA branch already registers both fonts and moves the shadcn palette onto milk and ink; "The web app and the school console" lists the four values still to align (foreground, primary, secondary and the navy accent) and the layout rules (rail, sidebar, top bar, Dialog).
- Replace the web's bottom bar (Home · Create · Library · Me) with the `TabBar` capsule under 768px.

## Flutter

- Replace `AppColors` values with these tokens. `brandSaffron` becomes #C96A28 and `lPrimary`, the button fill, becomes `accent-fill` #A5551D, and the slate neutrals become ink and milk.
- Bundle Bricolage Grotesque and Instrument Sans as variable fonts; keep the Noto Sans families as fallbacks.
- Replace `FloatingBottomNav` with the four-tab capsule: 42px discs, the 7px capsule padding, `surface-chrome`, `shadow-float`, no labels, with semantics labels.
- Honour the system text scale.
- Build VIDYA Live as one full-screen route over the current page, driven by the Gemini Live client's states mapped to the system's (interrupted → listening, thinking → working, error → failed). Captions stay on.

## Using the components directly

Load `tokens.css`, `components/bundle.css`, React 18 and `components/bundle.js`; every component is on `window.SahayakAI` (see `index.d.ts` for props). The `sk-` classes are the reference implementation of each component's spec, so port their values exactly.
