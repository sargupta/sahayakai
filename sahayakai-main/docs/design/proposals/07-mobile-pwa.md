# Mobile / PWA Experience — Design Review Proposal

**Lens:** Mobile-web across the app. **Persona:** thumb-driven, one-hand, mid-range Android, patchy 3G.
**Constraints:** Lucide-only, saffron-forward, voice-first. **Status:** review board draft.

> Reality check: the app already ships a mobile bottom nav (`mobile-bottom-nav.tsx`), a voice FAB
> (`omni-orb.tsx`), a sidebar-as-Sheet on mobile (`ui/sidebar.tsx`), a PWA install card
> (`pwa-install-prompt.tsx`), and network gating (`use-network-aware.ts`). This is **not** a greenfield
> pitch — it is an audit of what exists and where first-principles thinking says it falls short.

---

## 1. Current-state assessment + top pain points

**What works:** Bottom nav is `md:hidden`, scroll-hides on read, respects `safe-area-inset-bottom`. Voice
orb is always one tap away. Generators use a 12-col grid that collapses to single-column. Community already
has mobile-specific chips + FAB. `useNetworkAware` blocks AI on 2g/slow-2g before a doomed request fires.

**Pain points (ranked):**

1. **Touch targets below spec.** Sidebar menu buttons are `h-8` (32px) vs the 44px iOS / 48dp Android
   minimum. Every nav row in the mobile Sheet is a mis-tap risk for an adult thumb.
2. **Two competing floating actions.** On Community, the create-FAB was pinned *left* purely to dodge the
   right-side orb (see comment in `community/page.tsx`). Two thumb-zone CTAs fighting for the same corner is
   a smell, not a solution.
3. **Discovery is search-gated.** The bottom-nav "Create" tab opens the ⌘K command palette — a
   keyboard-first metaphor. A teacher who doesn't know a tool's *name* cannot browse to it from the primary
   nav; the full tool tree lives only in the side Sheet.
4. **Long forms = long scroll.** Quiz/worksheet config (subject, grade, language, count slider, question-type
   grid, Bloom's chips, generate) stacks into one tall column on mobile. The **Generate** button sits at the
   bottom of a long scroll with no persistent affordance.
5. **Result toolbars aren't reachable.** `ResultShell` stacks its action row (Download / Print / Save) at the
   *top* of the card on mobile and it is not sticky — after scrolling a 20-question quiz the teacher must
   scroll back up to export.
6. **Network cues are Hindi-only.** `aiUnavailableReason` hardcodes English + Hindi. This violates the
   11-Indic-language rule the rest of the app honors, and strands Tamil/Bengali/Odia teachers.

---

## 2. Mobile-first navigation model

Keep the bottom tab bar — it's the right pattern — but fix the intent model. **Reframe the 4th-of-5 slot as a
center "Create" that opens a bottom sheet of *labeled tool tiles*, not the command palette.** Browse for
those who don't know names; the palette stays for power users via the header search.

Proposed 5-slot bar (equal 44px+ targets):

```
[ Home ]  [ Library ]  [ ➕ Create ]  [ Community ]  [ Me ]
                          (center, raised)
```

- **Create** = raised saffron center button → sheet with the 8 QuickAction tools already defined in
  `dashboard-home.tsx`. Reuse, don't reinvent.
- **Voice is the FAB, not a tab.** Resolve the collision by docking the OmniOrb *above the center Create
  button* (bottom-center) rather than bottom-right, so it never overlaps a corner CTA. One voice ring, one
  create sheet, no left/right dodging.
- Retire the side Sheet's role as the *only* full tool list on mobile; it becomes a secondary "everything"
  drawer, and its rows go to 44px.

---

## 3. Generator input + long AI results on a small screen

**Input — progressive, not a wall.** Collapse the config panel into an accordion: only **Topic + Voice + big
Generate** visible above the fold; "Options" (grade, language, count, types, Bloom's) collapsed by default
with sensible defaults already set (the forms pre-fill these). This drops time-to-first-generate to a single
thumb tap for the common case. Make **Generate** a sticky bottom bar on mobile (above the nav) so it's always
in the thumb zone regardless of scroll depth.

**Results — skimmable + exportable in place.**
- Make the `ResultShell` action row a **sticky bottom action bar** on mobile (Download / Save / Share as
  icon buttons, Lucide, 44px), so export never requires a scroll-back.
- Long results (quiz variants, lesson plans) get a compact in-card jump: variant tabs already exist — pin
  them under the sticky header so Easy/Medium/Hard switch without scrolling.
- Render long AI text at `type-base` line-height ≥1.6 for Indic scripts (Devanagari/Kannada ascenders clip at
  tight leading — already patched ad-hoc in Community; make it a token).

---

## 4. Offline / patchy-network UX cues

- **Global connection banner.** A slim, dismissible top strip driven by `useNetworkAware` — "Slow network"
  (amber) / "Offline" (stone) — visible app-wide, not just inline on the Generate button. **Translate it into
  all 11 languages** via the existing `t()` pipeline; kill the hardcoded EN+HI string.
- **Optimistic + queued actions.** Community already does optimistic likes/posts. Extend the mental model:
  when offline, queue the *intent* ("will generate when back online") with a Lucide `CloudOff` chip rather
  than a dead button, so the teacher isn't left guessing.
- **Skeletons over spinners on 3G.** Long AI calls (15–40s on a mid-range Android, per the dashboard cascade
  comments) should show progress-shaped skeletons, not an indeterminate `Loader2`, so the wait reads as
  "working" not "hung."

---

## 5. PWA / install & voice ergonomics

- **Widen install surface.** The card is gated to `/` and `/onboarding` only. Add a *persistent, low-key*
  "Install app" entry in the Me tab / side drawer so a teacher who dismissed it once can still install later
  — installed PWA is the single biggest lever for repeat, offline-tolerant usage.
- **Voice-first ergonomics.** The orb + big-mic on Home are strong. Two upgrades: (a) a visible
  **listening/level indicator** so the teacher knows it heard them on a noisy staffroom mic; (b) a
  **long-press-to-talk** affordance on the orb (walkie-talkie model) — more forgiving one-handed than
  tap-start/tap-stop, and it matches the `MIN_AUDIO_BYTES` silence guard already in `microphone-input.tsx`.
- Confirm `apple-touch-icon` + standalone display (already injected) render a clean icon; verify no address
  bar leaks in standalone.

---

## 6. Quick-wins vs big-bets

**Quick-wins (days):**
- Bump sidebar mobile rows `h-8 → h-11`; audit all mobile tap targets to ≥44px.
- Make `ResultShell` action row + generator Generate button **sticky bottom bars** on mobile.
- Translate `aiUnavailableReason` into all 11 languages via `t()`.
- Add the global connection banner (reuse `useNetworkAware`).
- Add "Install app" to the Me/drawer surface.

**Big-bets (weeks):**
- Re-architect the "Create" tab → labeled tool-tile bottom sheet; dock the orb bottom-center to end the
  FAB/orb collision.
- Progressive-disclosure accordion for every generator's config panel.
- Offline action queue with `CloudOff` cues + progress-shaped skeletons for AI waits.

**Guiding principle:** every primary action must be reachable by one thumb, in one hand, and must survive a
dropped connection with a clear, translated cue. The scaffolding is already here — the work is tightening
reach, resolving the two-FAB conflict, and making the network state honest in all 11 languages.
