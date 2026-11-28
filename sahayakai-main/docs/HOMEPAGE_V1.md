# Homepage v1 and /features

The signed-out homepage (`/`) and `/features` implement the founder-approved
design "Homepage v1" and "All features" (Claude Design, approved 2026-11-27).

## Where things are

| What | Where |
|---|---|
| Homepage | `src/components/landing/home/` (`home-page.tsx` sections with state, `home-sections.tsx` static sections, `home-chrome.tsx` header and footer, `home-motion.tsx` pause and off-screen control, `home.css`) |
| /features | `src/components/landing/features/` (`features-page.tsx` switch state, `features-core.tsx` and `features-tools-{a,b}.tsx` cards, `features.css` generated styles, `features-extra.css` hand-written additions) |
| Entry | `src/app/page.tsx` (metadata) renders `src/app/home-gate.tsx` (signed-out → homepage, signed-in → dashboard) |
| Design source | `docs/design/homepage-v1/Main.dc.html`, `Features.dc.html` |
| Converters | `scripts/design/homepage-v1/` (`dc2jsx.py`, `css2scoped.py`, `build_features.py`) |

## How the files were produced

The design's markup was converted to JSX by `dc2jsx.py` (class → className,
style strings → objects, every visible string wrapped in `t()`, colours turned
into `var(--hp-*)`), and its CSS scoped under `.hpv1` / `.hpf` by
`css2scoped.py` (keyframes prefixed `hp-` / `hpf-`). The interactive parts (Try
VIDYA, the film player, the calculator, the switches) were written by hand.

After generation, these hand edits were made and must be kept if the files are
regenerated: colour variables renamed by role or family (no hex names), SVG
colours moved from attributes into `style`, the pincode quote turned into one
translatable sentence (`QuoteLine`), "AI Mentor" naming, inactive scenes hidden
from assistive technology (`features-extra.css`), and prettier formatting.
Treat the components as normal source: edit them directly; regenerate only for
a new design version.

## Rules these pages follow (each has a class gate)

- Every number comes from `src/lib/school-pricing.ts` —
  `src/__tests__/landing/time-saved-claims-consistent.test.ts`.
- The film plays in the page — `src/__tests__/landing/film-plays-inline.test.ts`.
- Every class and colour variable used is defined —
  `src/__tests__/landing/landing-css-classes-defined.test.ts`.
- Header and footer links never point at sections that do not exist —
  `src/__tests__/components/landing-chrome-anchors.test.ts`.
- Every marketing page is public and renders without the app chrome —
  `src/__tests__/landing/marketing-routes-public.test.ts`.
- Every string is translated in all 10 locales — Gate 9.
