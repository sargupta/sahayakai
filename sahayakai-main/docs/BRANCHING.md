# Branching, versioning, and release standards

This is the canonical doc for how work flows from a feature branch through `develop`, `sahayakai-preview`, `main`, and into production. It supersedes the older "Git Standards & Branching Rules" section of `gemini.md`.

## Long-lived branches

| Branch | Role | Receives merges from | Auto-deploys to | Protection |
|---|---|---|---|---|
| `main` | Production. Anything here is or has been live. | `develop` (release PRs only), `hotfix/*` (emergencies) | nothing automatic; `scripts/safe-deploy.sh` is the manual gate | strict: PR required, status checks, linear history, no force-push |
| `develop` | Integration / staging. Source of truth for `sahayakai-preview`. | `feature/*`, `fix/*`, `chore/*`, `docs/*`, back-merges from `hotfix/*` | `sahayakai-preview` Cloud Run (auto on push, once Cloud Build GitHub App is reinstalled — see [DEPLOY.md](../DEPLOY.md)) | moderate: PR required for > 50 LOC, no force-push |

`develop` should never lag `main` and never drift away on a multi-month tangent. After every `develop → main` merge, the two are identical; no back-merge from `main` to `develop` is needed.

## Short-lived branches (naming canon)

| Prefix | Purpose | Branched from | Merged into | Max lifetime |
|---|---|---|---|---|
| `feature/<kebab>` | new user-visible feature | `develop` | `develop` | 7 days (else rebase) |
| `fix/<kebab>` | bug fix that isn't urgent | `develop` | `develop` | 3 days |
| `hotfix/<kebab>` | emergency prod fix | `main` | `main` + back-merge to `develop` | 24 h |
| `chore/<kebab>` | tooling, deps, config, CI | `develop` | `develop` | 3 days |
| `docs/<kebab>` | docs-only | `develop` | `develop` | 3 days |
| `refactor/<kebab>` | internal restructure, no behavior change | `develop` | `develop` | 7 days |
| `experiment/<kebab>` | exploration, may be discarded | `develop` | `develop` or delete | 14 days; ruthlessly pruned |
| `claude/*` | Claude-Code-generated work-in-progress | varies | `develop` after manual review | auto-delete on merge or at 14 days |
| `release/<calver>` | release branch (if multi-step rollout needed) | `develop` | `main` | until release lands |

**Legacy aliases to retire** (still present on origin as of 2026-05-21, due for the next cleanup pass):
- `feat/*` → use `feature/*`
- `bugfix/*` → use `fix/*`
- `audit/*` → use `chore/*` if tooling, `docs/*` if a write-up
- `polish/*` → use `feature/*` or `fix/*` depending on whether it's visible

`<kebab>` ≤ 40 chars, lowercase, hyphenated, descriptive. Examples: `feature/community-personas-live-pulse`, `fix/vidya-prefill-sweep-7-forms`, `hotfix/intent-classifier-zod-const`.

## Branch lifecycle

1. **Open**: branch from `develop` (or `main` for hotfix). Push immediately so the work is visible.
2. **Maintain**: rebase against the parent branch at least every 3 days; merge conflicts caught early are cheap.
3. **Land**: open PR against parent. CI must be green. PR description matches `.github/PULL_REQUEST_TEMPLATE.md`.
4. **Close**: delete the remote branch immediately after merge. GitHub setting: "Automatically delete head branches" is ON.
5. **Stale cleanup**: a weekly `chore/branch-cleanup-YYYY-MM-DD` PR sweeps any merged-but-undeleted branch + any open branch with no commits in 30 days (after a 7-day warning ping to the author).

## Commit messages (Conventional Commits)

```
<type>(<scope>): <subject>

<body — explain WHY, not WHAT. Code shows what.>

<footer — refs, breaking changes, co-authors>
```

