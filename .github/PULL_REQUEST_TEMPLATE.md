<!--
PR Template — see docs/BRANCHING.md for the full workflow.

Every PR should match this template. Skip sections that don't apply,
but be explicit (`N/A`) rather than leaving them blank.
-->

## Summary

<!-- 1–3 sentences: what + why. Skip the "what" if it duplicates the diff. -->

## Scope

- **Files**: <!-- main directories / surfaces touched -->
- **User-facing surfaces**: <!-- pages / API routes / flows affected, OR "none" -->

## Risk

- [ ] **LOW** — pure bug fix, no schema change, no new API
- [ ] **MEDIUM** — feature add, no schema change
- [ ] **HIGH** — schema change / new API / model migration / one-way door

<!-- For MEDIUM/HIGH, briefly explain the risk and what catches it. -->

## Feature flag

- [ ] N/A — not flag-gated
- [ ] Behind flag: `feature_<key>` (default: <on|off>) — documented in `docs/FEATURE_FLAGS.md`
- [ ] New flag introduced (see `docs/FEATURE_FLAGS.md`)

## Test plan

- [ ] `npm run predeploy` passes locally (typecheck + build)
- [ ] Pre-commit hooks pass
- [ ] Manual:
  - <!-- steps to verify locally / on preview -->
- [ ] Automated tests added/updated:
  - <!-- list new tests or "no test coverage delta" -->
- [ ] Preview smoke test:
  - <!-- preview URL + key checks. For develop → preview PRs, preview is auto-built. For develop → main PRs, validate on preview first. -->

## Cost impact

- [ ] No new AI calls
- [ ] New AI calls: <!-- model, est. $/call, expected volume/month -->
- [ ] Schema change: <!-- read/write volume delta on Firestore, if any -->

## Rollback

- [ ] `git revert -m 1 <merge-sha>` is sufficient
- [ ] Feature flag flip is sufficient (`feature_<key>=false`)
- [ ] Requires Firestore migration / manual data cleanup to roll back (explain):
  <!-- if so, document the migration steps -->

## Co-authors

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
