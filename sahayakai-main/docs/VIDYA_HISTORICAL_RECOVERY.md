# VIDYA — historical recovery audit (2026-10-31)

Scope: find every VIDYA implementation in Git history, compare it with today's app, and recover
what never reached `develop`. Repository `sargupta/sahayakai` (remote `origin`; `intern` =
`sargvision-ai/sahayakai-intern-workspace`). Working tree: `riya-wt/sahayakai-main`, branch
`feat/sampark-google-calendar-vidya-callbacks` at `ce3bd9a4` (= `origin/develop`).

## 1. What the history contains

VIDYA has always been the **teacher's** assistant. Its system prompt (`src/ai/soul.ts`) says
"VIDYA can trigger SahayakAI tools on behalf of the teacher" and "Empowering teachers…". No commit,
branch, PR, stash or file in the history implements a student-facing VIDYA, a student dashboard,
or a multi-stage student learning flow. Searched: all 124 branches and both stashes, commit
messages (`student mode/app/portal/dashboard/companion`, `learner`, `tutor`, `socratic`,
`learning stage`, `practice mode`, `study`), and every file path ever added
(`student-*`, `learner`, `tutor`, `stage(s).ts[x]`). The only hit was the teacher-side Difficulty
Level Selector (`4ae350f7`, 2025-12-08).

The VIDYA work that exists, by era:

| Work | Commits | In `develop`? |
|---|---|---|
| Floating draggable orb, "v3" screens 01–16 (orb intro, deliver tray, minimise to orb, remedial prompt on scans, left-hand toggle) | PR #145: `bb1e3d8d`, `86d05f08`, `6399f384`, `80181ae3`, `9d07b57a`, `5e3112bf`, `65bb2555` | yes |
| VIDYA Live voice on the sidecar Vertex proxy | PR #123: `073921ca`, `829b7866` | yes |
| Multilingual: reply in the UI language, native-script STT | `aa1ae4eb`, `f2616a93`, i18n waves `82a3e741` | yes |
| Context-aware VIDYA + Library Conversations vs Generations | `2558dadb` (PR #158, merge `ad91b5ea`) | **no — recovered into the working tree on 2026-10-31** |
| Home greeting, WebGL orb, design-system colours | `2189950e`, `54e1ffaf`, `ce3bd9a4` | yes |
| Flutter VIDYA (voice-first state machine, Ledger home) | `d323aa0f`, `2b180900`, … (`sahayakai-flutter/`) | Flutter app only |

Authors: Alyssa's commits are under `Alyssa <alyssa@example.com>` and `<alyssal282006@gmail.com>`
(gh login `Alyssa-286`); `2558dadb` is hers.

## 2. Recovery inventory

| Feature | Historical commit | Original files | Current status | Action |
|---|---|---|---|---|
| VIDYA GUI (floating orb, presence) | `bb1e3d8d`, `2558dadb` | `components/omni-orb.tsx`, `components/vidya/vidya-presence.tsx`, `vidya-live-orb.tsx` | orb in develop; presence/live orb recovered | preserved; current WebGL sphere kept |
| Student experience | none found | — | never existed | not built (no source to recover) |
| Multilingual responses | `aa1ae4eb`, `f2616a93` | `api/assistant/route.ts`, `omni-orb.tsx` (`uiLanguage`) | present | cache key now includes language (fix + test) |
| Multistage learning | none found | — | never existed | not built |
| Voice interaction | `073921ca`, `2558dadb` | `microphone-input.tsx`, `lib/vidya-live/*`, `public/worklets/*` | turn-based voice present; Live recovered behind `NEXT_PUBLIC_VIDYA_LIVE_VOICE` | needs the sidecar to switch on |
| Conversation history | `2558dadb` | `store/jarvisStore.ts` (`bindOwner`), `users/{uid}/vidya_sessions`, `library/conversation-list.tsx` | recovered | preserved |
| Page/app context + guarded actions | `2558dadb` | `lib/vidya/app-context-*`, `app-manifest.ts`, `run-app-action.ts`, `hooks/use-vidya-app-context.ts` | recovered | preserved |

## 3. How the recovery was integrated (2026-10-31)

`2558dadb` was three-way merged per file (`git merge-file`, base `b25a4891`) into the uncommitted
working tree, so earlier sessions' uncommitted work was neither committed nor overwritten. A
patch of that work was saved first. Conflicts (18 files) were resolved in favour of the current
design: fonts and theme tokens (`layout.tsx`, `tailwind.config.ts`, `globals.css`), the current
home page (`dashboard-home.tsx`) and WebGL orb; behaviour from `2558dadb` was kept (VIDYA props
in `microphone-input.tsx`, `VidyaLiveProvider` in `app-shell.tsx`, the public voice route in
`middleware.ts`, 22 new keys in each of 10 locale files).

## 4. Verification (2026-10-31, local stack)

- Typecheck 0 errors; lint on changed files 0 errors; design-token gate at budget (744).
- Focused Jest: 66 suites / 879 tests pass (VIDYA, Library, Riya, Labs, assistant route).
- Live `/api/assistant`, same question, `uiLanguage` en / hi / kn / ta / bn, twice each: all 10
  replies in the requested script (2–12 s).
- Page awareness: on `/attendance` and `/teacher-training` VIDYA names the page and what it offers.

## 5. Remaining gaps

- English is not held strictly: one English reply came back as Hinglish in Latin script.
- Live voice (Gemini Live) is off locally; it needs the `sahayakai-agents` voice sidecar and the flag.
- Microphone and the signed-in home page were not exercised by automation (the test browser
  cannot sign in with Google).
- A student-facing VIDYA would be new product work: there is nothing in the history to restore.
