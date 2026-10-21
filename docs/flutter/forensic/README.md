# Forensic report — index & integrity note

**Date:** 2026-07-28. **Subject:** the SahayakAI Flutter Android app, audited against the production web app.

## Which app this report is about (read first)

There are **three** Flutter trees on the build machine. Only one is the real, shipping app:

| Tree | Dart files | Architecture | Package | Branch / last commit | Status |
|---|---|---|---|---|---|
| **`wt-flutter-rebuild/sahayakai-flutter`** | **405** | `lib/features/*` | **`com.sargvision.sahayakai`** | `feature/flutter-rebuild`, actively developed today | **THE REAL APP — this report's subject** |
| `sahayakai/sahayakai_mobile` | 194 | `lib/src/*` | `app.sahayakai.mobile` | `feature/demo-call-lead-magnet`, last commit 2026-07-03 | **Stale/abandoned older app (3 weeks old)** |
| `sahayakai/sahayakai-flutter` | 5 | — | `ai.sahayak.sahayakai` | `feature/demo-call-lead-magnet`, 2026-07-03 | Dead 5-file stub |

`app.sahayakai.mobile` is confirmed stale by the project's own `HANDOFF.md` ("a stale entry from an earlier attempt, NOT this app's real `com.sargvision.sahayakai`").

## Integrity note — one doc audited the wrong tree

During the multi-agent investigation, most agents correctly audited the real app (`wt-flutter-rebuild/sahayakai-flutter`). **However, `CAPABILITY_CENSUS.md` (as first generated) mistakenly audited the stale `sahayakai_mobile` tree** and wrongly described the real app as "a 4-file offline spike." Its dramatic conclusions (a dead mic button, an orphaned `VidyaFab`, a `ChatScreen` decoy, `lib/src/*` duplication) describe the **abandoned** app, **not** the shipping one. That doc is being **regenerated pinned to the real app**; until then, do not act on it.

**`PARITY_MATRIX.md`** did not generate (the synthesis agent stalled mid-stream) and is being produced separately.

## What IS verified against the real app

- **The central finding — `VOICE_FIRST_GAP.md` — is correct and independently re-verified in the real app's code.** In `lib/features/lesson_planner/presentation/lesson_plan_screen.dart`, `initState()` calls `_applyPrefill(widget.prefill)` (:61) but `_submit()` is bound only to the Generate button (:151); a repo-wide grep for `autoSubmit`/`autoRun` returns nothing. The voice pipe (hands-free capture, 11-language STT, intent classification, TTS speak-back) is fully built and at web parity — it stops one step short: after voice pre-fills a tool form, it waits for a finger to tap **Generate**, where the web auto-runs. The missing verb is **RUN**.
- **`REMEDIATION_PLAN.md`** is written against the real app's architecture and its Phase P0 (thread `autoSubmit` + guarded auto-run in each tool's `initState`) is the correct, highest-impact fix. Note: the plan's own §0.2 flags the path/tree ambiguity — the `lib/features/*` paths it uses are the real app's; ignore its `sahayakai_mobile` mapping aside.
- **Video Storyteller** on the real app is a YouTube-recommendation engine, not a video generator (verified in `video_storyteller_dtos.dart`). Whether the web app has a distinct video-*generation* capability needs founder clarification of what "video capability" means.

## Authoritative reading order

1. **`VOICE_FIRST_GAP.md`** — the root cause and the fix, verified. Start here.
2. **`REMEDIATION_PLAN.md`** — the phased plan (voice-first first).
3. `BUG_FORENSICS.md`, `PAGE_INVENTORY.md` — spot-check that each cited path is a `lib/features/*` path (the real app); a `lib/src/*` path means that finding leaked from the stale tree.
4. `CAPABILITY_CENSUS.md`, `PARITY_MATRIX.md` — **pending regeneration** against the real app.
