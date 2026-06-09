# SahayakAI Design Tokens

**Source of truth.** All colors, radii, shadows, spacing, motion, and typography in SahayakAI come from this file. If you can't find a token here for what you need, propose it in PR — don't reach for arbitrary values.

Defined in:
- `src/app/globals.css` (CSS variables + utility classes)
- `tailwind.config.ts` (Tailwind utility names)

This is **Phase 1** of the layout overhaul. See [`DESIGN_EXECUTION_PLAN.md`](./DESIGN_EXECUTION_PLAN.md) for the full migration plan.

---

## 1. Color

All colors use HSL CSS variables defined in `:root` of `globals.css`.

### Brand
| Token | Value | Tailwind | When to use |
|---|---|---|---|
| `--primary` | Saffron `#FF9933` | `bg-primary`, `text-primary` | Primary CTA, active state, brand mark, focus ring |
| `--secondary` | Deep Green `#2C5F2D` | `bg-secondary` | Confirmations, "saved" states. **Never** combine with primary in the same element |
| `--accent` | Navy `#000080` | `bg-accent` | Rare — high-attention info badges only |

### Saffron scale (landing only)
`saffron-{50,100,200,300,500,600,700,800}` — used by hero CTA gradients and pillar strip. Don't introduce inside the authenticated app.

### Surfaces
| Token | Tailwind | Use |
|---|---|---|
| `--background` | `bg-background` | Page bg |
| `--card` | `bg-card` | Card / surface bg |
| `--muted` | `bg-muted`, `bg-muted/30` | Section grouping, helper blocks |
| `--border` | `border-border` | All dividers, card borders |
| `--foreground` | `text-foreground` | Primary text |
| `--muted-foreground` | `text-muted-foreground` | Secondary text, captions |

### Status
| Token | Tailwind | Use |
|---|---|---|
| `--destructive` | `bg-destructive`, `text-destructive` | Destructive actions, errors |

**Anti-pattern:** custom hex/rgb values in components. If you need a color that isn't here, add a token first.

---

## 2. Radius

Existing (back-compat — used by ShadCN primitives):

| Tailwind | Value | Use |
|---|---|---|
| `rounded-sm` | 8px | Small inputs, badges (legacy) |
| `rounded-md` | 10px | Buttons, inputs (legacy) |
| `rounded-lg` | 12px | Cards (legacy default) |

**New (Phase 1) — preferred for new code:**

| Tailwind | Value | Use |
|---|---|---|
| `rounded-surface-sm` | 6px | Chips, pills, inline tags |
| `rounded-surface-md` | 12px | **Default** for cards, buttons, inputs |
| `rounded-surface-lg` | 20px | Hero cards, landing surfaces only |
| `rounded-pill` | 9999px | Voice orbs, badges, full pills |

**Anti-pattern:** `rounded-[14px]`, `rounded-2xl`, `rounded-3xl`. Banned in new code; ESLint will flag.

Existing `rounded-xl`/`rounded-2xl`/`rounded-3xl` usage will be migrated phase-by-phase.

---

## 3. Shadow

| Tailwind | CSS Var | Use |
|---|---|---|
| `shadow-soft` | `--shadow-soft` (1px) | **Default** for cards, inputs at rest |
| `shadow-elevated` | `--shadow-elevated` (4px) | Hover, active, important section card |
| `shadow-floating` | `--shadow-floating` (16px) | Modals, sheets, dropdowns, popovers |
| `shadow-glow` | (existing) | Focus state on saffron CTA |
| `shadow-inner-soft` | (existing) | Inset wells, code blocks |

**Anti-pattern:** `shadow-[0_X_Y_rgba(...)]`, `shadow-lg`, `shadow-xl`, `shadow-2xl`. Banned in new code.

---

## 4. Spacing

Tailwind's default 4px grid is the canonical spacing scale. Use `gap-*`, `p-*`, `space-y-*`, etc.

**Allowed values:** `0, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16, 20, 24, 32`.

**Banned in new code:** `p-5` (between p-4 and p-6 — use one or the other), `gap-2.5`, `space-y-1.5`. Use the integer steps.

### Standard spacing recipes

| Context | Class | Pixels |
|---|---|---|
| Default card padding | `p-4 md:p-6` | 16/24px |
| Internal card gap | `space-y-3` | 12px |
| Form field rows | `space-y-4` | 16px |
| Section gap | `space-y-8` | 32px |
| Page section break | `space-y-12` | 48px |

---

## 5. Container widths

**Three widths only.** Defined as utility classes in `globals.css`:

| Class | Max width | Use |
|---|---|---|
| `container-narrow` | `max-w-2xl` (672px) | Forms, settings, single-column reading |
| `container-default` | `max-w-5xl` (1024px) | Most tool pages, dashboards |
| `container-wide` | `max-w-7xl` (1280px) | Multi-column dashboards, library grids |

**Anti-pattern:** Any other `max-w-[*]` value in pages. Banned via ESLint after Phase 2 lands `<PageShell>`.

Page should look like:
```tsx
<PageShell width="default" title="...">
  <SectionCard>...</SectionCard>
</PageShell>
```

