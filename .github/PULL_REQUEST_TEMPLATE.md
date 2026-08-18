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
- [ ] Class gate: this change includes a test/gate that catches the whole class of this bug (required for founder-reported bugs)
- [ ] UAT smoke test:
  - <!-- UAT URL + key checks. Merging to main auto-deploys the UAT tier (cloudbuild-uat.yaml) and runs uat-verify.yml; verify there before cutting a release. See docs/UAT_ENV.md. -->

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

<!-- Human co-authors only, if any. No AI attribution in commits or PRs
     (standing rule). -->
