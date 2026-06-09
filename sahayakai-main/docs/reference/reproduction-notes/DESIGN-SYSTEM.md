# SahayakAI - Design System

_Last verified against source: 2026-06-10._

## Brand Philosophy

Indian teacher audience. Voice-first. Works on low-end Android devices. Both rural (low-tech-savvy) and urban users. No emojis - all visual communication via Lucide icons.

---

## Color Palette

Current code uses **semantic theme tokens**, not hardcoded Tailwind color steps. New/refactored components reference CSS-variable-backed utilities (`bg-primary`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-accent`, `bg-destructive`). These resolve through `globals.css` and support light + dark themes (`ThemeProvider` / `theme-toggle`). Avoid reintroducing raw `orange-500` / `slate-*` in new work - the saffron brand color is the value behind `--primary`.

### Primary - Saffron (Indian flag)
- Token: `--primary` (saffron). Use via `bg-primary`, `text-primary`, `ring-primary`, `border-primary/20`, `bg-primary/10`.
- Used for: active tabs, CTA buttons, orb, badges, highlights.
- TODO(verify: exact HSL value of `--primary` in `globals.css`).

### Surfaces & neutrals
- Surfaces: `bg-background`, `bg-card` (often `bg-card/50 backdrop-blur-sm` on inputs/triggers).
- Borders: `border-border`.
- Text: `text-foreground` (primary), `text-muted-foreground` (secondary).
- Muted fills: `bg-muted`, `bg-accent/10`.

### Semantic Colors
- Error/destructive: `bg-destructive` / `text-destructive` token; some legacy callouts still use `red-*`.
- A few component-local accents remain as raw Tailwind steps (e.g. DifficultySelector level icons `text-green-600`/`text-blue-600`/`text-purple-600`; the YouTube callout in InstantAnswerDisplay uses `red-*`). These are intentional per-icon accents, not the global palette.

---

## Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| Headlines | Outfit | 700–800 | text-2xl to text-4xl |
| Body | Inter | 400–500 | text-sm to text-base |
| Labels/badges | Inter | 600–700 | text-xs |
| Monospace | System | 400 | text-xs |

Key patterns (use theme tokens for color):
- Page titles: `text-2xl font-bold text-foreground` (Outfit via CSS var)
- Card titles: `text-sm font-bold text-foreground`
- Metadata/timestamps: `text-[10px] text-muted-foreground`
- Input placeholder: `placeholder:text-muted-foreground`

TODO(verify: exact font families - earlier doc listed Outfit/Inter; confirm against `globals.css` / layout font config).

---

## Spacing & Layout

- Page wrapper: `max-w-2xl mx-auto px-4` (single-column, all screen sizes)
- Card padding: `p-4` or `p-6`
- Section spacing: `space-y-4` or `space-y-6`
- Input height: `h-10` (standard), `h-12` (prominent)
- Button radius: `rounded-xl` (standard), `rounded-full` (icon buttons)
- Card radius: `rounded-2xl` (prominent cards), `rounded-xl` (standard)

---

## Component Library - Shadcn/ui

All UI primitives from Shadcn/ui built on Radix. Located at `src/components/ui/`.

**Used primitives:**
- `Button` - variants: default (`bg-primary`), outline, ghost, destructive
- `ResultShell` (`src/components/ui/result-shell.tsx`) - shared wrapper for every AI output display; renders title/icon/action-toolbar/footer (variants include `glass`; sizes include `compact`)
- `Card`, `CardHeader`, `CardContent`, `CardTitle`, `CardDescription`
- `Input`, `Textarea`
- `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`
- `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Badge` - variants: default, secondary, outline, destructive
- `Avatar`, `AvatarImage`, `AvatarFallback`
- `Accordion`, `AccordionItem`, `AccordionTrigger`, `AccordionContent`
- `Popover`, `PopoverTrigger`, `PopoverContent`
- `Sheet` (mobile drawer)
- `Skeleton` (loading states)
- `Progress`
- `Tooltip`
- `ScrollArea`
- `Separator`
- `Collapsible`
- `Sidebar` (custom Shadcn sidebar)
- `Form` (react-hook-form integration)
- `Toast`, `Toaster` - `useToast()` hook

**Do NOT build custom primitives** for things Shadcn covers. Extend via className.

---

## Icon System - Lucide React

**All icons from `lucide-react`. No emojis. No emoji-based communication.**

Key icons used:
- Navigation: `Home`, `BookOpen`, `Users`, `MessageCircle`, `Bell`, `Library`, `BarChart`
- AI features: `Wand2`, `GraduationCap`, `FileSignature`, `ClipboardCheck`, `Images`, `Globe2`
- Actions: `Send`, `Mic`, `MicOff`, `Square`, `X`, `Check`, `CheckCheck`
- States: `Loader2` (spinning for loading), `AlertCircle`, `Info`
- Content types: `BookOpen` (lesson-plan), `ClipboardCheck` (quiz), `FileSignature` (worksheet), `Images` (visual-aid), `Globe2` (field-trip), `GraduationCap` (training), `Wand2` (instant-answer)
- Community: `Flame` (trending), `Users`, `MessageCircle`, `UserPlus`, `Heart`, `Bookmark`

**FileTypeIcon component** (`src/components/file-type-icon.tsx`) - centralizes content-type → icon mapping.

---

## Responsive Design

Single-column layout on all screens. No desktop-only sidebars. Everything works at 375px width.

Key responsive patterns:
- `hidden sm:block` - hide on mobile
- `sm:hidden` - mobile-only (e.g., FAB)
- `flex-col sm:flex-row` - stack on mobile
- Mobile: full-width cards, larger tap targets
- Desktop: same layout, more breathing room via `max-w-2xl`

---

## Motion & Animation

- Loading spinner: `Loader2` with `animate-spin`
- Pulse dot (live indicator): `animate-pulse`
- Fade in: `fade-in-up` keyframe (defined in globals.css)
- Bounce: `animate-bounce-subtle` (5% vertical, 3s loop)
- Accordion: `accordion-down` / `accordion-up` (Tailwind animate plugin)
- Active scale: `active:scale-95` on buttons
- Transition: `transition-all duration-200` standard

---

## Form Patterns

Standard AI tool form structure:
1. Page title + description header
2. Language selector (top - affects all AI output)
3. Grade level selector
4. Subject selector
5. Topic/prompt input (with MicrophoneInput icon button)
6. Optional: Difficulty, NCERT chapter, image upload
7. Submit button: default (`bg-primary`) with `Loader2` when generating

Submit button text: "Generate [Feature Name]" → "Generating…" → back to "Generate" on complete

---

## PDF Export

Export-to-PDF is a primary feature. As of 2026-06-10 it is implemented by **rasterising a DOM element with `exportElementToPdf({ elementId, filename })`** (`src/lib/export-pdf.ts`, jsPDF + html2canvas), NOT the browser `window.print()` path. Each display component passes a `PDF_ID` to `ResultShell` and to `exportElementToPdf`. The IDs are not uniform - see `components/ai-outputs/display-components.md` for the per-component values (`instant-answer-card`, `lesson-plan-pdf`, `print-area` for quiz, `rubric-pdf`, `worksheet-pdf`, `visual-aid-card`, `field-trip-card`, `teacher-training-card`).

TODO(verify: whether any `@media print` rules still exist in `globals.css` for the quiz "Print" action).

---

## Card Patterns

### Standard content card
- `bg-card border border-border rounded-2xl shadow-sm`
- Header: muted background, border-bottom
- Content: card background, standard padding

### Elevated/featured card
- `shadow-md` or `ring-2 ring-primary/10`
- Used for: active states, selected items

### Ghost card
- `bg-muted border border-dashed border-border`
- Used for: empty states, placeholders

---

## Loading States

- Full-page: centered `Loader2` (h-8 w-8 animate-spin text-muted-foreground)
- Content section: `Skeleton` components matching content layout
- Button: replace button content with `Loader2 h-4 w-4 animate-spin`
- Inline: smaller `Loader2 h-4 w-4`

## Empty States

Standard empty state pattern:
- Centered icon in a rounded colored container (e.g., `bg-primary/10 rounded-full p-4`)
- Bold title: `text-sm font-bold text-foreground`
- Subtitle: `text-xs text-muted-foreground`
- Optional CTA button

---

## Audio Player Styling

Voice messages use native `<audio controls>` element with:
- `h-8 flex-1 min-w-0` sizing
- `style={{ colorScheme: 'normal' }}` to prevent dark mode inversion
- Wrapped in a flex container with Mic icon

Note: Browser-default audio player styling varies across Chrome/Safari/Android.
