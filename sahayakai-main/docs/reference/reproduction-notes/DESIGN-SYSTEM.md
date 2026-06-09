# SahayakAI — Design System

## Brand Philosophy

Indian teacher audience. Voice-first. Works on low-end Android devices. Both rural (low-tech-savvy) and urban users. No emojis — all visual communication via Lucide icons.

---

## Color Palette

### Primary — Saffron (Indian flag)
- Primary: HSL(28°, 70%, 59%) ≈ `#F97316` (orange-500 in Tailwind)
- Used for: active tabs, CTA buttons, orb, badges, highlights
- Tailwind usage: `bg-orange-500`, `text-orange-600`, `bg-orange-100`, `ring-orange-500`

### Secondary — Deep Green (Indian flag)
- Secondary: HSL(123°, 37%, 25%) ≈ `#2C5F2D`
- Rarely used directly; present in theme tokens

### Neutral — Slate scale
- Background: white / `bg-slate-50`
- Borders: `border-slate-200`, `border-slate-100`
- Text primary: `text-slate-900`, `text-slate-800`
- Text secondary: `text-slate-500`, `text-slate-400`
- Muted fills: `bg-slate-100`, `bg-slate-50`

### Semantic Colors
- Error/destructive: red-500, red-50, red-200
- Success: green-500, green-600
- Warning: amber-500, amber-100
- Info: blue-500, blue-50

---

## Typography

| Role | Font | Weight | Size |
|---|---|---|---|
| Headlines | Outfit | 700–800 | text-2xl to text-4xl |
| Body | Inter | 400–500 | text-sm to text-base |
| Labels/badges | Inter | 600–700 | text-xs |
| Monospace | System | 400 | text-xs |

Key patterns:
- Page titles: `text-2xl font-bold text-slate-900` (Outfit via CSS var)
- Card titles: `text-sm font-bold text-slate-800`
- Metadata/timestamps: `text-[10px] text-slate-400`
- Input placeholder: `placeholder:text-slate-400`

---

## Spacing & Layout

- Page wrapper: `max-w-2xl mx-auto px-4` (single-column, all screen sizes)
- Card padding: `p-4` or `p-6`
- Section spacing: `space-y-4` or `space-y-6`
- Input height: `h-10` (standard), `h-12` (prominent)
- Button radius: `rounded-xl` (standard), `rounded-full` (icon buttons)
- Card radius: `rounded-2xl` (prominent cards), `rounded-xl` (standard)

---

## Component Library — Shadcn/ui

All UI primitives from Shadcn/ui built on Radix. Located at `src/components/ui/`.

**Used primitives:**
- `Button` — variants: default (orange-500), outline, ghost, destructive
- `Card`, `CardHeader`, `CardContent`, `CardTitle`, `CardDescription`
- `Input`, `Textarea`
- `Select`, `SelectTrigger`, `SelectContent`, `SelectItem`
- `Dialog`, `DialogTrigger`, `DialogContent`, `DialogHeader`
- `Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`
- `Badge` — variants: default, secondary, outline, destructive
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
- `Toast`, `Toaster` — `useToast()` hook

**Do NOT build custom primitives** for things Shadcn covers. Extend via className.

---

## Icon System — Lucide React

**All icons from `lucide-react`. No emojis. No emoji-based communication.**

Key icons used:
- Navigation: `Home`, `BookOpen`, `Users`, `MessageCircle`, `Bell`, `Library`, `BarChart`
- AI features: `Wand2`, `GraduationCap`, `FileSignature`, `ClipboardCheck`, `Images`, `Globe2`
- Actions: `Send`, `Mic`, `MicOff`, `Square`, `X`, `Check`, `CheckCheck`
- States: `Loader2` (spinning for loading), `AlertCircle`, `Info`
- Content types: `BookOpen` (lesson-plan), `ClipboardCheck` (quiz), `FileSignature` (worksheet), `Images` (visual-aid), `Globe2` (field-trip), `GraduationCap` (training), `Wand2` (instant-answer)
- Community: `Flame` (trending), `Users`, `MessageCircle`, `UserPlus`, `Heart`, `Bookmark`

**FileTypeIcon component** (`src/components/file-type-icon.tsx`) — centralizes content-type → icon mapping.

---

## Responsive Design

Single-column layout on all screens. No desktop-only sidebars. Everything works at 375px width.

Key responsive patterns:
- `hidden sm:block` — hide on mobile
- `sm:hidden` — mobile-only (e.g., FAB)
- `flex-col sm:flex-row` — stack on mobile
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
2. Language selector (top — affects all AI output)
3. Grade level selector
4. Subject selector
5. Topic/prompt input (with MicrophoneInput icon button)
6. Optional: Difficulty, NCERT chapter, image upload
7. Submit button: `bg-orange-500 hover:bg-orange-600` with `Loader2` when generating

Submit button text: "Generate [Feature Name]" → "Generating…" → back to "Generate" on complete

---

## Print Styles (globals.css)

Print-to-PDF is a primary feature. CSS rules:
- Hide everything globally on `@media print`
- Show only elements with specific IDs: `#lesson-plan-pdf`, `#quiz-sheet`, `#worksheet-pdf`, etc.
- `print-color-adjust: exact` — preserves background colors
- Accordion content forced visible: `[data-state] { display: block !important }`

Each display component wraps its printable content in a div with the correct print ID.

---

## Card Patterns

### Standard content card
- `bg-white border border-slate-200 rounded-2xl shadow-sm`
- Header: slate-50 background, border-bottom
- Content: white background, standard padding

### Elevated/featured card
- `shadow-md` or `ring-2 ring-primary/10`
- Used for: active states, selected items

### Ghost card
- `bg-slate-50 border border-dashed border-slate-200`
- Used for: empty states, placeholders

---

## Loading States

- Full-page: centered `Loader2` (h-8 w-8 animate-spin text-slate-300)
- Content section: `Skeleton` components matching content layout
- Button: replace button content with `Loader2 h-4 w-4 animate-spin`
- Inline: smaller `Loader2 h-4 w-4`

## Empty States

Standard empty state pattern:
- Centered icon in a rounded colored container (e.g., `bg-orange-50 rounded-full p-4`)
- Bold title: `text-sm font-bold text-slate-700`
- Subtitle: `text-xs text-slate-400`
- Optional CTA button

---

## Audio Player Styling

Voice messages use native `<audio controls>` element with:
- `h-8 flex-1 min-w-0` sizing
- `style={{ colorScheme: 'normal' }}` to prevent dark mode inversion
- Wrapped in a flex container with Mic icon

Note: Browser-default audio player styling varies across Chrome/Safari/Android.
