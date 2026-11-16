# SahayakAI Component Inventory

Baseline: **`develop` @ `92837486`**, clean checkout, 2026-11-03. Paths are relative to `sahayakai-main/`.

"Importers" is the number of non-test files under `src/` that import the module, counted with `grep -rlE "from '@/components/<path>'"`. "Where used" lists the main importers (not always all of them).

The **Reuse?** column is a recommendation for the coming page redesigns:
- ✅ **Reuse**: the authoritative building block; extend it rather than copy it.
- 🟡 **Reuse with care**: works, but has a known quirk (noted).
- 🔁 **Consolidate**: one of several overlapping implementations. Pick the named winner.
- ⛔ **Do not build on**: orphaned, dead or superseded.

---

## 1. Primitives: `src/components/ui/` (shadcn, `components.json` style "default", base colour "neutral", Lucide icons)

| Component | Path | Purpose | Variants (exact) | Tokens | Importers / where used | Reuse? |
|---|---|---|---|---|---|---|
| Button | `src/components/ui/button.tsx` | All buttons | variant `default` · `destructive` · `outline` · `secondary` · `ghost` · `link`; size `default` h-11 · `sm` h-10 · `lg` h-12 · `icon` 44×44; `asChild` | primary, secondary, destructive, accent (hover), input, ring, `rounded-md` 10px | **138**: every tool page, dialogs, Sampark | 🟡 outline/ghost hover is **indigo** (`bg-accent` = #2A3B8F). Pass a hover override, or fix the token in a dedicated PR |
| Card (+Header/Title/Description/Content/Footer) | `src/components/ui/card.tsx` | Generic container | none | card, border, `shadow-soft`, `rounded-[var(--radius)]` 12px; title `font-headline text-xl` | **55**: library, community, dashboard suggestion cards, ResultShell | ✅ (or `SectionCard` for in-page sections) |
| Badge | `src/components/ui/badge.tsx` | Small label | `default` (saffron) · `secondary` (**leaf**) · `destructive` · `outline` | primary, secondary, `rounded-full`, `text-xs font-semibold` | **29**: ResultShell meta, library, community | 🔁 for status use Sampark `StatusPill` (tinted plus dot); keep Badge for counts and meta |
| Input | `src/components/ui/input.tsx` | Text input | none | `h-10 rounded-md border-input bg-background`, ring-2 + offset | **40** | ✅ |
| Textarea | `src/components/ui/textarea.tsx` | Multiline input | none | `bg-transparent shadow-sm`, **ring-1, no offset** | **24**: topic boxes on tool pages | 🟡 focus differs from Input |
| Label | `src/components/ui/label.tsx` | Field label | none | `text-sm font-medium leading-none` | **35** | ✅ |
| Form (react-hook-form) | `src/components/ui/form.tsx` | Field wiring and messages | n/a | destructive for messages | **13** | ✅ |
| Select | `src/components/ui/select.tsx` | Dropdown select | Content `position="popper"` (default) or item-aligned | `h-10 rounded-md`, popover, `shadow-md`, item `focus:bg-accent` (indigo) | **24**: class/subject/language pickers | 🟡 indigo item highlight |
| Checkbox | `src/components/ui/checkbox.tsx` | Checkbox | none | `h-4 w-4 rounded-sm border-primary` | 9 | ✅ |
| RadioGroup | `src/components/ui/radio-group.tsx` | Radio | none | primary | 2 | ✅ |
| Switch | `src/components/ui/switch.tsx` | Toggle | none | `h-6 w-11` primary/input | 1 (`app/settings/page.tsx`) | ✅ |
| Slider | `src/components/ui/slider.tsx` | Range | none | primary, secondary track | 2 | ✅ |
| Tabs | `src/components/ui/tabs.tsx` | Segmented tabs | none | list `bg-muted/50 h-10 p-1`; **active = filled saffron**; inactive bordered | 5: attendance class, community-library, exam-paper form, my-library, quiz-display | ✅ (the house tab look) |
| Dialog | `src/components/ui/dialog.tsx` | Modal | none | overlay `bg-black/80`, `max-w-lg p-6 shadow-lg sm:rounded-lg` | **25** | 🟡 command palette and language dialog override it to `rounded-surface-md shadow-floating`. Prefer that override |
| AlertDialog | `src/components/ui/alert-dialog.tsx` | Confirm destructive actions | none | as Dialog | 7: settings, moderation, Sampark campaign/pause/mode/calendar | ✅ |
| Sheet | `src/components/ui/sheet.tsx` | Side drawer | side `top` · `bottom` · `left` · `right` (default) | `bg-background p-6 shadow-lg`, 500ms in / 300ms out | 6: app-shell phone menu, Sampark frames, attendance student manager | ✅ |
| DropdownMenu | `src/components/ui/dropdown-menu.tsx` | Menus | Item, CheckboxItem, RadioItem, Sub | `rounded-md p-1 shadow-md`, item `focus:bg-accent` | 6: auth-button, side-nav rail flyout, grade selector, moderation | 🟡 indigo focus |
| Popover | `src/components/ui/popover.tsx` | Floating panel | `align`, `sideOffset` | `w-72 rounded-md p-4 shadow-md` | 1 (`messages/conversation-thread.tsx`) | ✅ |
| Tooltip | `src/components/ui/tooltip.tsx` | Hint | none | `rounded-md border bg-popover px-3 py-1.5 text-sm shadow-md` | 4 | ✅ (prefer over `title=`) |
| Toast / Toaster / `use-toast` | `src/components/ui/toast.tsx`, `toaster.tsx`, `src/hooks/use-toast` | Transient notices | `default` · `destructive` | `rounded-md border p-6 shadow-lg` | `toast()` called from ~67 files | ✅ |
| Alert | `src/components/ui/alert.tsx` | Inline notice | `default` · `destructive` | `rounded-lg border p-4` | 4: assessment scanner, image uploader | ✅ |
| Skeleton (+ presets) | `src/components/ui/skeleton.tsx` | Loading placeholders | `Skeleton`, plus card, list, article and grid presets in the same file | `animate-pulse rounded-surface-sm bg-muted` | **11** | ✅ |
| Progress | `src/components/ui/progress.tsx` | Progress bar | none | `h-4 rounded-full bg-secondary`, fill primary | 3: admin cost dashboard, Sampark campaign and today | 🔁 Sampark has its own `ProgressBar` (h-2, tone fills) |
| Table | `src/components/ui/table.tsx` | Data table | Header/Body/Footer/Row/Head/Cell/Caption | rows `border-b hover:bg-muted/50`, head `h-12 px-4` | **1** (`rubric-display.tsx`) | ✅ for real tables; most lists are hand-built |
| Accordion | `src/components/ui/accordion.tsx` | Disclosure | single/multiple | `border-b`, 0.2s accordion keyframes | 2: lesson-plan display, scanner result | ✅ |
| Avatar | `src/components/ui/avatar.tsx` | User image | none | `h-10 w-10 rounded-full`, fallback `bg-muted` | **20** | ✅ |
| Separator | `src/components/ui/separator.tsx` | Divider | horizontal/vertical | border | 1 (only inside `ui/sidebar.tsx`) | ✅ |
| Carousel | `src/components/ui/carousel.tsx` | Embla carousel | orientation | none | 1 (video storyteller) | ✅ |
| BackButton | `src/components/ui/back-button.tsx` | "Back" pill | `to` or `onBack` | `rounded-full bg-background/80 backdrop-blur-sm shadow-soft`, `hover:bg-accent` (indigo) | 6: attendance, community, messages, profile | 🟡 indigo hover |
| ResultShell | `src/components/ui/result-shell.tsx` | Frame for every AI output | `size` compact (max-w-2xl) / default (max-w-4xl); `variant` solid / glass; `actionsLayout` inline / stacked | Card, Badge (secondary), Button (outline `h-10 px-3.5`), `animate-fade-in-up` | **11**: lesson plan, quiz, rubric, worksheet, instant answer, visual aid, field trip, teacher training, both assessment results | ✅ **authoritative output frame** |
| Sidebar (shadcn) | `src/components/ui/sidebar.tsx` (770 lines) | shadcn sidebar kit | n/a | `--sidebar-*` vars | **1** (`usage-display.tsx`, for a sub-part) | ⛔ not the app sidebar. Use `shell/side-nav` |
| Calendar · Chart · Collapsible · Menubar · ScrollArea | `src/components/ui/{calendar,chart,collapsible,menubar,scroll-area}.tsx` | shadcn extras | n/a | n/a | **0** each | ⛔ unused |

## 2. Layout primitives: `src/components/layout/` (barrel `@/components/layout`, 27 importers)

| Component | Path | Purpose | Variants | Tokens | Where used | Reuse? |
|---|---|---|---|---|---|---|
| PageShell | `src/components/layout/page-shell.tsx` | Page container and header (breadcrumb, `type-h1`, description, CTA) | `width` narrow / default / wide | `container-*`, `type-h1`, `type-caption`, `type-body-lg`, `py-6 md:py-10 space-y-8` | Sampark workspace page, `sampark/org-shell.tsx` | ✅ intended standard (adoption is low) |
| SectionCard | `src/components/layout/section-card.tsx` | Section container with title, icon and action | `tone` default / muted | `rounded-surface-md border shadow-soft p-4 md:p-6 space-y-3`, `type-h3` | dashboard, my-library, lesson-plan view, about 15 Sampark screens | ✅ **authoritative section card** |
| EmptyState | `src/components/layout/empty-state.tsx` | Nothing-here-yet with optional "Example" sample and CTA | `cta.variant` primary / ghost-like; `sample` | `rounded-pill bg-primary/10` icon, `type-h3`, dashed sample `border-dashed bg-muted/20` | library, conversation list, GeneratorPage, Sampark lists | ✅ (has one `text-[10px]` that should become a token) |
| InlineMicButton | `src/components/layout/inline-mic-button.tsx` | Mic button inside inputs | n/a | primary | teacher-training, Sampark call-parent dialog | ✅ |

## 3. App shell and navigation

| Component | Path | Purpose | Variants / states | Tokens | Where used | Reuse? |
|---|---|---|---|---|---|---|
| AppShell | `src/app/app-shell.tsx` | Chooses layout (Sampark / landing / app); top bar and main | n/a | `bg-wash-screen`, `bg-surface-chrome`, `border-line-hairline`, `h-topbar`, `rounded-pill` | `src/app/layout.tsx` | ✅ (authoritative) |
| ProductSideNav (+ FullItem, RailTile, Badge) | `src/components/shell/side-nav.tsx` | Shared sidebar/rail for **both** products | tier primary / secondary; `collapsed`; `forceFull` (sheet); foldable sections; rail flyouts | `milk-400` active, `saffron-600` icon, `saffron-500` dot, `tint-subtle` hover, `type-eyebrow`, `text-value` / `text-tile`, `duration-small ease-standard` | `app-sidebar.tsx`, `sampark/workspace-frame.tsx`, `sampark/demo/demo-frame.tsx` | ✅ **authoritative nav** |
| AppSidebar | `src/components/app-sidebar.tsx` | SahayakAI's nav model (sections, badges, VIDYA lead, SamparkAI footer) | n/a | via side-nav | `app-shell.tsx` | ✅ (edit nav content here) |
| Brand: `ChromeOrb`, `SahayakWordmark`, `SamparkMark`, `SamparkWordmark` | `src/components/shell/brand.tsx` | Wordmarks | `compact` | `--orb-resting`, `shadow-orb`, `font-display text-brand font-semibold`, `tint-success`, `leaf-500` | app-shell, app-sidebar, Sampark frames and site | ✅ |
| useCollapsedNav | `src/components/shell/use-collapsed.ts` | Fold state in localStorage | n/a | n/a | app-shell, Sampark frames | ✅ |
| MobileBottomNav (TabBar) | `src/components/mobile-bottom-nav.tsx` | Phone floating capsule | active / hidden-on-scroll | `bg-surface-capsule shadow-float rounded-pill`, active `bg-saffron-500` | app-shell | ✅ |
| CommandPalette | `src/components/command-palette.tsx` | ⌘K search (cmdk inside Dialog) | n/a | `rounded-surface-md shadow-floating`, items `aria-selected:bg-primary/10`, `type-body`, `type-caption` | app-shell | ✅ |
| LanguagePill | `src/components/language-pill.tsx` | Top-bar language switch plus dialog | n/a | pill, `rounded-surface-md shadow-floating` dialog | app-shell | ✅ |
| AuthButton | `src/components/auth/auth-button.tsx` | Sign in / avatar menu | signed-out / loading / signed-in | Button default `shadow-sm font-bold`; loading uses raw `bg-slate-200` | app-shell, Sampark frames | 🟡 raw palette |
| LabsBanner | `src/components/labs/labs-banner.tsx` | Banner on Labs routes | n/a | n/a | app-shell | ✅ |
| WorkspaceFrame | `src/components/sampark/workspace-frame.tsx` | SamparkAI app chrome | n/a | ProductSideNav plus `.theme-sampark` | `/sampark/(workspace)` | ✅ |
| DemoFrame | `src/components/sampark/demo/demo-frame.tsx` | Sampark demo chrome | n/a | as above | `/sampark/demo` | 🔁 near-duplicate of WorkspaceFrame |

## 4. Tool-page building blocks

| Component | Path | Purpose | Variants | Tokens | Where used | Reuse? |
|---|---|---|---|---|---|---|
| GeneratorPage | `src/features/generator/components/generator-page.tsx` | Shared tool page: accent-bar card, centred icon/title/description, form slot, result divider, output | `width` (container-*) | `card-accent-bar`, `rounded-surface-md`, `bg-primary/10` icon disc, `font-headline text-2xl sm:text-3xl`, info callout `border-l-4 border-l-primary/70 bg-primary/5`, one raw `text-amber-600` | **5 views**: worksheet, quiz, rubric, instant answer, and the **unused** `features/exam-paper` | ✅ **authoritative tool layout** for Exam/Quiz/Worksheet redesigns |
| GeneratorSubmitBar | same file | Sticky Generate button above the phone TabBar | n/a | `sticky bottom-[calc(3.5rem+safe+.5rem)] md:static` | exam-paper form, instant answer, quiz, rubric | ✅ |
| GeneratorProgress | `src/features/generator/components/generator-progress.tsx` | Generation progress | n/a | n/a | generator views | ✅ |
| MicrophoneInput | `src/components/microphone-input.tsx` | Voice capture for prompts | n/a | primary | 9 | ✅ |
| ExamplePrompts | `src/components/example-prompts.tsx` | "Quick Ideas" chips | `page` | border chips | 8 | ✅ |
| QuickTemplates | `src/components/quick-templates.tsx` (data: `src/data/quick-templates.ts`) | "Quick Start Templates" grid with subject icon discs | n/a | **raw palette** per-subject colours (`text-rose-700`, `text-cyan-700`, `text-orange-700`, … in the data file) | 1: lesson-plan input section | 🟡 tokenise colours before reuse |
| GradeLevelSelector · SubjectSelector · LanguageSelector · DifficultySelector · ResourceSelector · NCERTChapterSelector · AutoCompleteInput | `src/components/{grade-level-selector,subject-selector,language-selector,difficulty-selector,resource-selector,ncert-chapter-selector,auto-complete-input}.tsx` | Standard form pickers | n/a | Select, DropdownMenu | 9 / 9 / 13 / 2 / 2 / 1 / 1 | ✅ |
| SelectableCard | `src/components/selectable-card.tsx` | Icon tile you can select | `isSelected` | border/primary | 1: quiz view | ✅ |
| ImageUploader | `src/components/image-uploader.tsx` | Dashed drop zone | n/a | dashed border, Alert | 5 | ✅ |
| FileTypeIcon | `src/components/file-type-icon.tsx` | Icon per output type | n/a | n/a | 5 | ✅ |
| Lesson plan input/sidebar | `src/components/lesson-plan/*` | Lesson Plan's own two-column form | n/a | mixed | `/lesson-plan` | 🟡 bespoke; does not use GeneratorPage |
| Exam Paper (live) | `src/app/exam-paper/components/*` (16 files: form, header, preview, blueprint, sections, panels, states, skeleton, dialog…) | The live `/exam-paper` route | n/a | mixed | `src/app/exam-paper/page.tsx` | 🔁 see next row |
| Exam Paper (dead) | `src/features/exam-paper/components/{exam-paper-form,exam-paper-preview,exam-paper-view}.tsx` | Older GeneratorPage-based version | n/a | n/a | **0 importers** outside its own folder | ⛔ duplicate. Do not extend |
| Output displays | `src/components/{lesson-plan-display,quiz-display,worksheet-display,rubric-display,instant-answer-display,visual-aid-display,virtual-field-trip-display,teacher-training-display}.tsx` | Tool outputs inside ResultShell | n/a | ResultShell plus content styles | one tool each | ✅ |
| ShareToCommunityCTA · QuickShareButton · FeedbackDialog | `src/components/{share-to-community-cta,quick-share-button,feedback-dialog}.tsx` | Output actions | n/a | n/a | output pages | ✅ |
| UsageRemainingBadge · PlanBadge · UpgradePrompt | `src/components/{usage-remaining-badge,plan-badge,upgrade-prompt}.tsx` | Plan and quota UI | n/a | n/a | 3 / 1 / several | ✅ |

## 5. Home and dashboard

| Component | Path | Purpose | Tokens | Where used | Reuse? |
|---|---|---|---|---|---|
| DashboardHome | `src/components/dashboard/dashboard-home.tsx` | Signed-in teacher home: greeting, VIDYA orb, composer, prep-tool chips, suggestions | `container-wide`, `text-saffron-600` name, `rounded-pill bg-surface-disc shadow-float` composer, `bg-saffron-500 shadow-mic` send, suggestion `Card hover:shadow-elevated` | `src/app/page.tsx` (signed in) | ✅ reference for teacher/principal dashboards |
| RecentWorkStrip | `src/components/dashboard/recent-work-strip.tsx` | Recent outputs strip | n/a | DashboardHome | ✅ |
| LandingPage and `components/landing/*`, `components/marketing/*` | `src/components/landing/landing-page.tsx` … | Marketing site (exempt from app token rules per `DESIGN_TOKENS.md §9`) | web-* sizes, ambient layers, saffron scale | `/` signed out, `(marketing)` | ✅ for marketing only |

## 6. VIDYA

| Component | Path | Purpose | States | Where used | Reuse? |
|---|---|---|---|---|---|
| VidyaPresence | `src/components/vidya/vidya-presence.tsx` + `.vidya-*` in `globals.css` | Flat CSS orb (hero / workspace / compact) | idle, connecting, listening, interrupted, thinking, speaking, error (red ring) | `landing/landing-voice-orb.tsx`, `vidya-live-orb.tsx` | 🔁 one of two orb renderers |
| VidyaSphere | `src/components/vidya/vidya-sphere.tsx` | WebGL live orb (CSS fallback) | idle, listening, thinking (indigo), speaking (**leaf**), error (desaturated, "never red") | `dashboard-home.tsx`, `omni-orb.tsx` | 🔁 newer renderer (Oct 2026 LiveOrb tokens). Pick one with the founder before redesigning VIDYA |
| OmniOrb | `src/components/omni-orb.tsx` | Floating bottom-right mic orb on app pages | n/a | `app-shell.tsx` (dynamic) | ✅ |
| VidyaLiveOrb | `src/components/vidya-live-orb.tsx` | Live orb wrapper | n/a | `omni-orb.tsx` | ✅ |
| VidyaLiveProvider | `src/components/vidya/vidya-live-provider.tsx` | Live session context | n/a | app-shell | ✅ |
| GlobalVoiceInterface | `src/components/global-voice-interface.tsx` | Voice overlay | n/a | app-shell (marketing) | ✅ |
| OmniOrbLive · VoiceAssistant · SahayakAvatar · Logo | `src/components/{omni-orb-live,voice-assistant,sahayak-avatar,logo}.tsx` | older voice and brand pieces | n/a | **0 importers** | ⛔ orphaned |

## 7. SamparkAI console kit: `src/components/sampark/`

| Component | Path | Purpose | Variants | Tokens | Where used | Reuse? |
|---|---|---|---|---|---|---|
| PageHeader · Panel · KpiCard · MiniStat · AttentionRow · ProgressBar · ToneIcon | `src/components/sampark/console-ui.tsx` | Console blocks | `ConsoleTone` = plain · live · notice · done · alert | `sampark-*`, `shadow-sampark-card/raised`, `rounded-xl` / `rounded-lg` | 8+ Sampark demo pages | ✅ for Sampark; 🔁 `PageHeader` overlaps `PageShell`, and `KpiCard` overlaps `KpiTile` |
| StatusPill (+ CampaignStatusBadge, CallStateBadge, HeardBadge, ImportStatusBadge) | `src/components/sampark/status-pill.tsx` (+ `labels.ts`) | Status label with dot and title | tone neutral · info · success · warning · danger · brand | `bg-<tone>/10 border-<tone>/30`, `rounded-pill`, 2px dot | **19** | ✅ best status pattern in the repo; reuse app-wide |
| KpiTile + Sparkline | `src/components/sampark/kpi-tile.tsx` | KPI with 7-day sparkline | emphasis | muted bars, today highlighted | `today-cards.tsx` | 🔁 vs KpiCard |
| ErrorPanel · LoadingBlock · InlineSpinner · describeError | `src/components/sampark/states.tsx` | Error, loading and spinner states | n/a | `border-destructive/40 bg-destructive/10`, Skeleton h-16, Loader2 | **17** | ✅ good generic state set; consider promoting to `components/layout` |
| ModeBanner | `src/components/sampark/mode-banner.tsx` | Practice/Test/Live banner | mode | n/a | Sampark | ✅ |
| ThemeScope | `src/components/sampark/theme-scope.tsx` | Applies `.theme-sampark` to portals | n/a | n/a | 1 | ✅ |
| Calendar, callbacks, campaign wizard/detail, rosters, Riya panel, settings | `src/components/sampark/{calendar,callbacks,demo}/…`, `campaign-*.tsx`, `riya-call-panel.tsx`, `settings-*.tsx` | Feature screens | n/a | SectionCard, EmptyState, console kit | Sampark routes | ✅ |

## 8. CSS-only patterns (`src/app/globals.css`)

| Class | Purpose | Uses | Reuse? |
|---|---|---|---|
| `.bg-wash-screen` | App ground | 1 (app shell) | ✅ |
| `.focus-ring` | 2px saffron-600 outline | 80 | ✅ preferred focus treatment |
| `.type-eyebrow` / `.type-web-eyebrow` | Uppercase labels | shell, marketing | ✅ |
| `.type-h1/h2/h3/body-lg/body/caption` | Phase-1 type utilities | 18 (`type-h*`) | 🟡 overlaps the named sizes |
| `.container-narrow/default/wide` | Page widths | 12 | ✅ |
| `.card-accent-bar` | 4px saffron top bar | GeneratorPage | ✅ |
| `.card-section` · `.card-elevated` · `.section-divider` · `.result-accent` · `.tool-icon-wrap` · `.section-title` · `.result-divider` | Phase-1 helpers | low | 🟡 check before use |
| `.page-container` | Legacy max-w-4xl | 0 | ⛔ |
| `.indic-text` · `.demo-safe-wrap` | Indic-safe wrapping | many outputs | ✅ |
| `.force-light` | Light tokens for marketing under `.dark` | marketing | ✅ |
| `.ambient-glow` / `.ambient-grain` / `.mark-float-*` | Landing atmosphere | landing | ✅ marketing only |
| `.vidya-stage/-sphere/-core/-ring/-icon/-wordmark/-status-dot` | VidyaPresence | VIDYA | ✅ (`.vidya-wordmark` font var bug, see index §6) |