- **Types**: `feat | fix | chore | docs | refactor | test | perf | build | ci | revert | merge`
- **Scope**: short noun, lowercase. `vidya | tts | exam-paper | community | deploy | cost | auth | flag | intent | ...`. Avoid generic scopes (`general`, `misc`).
- **Subject**: imperative, lowercase, ≤72 chars, no trailing period. "fix mic permission re-prompt on iOS" — not "fixed the mic re-prompt issue".

Footer conventions:
- `Co-Authored-By: <name> <email>` — required when AI agents authored
- `Closes #<n>` — for issue/PR closure
- `Refs #<n>` — for references without closure
- `BREAKING CHANGE: <what>` — for incompatible changes (rare in this solo project)

## Merge strategy per direction

| Source → Target | Strategy | Rationale |
|---|---|---|
| `feature/*` → `develop` | **squash merge** | one logical change per merge; keeps `develop` linear and bisect-able |
| `fix/*` → `develop` | squash merge | same |
| `chore/*`, `docs/*`, `refactor/*` → `develop` | squash merge | same |
| `experiment/*` → `develop` | usually deleted, not merged; if merged, squash | exploration shouldn't pollute history |
| `develop` → `main` | **`--no-ff` merge** | preserves the per-feature history of the release on `main`'s graph |
| `hotfix/*` → `main` | `--no-ff` merge | hotfix is visible as its own subtree |
| `hotfix/*` → `develop` (back-merge) | `--no-ff` merge | same |
| Catch-up (one-off) | `--no-ff` merge | preserves the underlying commit history for `git blame` / `git bisect` |

**Never rebase-merge feature → develop.** Rebase merges replay each commit but never test them as a unit, which breaks bisect.

## Versioning — CalVer + git tags

CalVer (Calendar Versioning) because solo dev, no public API to break, releases are date-driven.

Tag format: `release-YYYY-MM-DD` (or `release-YYYY-MM-DD.N` if multiple releases same day).

| Tag | When | Format |
|---|---|---|
| `release-YYYY-MM-DD` | after a `develop → main` merge that goes to prod | `release-2026-05-21` |
| `hotfix-YYYY-MM-DD` | after a `hotfix/*` lands on main | `hotfix-2026-05-21` |
| `prod-YYYY-MM-DD-pre-<event>` | rollback fence before a risky push | `prod-2026-05-21-pre-catchup` |
| `milestone-<name>` | major capability milestone | `milestone-vidya-v2` |

Tags are immutable. Every prod deploy must correspond to a tag.

## CHANGELOG.md

