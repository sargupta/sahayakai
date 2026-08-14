# Implementation Ledger — 2026-08 delivery-system rebuild

Tracking ledger for the gated delivery-system rebuild (three pipelines,
trunk-based `main`, UAT tier, release automation). One row per task;
tranche rows below are pre-filled from the approved plan and split into
finer-grained task rows as lanes open.

**State machine:** `todo → building → review → merged → verified`.
A row is `verified` only with evidence linked (CI run, `uat/verified`
status, screenshot, or command output) — merged is not done.

| Task | Tranche | State | PR | Review verdicts | Evidence |
|---|---|---|---|---|---|
| T1 — Docs + laws + drift: BRANCHING v2 (three pipelines), BRANCH_STRATEGY stub, PREVIEW_ENV → UAT_ENV, DEPLOY.md rewrite, standing laws (adopt-on-touch, founder-bug → class-gate) + PR-template class-gate line, `--chart-1`/`shadow-glow` token-drift fix, FieldRow/PageCTA removal | T1 | review | (this PR) | | tsc --noEmit green; zero-consumer grep in PR description |
| T2 — UAT pipeline: `cloudbuild-uat.yaml` (main push → build → no-traffic deploy → smoke → flip), `uat-verify.yml` (Playwright e2e + visual + k6 → commit status `uat/verified`), retire `sahayakai-main-deploy` prod trigger | T2 | todo | | | |
| T3 — Release pipeline: `cloudbuild-release.yaml` (two regions, no-traffic), `release-promote.yml` (auto traffic flip + LB-smoke auto-rollback), `scripts/release/cut-release.sh` + `scripts/release/promote-release.sh` manual path | T3 | todo | | | |
| T4 — Enforcement: land Gate 9 (i18n keys ratchet) + Gate 12 (firestore index drift); verify live check contexts on a real PR, then apply the `main-protection` and `release-protection` rulesets from docs/BRANCHING.md | T4 | todo | | | |
| T5 — Environment split + adoption: Cloud Build substitutions `_DEPLOY_PROJECT`/`_FB_*`, DEMO_MODE retirement → `COMMUNITY_CHAT_COLLECTION`, UAT data isolation; land `src/lib/attendance/reconcile-call-status.ts` and begin adopt-on-touch migrations | T5 | todo | | | |

## Conventions

- **PR** — link once opened; one task may span several PRs (list all).
- **Review verdicts** — reviewer + verdict per pass (e.g. `codex: pass`,
  `gemini: 2 findings fixed`). Founder sign-off noted explicitly.
- **Evidence** — the artifact that proves `verified`: CI run URL,
  `uat/verified` commit status, `gh api` output for rulesets, audit
  script output, etc.
- Tranche summaries T2–T5 are one-line restatements of the approved
  plan; reconcile against the plan doc before opening each lane.