Never:
```tsx
<div className="max-w-[880px] mx-auto px-6">  {/* DON'T */}
```

---

## 6. Typography

Hierarchy via **weight first**, size second. This works equally well for Indic and Latin scripts (size-only hierarchy fails on Devanagari/Tamil due to consonant-conjunct height variance).

Utility classes (preferred over raw size + weight):

| Class | Equivalent | Use |
|---|---|---|
| `type-h1` | `font-headline font-bold text-3xl leading-[1.15]` | Page title |
| `type-h2` | `font-headline font-semibold text-2xl leading-[1.2]` | Section title |
| `type-h3` | `font-headline font-semibold text-lg leading-[1.3]` | Sub-section |
| `type-body-lg` | `text-base leading-[1.6] font-medium` | Lead paragraphs |
| `type-body` | `text-sm leading-[1.6] font-normal` | **Default** body text |
| `type-caption` | `text-xs leading-[1.4] font-medium uppercase tracking-wide` | Labels, eyebrows, metadata |

### Indic script rules
- **Min line-height: 1.4** for any text rendered in Devanagari/Tamil/Bengali/etc.
- **Min font size: 12px** (`text-xs`) for any teacher-facing text.
- **Banned: `leading-none`, `leading-tight`** on body text — they clip diacritics.
- Headings may use `leading-tight` only when the heading is single-line and weight ≥ semibold.

**Anti-pattern:** `text-[9px]`, `text-[10px]`, `text-[11px]` on rural-facing surfaces. Banned in new code.

---

## 7. Motion

| Token | Value | Use |
|---|---|---|
| `--ease-out-quart` | `cubic-bezier(0.16, 1, 0.3, 1)` | **Single** canonical easing curve |
| `--motion-micro` | 150ms | Hover, focus, color transitions |
| `--motion-small` | 250ms | Accordion, reveal, dropdown |
| `--motion-medium` | 350ms | Page transition, modal, sheet |

Tailwind:
- `transition-duration: ` use `duration-micro`, `duration-small`, `duration-medium`
- `transition-timing-function: ` use `ease-out-quart`

```tsx
<button className="transition-colors duration-micro ease-out-quart">
```

**Anti-pattern:**
- Inline `transition-duration: 200ms` style — use the token.
- `setTimeout` + class toggle for animations — use Framer Motion.
- Multiple distinct easing curves across the codebase.

Framer Motion: always use `--ease-out-quart` via the equivalent array `[0.16, 1, 0.3, 1]`.

---

## 8. Component contracts

### Card (default container)
- Radius: `rounded-surface-md`
- Shadow: `shadow-soft`
- Padding: `p-4 md:p-6`
- Internal gap: `space-y-3`
- Border: `border border-border`

### Button (primary)
- Radius: `rounded-surface-md`
- Padding: `px-4 py-2`
- Color: `bg-primary text-primary-foreground`
- Hover: `hover:bg-primary/90 transition-colors duration-micro ease-out-quart`

### Input
- Radius: `rounded-surface-md`
- Border: `border border-input`
- Padding: `px-3 py-2`
- Focus: `focus-visible:ring-2 focus-visible:ring-ring`

### Modal / Sheet / Popover
- Shadow: `shadow-floating`
- Radius: `rounded-surface-lg` for modals, `rounded-surface-md` for popovers
- Backdrop: `bg-foreground/40 backdrop-blur-sm`

---

## 9. What's banned (ESLint enforces)

| Pattern | Why | Use instead |
|---|---|---|
| `rounded-\[\d+px\]` | Arbitrary radius bypasses scale | `rounded-surface-{sm,md,lg}` or `rounded-pill` |
| `text-\[\d+px\]` | Arbitrary font size bypasses scale | `type-{h1..h3,body,body-lg,caption}` |
| `shadow-\[.*\]` | Arbitrary shadow bypasses grammar | `shadow-{soft,elevated,floating}` |
| `max-w-\[.*\]` (in pages) | Page width must come from `<PageShell>` | `<PageShell width="...">` |
| `rounded-2xl`, `rounded-3xl` | Replaced by `rounded-surface-lg` | `rounded-surface-lg` |
| `shadow-lg`, `shadow-xl`, `shadow-2xl` | Replaced by elevation grammar | `shadow-elevated` or `shadow-floating` |
| `gap-2.5`, `space-y-1.5`, `p-5` | Off-grid spacing | Use 4px grid: `gap-2`, `gap-3`, `space-y-2`, etc. |
| `leading-none` on body text | Clips Indic diacritics | `leading-[1.6]` or `type-body` |

Landing pages (`src/app/page.tsx`, `src/components/landing/**`, `src/app/(marketing)/**`) are exempt from these rules — they use the saffron landing system (`rounded-[14px]` etc. is intentional there).

---

## 10. Adding a new token

1. Open PR adding the CSS var to `globals.css` and the Tailwind mapping in `tailwind.config.ts`.
2. Update this doc — every token must be listed with a one-line "when to use".
3. Justify in the PR description: why no existing token works.
4. Tag in PR for design review.

Tokens are cheaper than divergence. But every new token is a long-term commitment to maintain — be deliberate.
