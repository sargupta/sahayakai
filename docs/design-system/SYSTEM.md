SahayakAI is a voice-first teaching assistant for school teachers: in India's metros, towns and villages, and wherever a teacher works across classes, languages and syllabi. A teacher says one sentence in their own language. VIDYA, the assistant, returns a lesson plan, worksheet, quiz, rubric, graded test, attendance register or parent call. Every output is grounded in the teacher's own board: CBSE, ICSE / ISC, or any of 27 state and UT boards (29 in all), in 11 languages.

This system is the single source for how SahayakAI looks, moves and speaks: on the Android app, the web app, the school console, the website and print. It is built from the two founder-approved mobile canvases. The 16-screen v3 canvas sets the visual language and the shared chrome. The 47-screen v2 canvas defines the rest of the product: VIDYA Live, conversation, community, every tool's composer and output, parent calls, library and offline. Where the two draw the same thing differently, v3 wins. Build from these tokens and components, never around them.

**What is here:** 110 components (every mobile component previewed at the phone's true 360px width), 45 full screens covering the whole product on the phone, the web app and the school console, the tokens, and 13 guides. The guides are "Screen anatomy", "VIDYA and voice", "VIDYA Live", "Boards and curriculum", "Languages and scripts", "Writing for teachers", "The product, screen by screen", "The website", "The web app and the school console", "Accessibility and quality gates", "Platforms and code", "Decisions and governance" and "Print, messages and notifications".

## The thesis

Start from the job, not the screen. A teacher has minutes between periods and wants one thing: classroom-ready material they trust, in their language, for their textbook. Each principle below follows from that job.

1. **Voice is the front door; typing is an equal sibling.** VIDYA, the orb, floats over every screen and is one tap away. Every field takes speech or text, and the result is the same.
2. **The page is the context.** VIDYA reads the screen behind it. Asking, generating and delivering happen in sheets over the current page; the teacher never navigates away to "go to the AI".
3. **One decision per screen.** One saffron primary action, one deliver tray for every output, four tabs and never five.
4. **Colour is meaning, and it is scarce.** Saffron is VIDYA and the one action. Leaf is done, selected and ready. Indigo is working and curriculum. Red and amber are status. Nothing else is coloured.
5. **Calm, premium material.** Warm milk washes, translucent glass, low warm shadows, pill shapes: quiet enough for a crowded staffroom, refined enough for a principal choosing a platform.
6. **Truth before polish.** Outputs name their board, textbook and chapter, and VIDYA drafts while the teacher decides. States are honest: working, ready, offline, failed. No invented numbers anywhere.
7. **Every script is first-class.** Hindi, Kannada or Odia is never a fallback. Native names, the right fonts, and room for matras and conjuncts.

## Content fundamentals

- **Voice.** A calm, capable colleague in the staffroom: never a platform, never a cheerleader. VIDYA speaks in the first person ("Tell me what you teach. I'll stay a tap away on every screen after this."). Address the teacher as **you**, with the dignity owed to a professional. VIDYA drafts; the teacher decides.
- **Concrete over abstract.** Use real counts, classes and times: "4 absentees to call", "34 test sheets to scan", "Class 7 Maths at 10:20", "Two periods, one prep gap". Name the board, textbook and chapter: "CBSE · NCERT Ganita Prakash 7, Chapter 8".
- **Code-mixing is normal.** Scripts sit inline with English as teachers actually speak: "इससे एक worksheet बना दो — दस सवाल", "Script in हिन्दी". Language names are always in their own script.
- **Casing and punctuation.** Use sentence case everywhere. UPPERCASE is reserved for tracked eyebrows in Latin script. The middle dot ` · ` joins metadata ("Worksheet · 10 questions · हिन्दी"). Short verbs on actions: Open, Deliver, Start teaching, Tap to speak.
- **Trust copy is plain.** "Nothing leaves the phone until you tap send." Errors say what happened and what to do: "The connection dropped. Your topic is kept; try again."
- **No emoji, no hype.** Never "magic", "supercharge" or "AI-powered" as a selling point. The only typographic symbol is the middle dot; checks, arrows and every other mark are drawn icons from `Icon`, never text characters (✓ ✕ ➤ ⚙ ‹).
- **Privacy in every line.** Phone numbers show only their last four digits (`••••••4412`). Nothing leaves the phone, and no parent is called, without the teacher's tap.
- **Never invent.** No made-up statistics, testimonials or named people. A sample is labelled as a sample.

Deeper rules are in "Writing for teachers".

## Visual foundations

### Colour

- **Grounds.**
  - App screens sit on `wash-screen`: peach, blush, sage, cream at 168°, plus one `glow-saffron` off the top-right corner.
  - While VIDYA works the screen turns faintly indigo (`wash-working`); during a live call, faintly leaf (`wash-call`).
  - In VIDYA Live the whole screen takes her state's colour, lit from behind the orb: `wash-live-listening`, `wash-working`, `wash-live-speaking`, `wash-live-failed`, each with its `glow-live-*`.
  - The design canvas is `surface-page`; the website alternates `surface-web` and `surface-band`.
- **Cards are glass.** `surface-glass` (82% white) with a 1px `border-glass` edge for cards and unselected chips; `surface-glass-strong` (88%) for content the teacher reads; `surface-glass-soft` (70%) for secondary tiles. Sheets and the deliver tray are solid `surface-card`. Inset controls and context use `surface-inset` with `border-hairline`. Never draw a grey outline around a card: the luminous edge is the boundary.
- **Text.**
  - `text-strong` (`ink-900`) for titles and values; `text-body` (`ink-600`) for body and sublines; `text-muted` (`ink-500`) for placeholders, hints and inactive icons. All three hold 4.5:1 or better on every app ground, glass and tint.
  - `text-eyebrow` (`saffron-600`) for eyebrows and text actions.
  - `text-faint` (`ink-400`) is for website eyebrows and footer links only (flagged, 3.2–3.9:1).
- **Saffron is VIDYA and the one action.** Use `saffron-500` for the primary button, selected language chips, the active tab disc, the orb and the mic disc. As text, saffron is `saffron-600` (4.7:1 or better) or `saffron-700` on tints.
- **Meaning colours, one meaning each.**
  - `leaf-500` means selected, done and ready: class chips, ticks, the ready orb, Submit attendance.
  - `indigo-500` means working and curriculum: the working orb, progress, board marks, curriculum pills.
  - `red-500` means absent, wrong and ending a call; `amber-500` means late, queued and waiting.
  - Status is always also a word.
- **The camera surface.** The scanner is the one dark context. Use `camera-ground`, `on-camera`, `on-camera-muted`, `camera-glass` and `camera-border`; the orb and tab bar adapt and survive.
- **Banned:** purple or blue-violet gradients, gradient text, rainbow categories, pure black or grey, and any colour not in this file.

### Type

- **Bricolage Grotesque** (`--font-display`) is for titles, field values, card titles, CTAs and quoted speech; its optical size follows the font size. **Instrument Sans** (`--font-ui`) is for everything else. Both fall back to the Noto Sans family of each Indian script, in order, so mixed-script lines shape correctly.
- **App scale** (360px screens):
  - `type-hero-app` 28 (onboarding), `type-screen-title` 26 (Home), `type-page-title` 22, `type-output-title` 20.
  - `type-card-title` 15, `type-value` 14, `type-tile-title` 13.
  - `type-reading` and `type-body` 12, `type-body-sm` 11.
  - `type-eyebrow` and `type-pill` 10, Latin only.
  - Display tracking is slightly negative (−.01 to −.03em); eyebrows are tracked +.14 to +.18em.
- **Website scale:** `type-web-h1` clamp(40px, 6vw, 68px); `type-web-h2` up to 44; `type-web-lead` 18; `type-web-body` 14.
- **Indic text** is never uppercased, letter-spaced or truncated. Nothing is smaller than 12px in any script, and Indic reading text gets a 1.7 line height. Set `lang` on any text whose language differs from the page.

### Space and layout

- **The screen.**
  - Phones are drawn at `screen-w` × `screen-h` (360 × 760) with 20px side gutters, a 36px status bar and 14px between blocks.
  - Content pads `screen-pad-bottom` (96px) so nothing hides under the floating tab bar, which sits `tabbar-bottom` (18px) above the foot.
- **The orb's place.** It parks at right 16 / bottom 100; at bottom 172 when a full-width CTA is present; and on the left for a left-handed teacher, who sets that once in Profile.
- **One primary action** per screen, full width at `cta-height` (52px), directly above the tab bar.
- **Spacing** follows the source's own scale (`space-1` 4 … `space-12` 44): 7px between chips, 9px between paired cards, 10px inside rows, 12px between sheet blocks. Card paddings are drawn exactly (13px 14px, 14px 15px); don't round them to a grid.
- **The web app:** under 768px it is the phone layout; from 768px a 76px rail (`sidebar-w-rail`) and a 64px `TopBar`; from 1024px the 256px sidebar (`sidebar-w`) and content up to `container-app` (1120px). Sheets become `Dialog`s from 768px.
- **Website:** a `container-web` (1220px) container with 28px side padding and 88–96px section rhythm. Grids use `repeat(auto-fit, minmax(…, 1fr))` so everything reflows under 1000px.
- **Banned layouts:** cards inside cards, three equal feature panels with tinted icon circles, left-border accent cards.

### Shape, depth and material

- **Everything you press is a pill** (`radius-pill`): buttons, chips, tabs, the Composer, the orb.
- Containers step up in radius as they grow: `radius-row` 12 (rows), `radius-field` 14 (inset context, deliver options), `radius-tile` 16 (content sections), `radius-card` 18 (cards), `radius-panel` 20 (the primary card), `radius-sheet` 26 (sheets), `radius-screen` 38 (the device).
- **Shadows are warm, low and rare.** Only the primary card on a screen is raised (`shadow-card`). Floating chrome uses `shadow-float`, sheets `shadow-sheet`. Brand elements cast saffron light: `shadow-cta` on the CTA and `shadow-orb` on the orb. Never use inner shadows.
- **Focus** is a 2px `saffron-600` outline offset 2px from the control. It is never a shadow, so no shadow can hide it, and it is 4.9:1 or better on every ground. On the camera ground it turns `on-camera`.
- **Glass and blur.** Glass is translucency over the wash. Real blur appears only behind the website's sticky nav (18px).

### Motion

- **Gentle and continuous, never bouncy.**
  - Durations: .25s for small changes (chips, tabs), .4s for sheets and cards, .8s for slides.
  - One curve: `cubic-bezier(.4, 0, .2, 1)`.
- **VIDYA's motion is its voice.**
  - Resting, the orb floats 7px over 5.5s.
  - Listening, it pulses at 2s inside a halo.
  - Working, it pulses at 1.8s in indigo, and active steps breathe at 1.6s.
  - In VIDYA Live the listening halo and the speaking rings follow the real voice level (`level`, 0–1), and the working arc turns once every 2.6s.
- **Press:** scale to .98. Website cards lift 3px on hover.
- **`prefers-reduced-motion`** stops every float, pulse and shimmer. The state stays visible through colour and words.

### Imagery

- Surfaces are type- and colour-led: no stock photos, no robots, no circuit brains.
- Show real screens (`DevicePhone`) instead of describing them. If photography is added, it is warm, daylight-lit and of real classrooms.
- Illustration never replaces a label. Empty states show a labelled example.

## Iconography

- **One drawn set.** Every icon comes from `Icon`: 49 glyphs on a 20px grid, 1.7 stroke, round caps, drawn in the current text colour. The four destinations (home, library, community, profile) lead the set; controls (mic, send, keyboard, play, pause, speaker, phone), actions (copy, download, print, share, edit, refresh, thumbs) and states (alert, clock, sync, signal-off) follow. The same glyphs are in the Icons group as SVG files.
- **Few icons.** The product still prefers words: status dots (8px circles in a meaning colour), square letter marks (a board initial, a type badge such as LP or WS) and a word beside every icon that means something.
- **A sphere is VIDYA, a mic glyph is a control.** Never put a glyph on the orb, and never draw a mic button as a sphere.
- **The mark.** The SahayakAI mark (an open book, a spark and a caring hand in saffron) is raster only, in the Logos group. Never redraw, recolour or stretch it. In UI chrome the wordmark is Bricolage Grotesque 600 beside a small resting orb.

## VIDYA

- **Colour is the state.** Resting, dragging and listening are saffron; working and checking a source are indigo; speaking and ready are leaf; offline is stone. The orb is never red: a failure is a red pill and a card in words.
- **One orb.** Exactly one orb per screen, never inside the tab bar or a card, never over a primary action.
- **Three ways to talk, one assistant.** A tap opens the `VoiceSheet` over the page: one request about what is behind it. "Keep talking" opens **VIDYA Live**, the full-screen, hands-free conversation (listening, checking the board's source, speaking with captions, interruptible). Typing opens the **conversation** thread. Every talk is kept in Library → Conversations; only a tool's output becomes a Generation.
- **No background listening.** There is no wake word. The microphone is open only while VIDYA is visibly listening, with Mute one tap away.
- **On the web** the same states drive `VidyaPresence`: the workspace on Home, the compact dock on every tool page, one session across the app.

More is in "VIDYA and voice" and "VIDYA Live".

## Boards and languages

- **Boards.** Every teacher sets a board once (`BoardSwitch`): CBSE, ICSE / ISC, or one of 27 state and UT boards.
  - Everything VIDYA makes is labelled with it ("CBSE · NCERT Ch 8", "KSEEB · Class 7").
  - The curriculum notice says what it aligned to before anything is written.
  - Never present SahayakAI as NCERT-only.
- **Languages.** There are 11: English, हिन्दी, ಕನ್ನಡ, தமிழ், తెలుగు, मराठी, বাংলা, ગુજરાતી, ਪੰਜਾਬੀ, മലയാളം and ଓଡ଼ିଆ. The interface language and each output's language are set separately.

More is in "Boards and curriculum" and "Languages and scripts".

## Accessibility floor

- **Contrast:** 4.5:1 for text and 3:1 for focus indicators, meaningful icons and selected states, on the grounds each token's note names. The values are in the usage notes.
- **Touch:** 44 × 44 for anything pressable. Where the design draws a control smaller (42px tabs, 40px mic, 36px chips), the visual size stays exact and the touch area is extended (`.sk-hit`, `target-min`).
- **Semantics:** real buttons, links and inputs; tied labels; `aria-current` on the active tab; sheets as dialogs that close on Escape; results announced through polite live regions.
- **Colour is never alone:** every state also has a word, a number or a glyph.
- **Decided** (decided 26 Oct 2026): white text sits on `accent-fill` (`saffron-600`, 5.28:1), never on `saffron-500`; nothing is smaller than 12px, and the apps follow the system text size.
- **Flagged and kept exact** (the fixes are in "Accessibility and quality gates"):
  - `ink-400` website text is 3.2–3.9:1.
  - Glass card edges are luminous, not 3:1 boundaries. Fields are identified by label and fill, and their focused edge meets 3:1.

## Using this system

- **Web.** Load `tokens.css` and `components/bundle.css`, then React 18 and `components/bundle.js`; components are on `window.SahayakAI`. The `sk-` classes are the reference implementation. Placement helpers: `.sk-tabbar-dock`, `.sk-orb-park` (`--left`, `--cta`), `.sk-stage`.
- **Next.js app.** Map these token names onto `globals.css` variables and the Tailwind theme; "Platforms and code" lists every mapping, and "The web app and the school console" lists what the context-aware VIDYA branch already aligns and the four values still to change.
- **Flutter app.** Map the tokens into `AppColors`, `AppRadius`, `AppShadows` and `AppText` under the same names; the four-tab capsule replaces the labelled bottom bar.
- **The website** is always light, built as `WebNav` → `WebHero` → `WebSection`s → `CTABand` → `WebFooter`.

**Intentional additions** beyond the two canvases, each with a reason:
- `Field`, `Switch`, `OptionSheet`, `BoardSwitch` and `LanguagePicker`: real forms need inputs, pickers and toggles in the same visual language.
- `Sheet`: one dialog shell for everything that asks.
- `SideRail`: the four destinations on desktop and tablet.
- `Toast`, `Skeleton`, `EmptyState` and `ProgressBar`: honest states.
- `ArtifactFrame`, `QuizQuestion`, `RubricCriterion`, `PostCard` and `DocumentSheet`: the outputs as components.
- `StatTile` (large), `OutcomeBar`, `DataTable`, `SourceLabel`, `ApiKeyRow` and `KeyReveal`: the school console, from the Sampark work on the calls view and integrations.
- `SideRail` (sidebar and rail), `TopBar`, `Dialog`, `LibraryCard` and `VidyaPresence`: the web app, from the context-aware VIDYA work.
- `Icon`: one drawn icon set, replacing text symbols.
- `Avatar`, `SettingsRow`, `ChecklistStep` and `RosterRow`: the repeated rows of the v3 screens.

**Not synced.**
- One theme, by decision (decided 26 Oct 2026): light, plus the dark camera surface. The dark modes the web and Flutter apps ship today retire.
- Motion is described here, not as tokens, because the format has no motion family.
- The canvases' samples are corrected: Class 7 fractions is NCERT Ganita Prakash 7, Chapter 8; the water cycle is Class 6, NCERT Curiosity 6, Chapter 8 "A Journey through States of Water"; photosynthesis is Class 7; 18 Sept 2026 is a Friday.
- v2 drew grounding in bright blue (#2563EB); the system uses indigo. The web branch draws VIDYA speaking in saffron with a mic on the idle orb; the system uses leaf and a glyph-free orb.
- Offline queueing is designed (Profile, the stone orb) but not yet shipped: library items load from the network today.
