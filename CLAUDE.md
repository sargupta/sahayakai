# SahayakAI — repo instructions for Claude Code

App code lives in `sahayakai-main/` (paths below are relative to it unless
prefixed). Branching/release policy: `sahayakai-main/docs/BRANCHING.md`.
Repo map and legacy instructions: `gemini.md`.

## Standing laws (2026-08)

These are repo-wide, permanent rules. They apply to every PR regardless of
author (human or agent).

1. **Adopt-on-touch.** Touching a surface obligates the PR to migrate that
   surface to the current standard — no "out of scope" exemptions:
   - Any PR touching a file with an **inline multi-language dictionary**
     (a `Record<lang, string>`-style object embedded in a component or
     flow) must migrate that dictionary to `src/locales/*.json`.
   - Any PR touching a page containing **raw Tailwind palette classes**
     (e.g. `orange-500`, `bg-amber-100`, raw hex) must tokenize that page
     per `docs/DESIGN_TOKENS.md`.
   - Any PR touching **call-status consumers** must read call status via
     the reconciled reader (`src/lib/attendance/reconcile-call-status.ts`
     once it lands) — never re-derive status from raw provider fields.

2. **Founder-bug → class-gate.** Every founder-reported bug fix must ship
   with a test or CI gate that detects the **class** of bug, not just the
   instance. "Fixed the typo" is not done; "added the gate that catches
   any future typo of this kind" is done. State the gate explicitly in
   the PR description (the PR template has a "Class gate" checkbox).
