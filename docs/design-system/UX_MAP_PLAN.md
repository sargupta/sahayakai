# UX map implementation plan

Source: "SahayakAI UX Map" (https://claude.ai/artifact/1B98eV3d5fZDsTJrZacR4T), 25 screens, 6 sheets,
7 flows, 10 design-vs-code gaps. Agreed 2026-11-01.

## Decisions

| Topic | Decision |
| --- | --- |
| VIDYA's orb | **Keep the dock** (see INDEX.md "Shared chrome"). The map's floating-orb hints map onto the dock capsule. |
| Tool results | **Separate Output screen** with shared chrome (Copy · Save · PDF · Edit · Share + one primary action). The user had no preference; this is the recommended option. |
| Onboarding | **Keep the 3 steps**; returning teachers who already have a profile skip it. |
| Home | **Skipped for now** (uncommitted work in `vidya_home_screen.dart`). |
| Prep desk | Replaced by the Make hub (Prepare · Assess · Explore) at the same route; the unused Create palette is removed. |
| Tab names | Kept: Home · Library · Community · Me. |
| VIDYA routing with an OpenRouter key | Backend issue, out of scope for the app. |

## Phases (in order)

1. **Tool chrome, centrally in `shared/widgets/tool_scaffold.dart`**: VIDYA page context for every tool,
   the shared Output screen, minimise-to-orb for every generator.
2. **Deliver tray**: distinct WhatsApp, Print (`printing` package) and PDF (`pdf`) destinations.
3. **Make hub** replacing the Prep desk.
4. **Library and Community**: sync state on every row; Shared resources screen; feed post composer.
5. **Offline**: `connectivity_plus`, grey orb, offline banner, queue on Me.
6. **Smaller screens**: onboarding skip for returning teachers; quiz composer count slider and Bloom's
   strategy card; parent-call summary stage.
7. **Home**, when the user says go.

## Progress

- **Phase 1, pass A: done.** `ToolScaffold` has the Output screen (`hasResult`, `onEdit`, `onRegenerate`,
  `deliverable`), and all 13 generator screens use it: a finished result replaces the form, Edit calls
  the tool's `clear()` and brings the form back intact. Lesson plan also passes a deliverable, so its
  Output screen has Deliver and the orb turns green while it shows (`visibleDeliverableProvider` in
  `vidya/presentation/vidya_presence.dart`).
- **Edit never discards a result** (fixed after review): `ToolScaffold` keeps an editing flag; the
  form comes back, the result stays mounted, *Back to result* returns to it, and the sticky Generate
  runs the tool's `onResubmit: _submit`. Only a finished regeneration replaces the result.
- **Home: done** (the user's updated UX map, voice-first H-01): header with avatar → Me, language
  pill and messages; "Ask for anything in the app"; three say-it rows that open Lesson Plan (topic +
  Class 7), Quiz (10 questions, medium; `ToolPrefill` gained `questionCount` and `difficulty`) and
  Attendance; the 144px big orb carrying VIDYA's state; the type box (→ VIDYA's sheet + `sendText`)
  and mic; "Waiting for you" from real state only (ready results, unread messages, unread updates);
  four tiles; "All N tools". The dock hides on Home (`showDock`) and shows on the other tabs.
- **Phase 1, pass B: next.** Lift each tool's share text out of its result view into a top-level
  `xAsPlainText` (as `lessonPlanAsPlainText`), then pass a deliverable from each screen.
- **Phase 1, page context: partly blocked.** Tool routes already map to page names in the VIDYA sheet;
  the four tabs still all report "Home", and per-field context needs `vidya_sheet.dart`, which has the
  user's uncommitted work.

Each phase ends with its tests, `flutter analyze`, `scripts/token_guard.sh`, and a full-suite comparison
against the 58 failures that already existed before this work.