Maintained at `sahayakai-main/CHANGELOG.md`. Format: [Keep a Changelog](https://keepachangelog.com/).

Updated as part of every `develop → main` PR (not per-feature-branch — too noisy). Sections per release: `Added | Changed | Fixed | Removed | Security`.

## PR template + CODEOWNERS

- `.github/PULL_REQUEST_TEMPLATE.md` renders automatically on every new PR.
- `.github/CODEOWNERS` auto-assigns reviewers based on the paths touched.

## Hotfix workflow

When prod breaks:

1. **Branch** from `main`: `git checkout main && git pull && git checkout -b hotfix/<short-name>`
2. **Fix + test locally**: `npm run predeploy` must pass.
3. **Deploy from hotfix branch**: `bash scripts/safe-deploy.sh` (the branch-aware logic recognizes `hotfix/*` as a prod deploy source).
4. **Flip traffic**: `gcloud run services update-traffic sahayakai-hotfix-resilience --region=asia-southeast1 --to-latest`.
5. **Smoke test**: `bash scripts/smoke-test.sh`.
6. **Merge to main**: PR `hotfix/<name> → main`, `--no-ff` merge.
7. **Back-merge to develop**: PR `main → develop` (or cherry-pick the hotfix commit), `--no-ff` merge. **Critical** — without this, the next `develop → main` release reverts the hotfix.
8. **Tag**: `git tag hotfix-YYYY-MM-DD && git push origin hotfix-YYYY-MM-DD`
9. **Post-mortem entry**: append to `docs/INCIDENTS.md`.

Hotfix discipline: hotfixes are **small**. If the fix needs > 50 LOC or touches > 3 files, it's probably not a hotfix — it's a feature being rushed under pressure. Push back, do it through `develop`.

## CI / CD pipeline summary

| Stage | What runs | Where |
|---|---|---|
| Pre-commit (local) | `tsc --noEmit` on staged files, i18n audit, `flutter analyze` if Flutter files staged | `scripts/hooks/pre-commit` |
| Push to `develop` | (once Cloud Build GitHub App is reinstalled) Cloud Build → deploy to `sahayakai-preview` | Cloud Build trigger `sahayakai-preview-deploy` |
| PR opened against `develop` | Test Suite (GitHub Actions, `test.yml`) | GitHub Actions |
| PR opened against `main` | Test Suite | GitHub Actions |
| Push to `main` | NOTHING auto-deploys (workflows `firebase-deploy.yml` and `google-cloudrun-docker.yml` are disabled). Manual `safe-deploy.sh` only. | — |
| Post manual prod deploy | `bash scripts/smoke-test.sh` against prod URL | local |

## Release cadence

- **Hotfixes**: as needed. Target time-to-fix ≤ 24 h.
- **Regular releases**: weekly bundle `develop → main → prod`. Default day: Tuesday. Skip if `develop` has nothing meaningful.
- **Major capability launches**: gate behind a feature flag (see `docs/FEATURE_FLAGS.md` once Phase C lands), ship to prod with flag OFF, flip ON for a controlled rollout.
- **NCERT / investor / partner demos**: never deploy < 24 h before a demo. Validate on preview; promote to prod after the demo only if the new code performed.

## Branch protection rules (final state)

GitHub Settings → Branches → Branch protection rules:

**`main`**:
- ☑ Require a pull request before merging
- ☑ Require approvals (1) — solo dev: self-approval allowed via bypass
- ☑ Dismiss stale approvals when new commits pushed
- ☑ Require status checks: `Test Suite` (`test (18)`, `test (20)`)
- ☑ Require branches to be up to date before merging
- ☑ Require linear history
- ☑ Do not allow bypassing the above settings (except for `@sargupta` for emergencies)
- ☐ Allow force-pushes — OFF
- ☐ Allow deletions — OFF

**`develop`**:
- ☑ Require a pull request for direct pushes > 50 LOC
- ☑ Require status checks: `Test Suite`
- ☐ Allow force-pushes — OFF (bypass for `@sargupta` only)
- ☐ Allow deletions — OFF

**Other branches**: no protection.

## Solo developer practices

- **Self-PR review**: own PRs still get reviewed (by self, using the PR template checklist as a forcing function).
- **Second-opinion review by Codex + Gemini** (per memory `feedback_peer_review_codex_gemini.md`): every shipped artifact gets a second pass. Mandatory for HIGH-risk PRs.
- **AI review agents**: use the `/review` skill for diff-level review before merge to develop; `/ultrareview` for develop → main PRs.

## What this model prevents

- "We shipped to prod by accident" — prod = manual `safe-deploy.sh` from main only; develop pushes can't touch prod.
- "We don't know what's in prod" — main commit hash = prod, full stop. `release-YYYY-MM-DD` tags mark each prod state.
- "We can't roll back" — every prod release has a tag. Roll back via Cloud Run revision promote OR `git revert <merge>` + redeploy.
- "Develop drifted six months from main" — weekly release cadence forces merges; CalVer tags make drift visible at a glance.
- "Branches pile up forever" — weekly cleanup PR + auto-delete on merge.

See also:
- [DEPLOY.md](../DEPLOY.md) — operator runbook
- [docs/PREVIEW_ENV.md](./PREVIEW_ENV.md) — preview environment
- [docs/ROLLBACK.md](./ROLLBACK.md) — rollback procedure
- [docs/INCIDENTS.md](./INCIDENTS.md) — incident log
- (future) [docs/FEATURE_FLAGS.md](./FEATURE_FLAGS.md) — flag inventory once Phase C lands
- [.claude/plans/based-on-the-current-tidy-rabbit.md](../.claude/plans/based-on-the-current-tidy-rabbit.md) — the workflow rationalization plan
