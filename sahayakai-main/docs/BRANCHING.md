# Branching, release, and delivery standards (v2)

Canonical doc for how work flows from a branch into production. Supersedes
BRANCHING v1 (the `develop`-centred model) and the historical
`docs/BRANCH_STRATEGY.md` (now a stub).

> **`develop` retired 2026-08-12.** The repo is trunk-based: `main` is the
> only long-lived branch. The old `develop` → preview → `main` flow, its
> back-merge rules, and the `sahayakai-preview` staging tier are replaced by
> the three pipelines below. Historical references to `develop` in older
> docs/PRs describe the v1 world.

> ⚠ **CURRENT STATE (2026-08-14): this document describes the TARGET
> model — P2 and P3 are NOT live yet.** Today, a push to `main` fires the
> **LIVE `sahayakai-main-deploy` Cloud Build trigger**, which runs
> `cloudbuild.yaml` and builds a **prod** revision at `--no-traffic`
> (traffic flip stays manual). Nothing auto-deploys the UAT tier.
> `cloudbuild-uat.yaml`, `uat-verify.yml`, `cloudbuild-release.yaml`,
> `release-promote.yml`, and `scripts/release/*` do not exist yet — they
> land in Tranches 2–3. Activation is tracked in
> [docs/IMPLEMENTATION_LEDGER_2026-08.md](./IMPLEMENTATION_LEDGER_2026-08.md).

## Long-lived branches

| Branch | Role | Protection |
|---|---|---|
| `main` | Trunk. Every PR lands here. Every push feeds the UAT tier (Pipeline 2). | Ruleset `main-protection` (below) |
| `release/*` | **Ephemeral** release branches cut from `main`, deleted after the release lands. Only long-lived while a release is in flight. | Ruleset `release-protection` (below) |

There is no `develop`, no permanent staging branch, and no back-merge
ceremony. `main` is always releasable.

## Short-lived branches (naming canon)

All short-lived branches are **parented on `main`** and merged back to
`main` via PR.

| Prefix | Purpose | Branched from | Merged into | Max lifetime |
|---|---|---|---|---|
| `feature/<kebab>` | new user-visible feature | `main` | `main` | 7 days (else rebase) |
| `fix/<kebab>` | bug fix that isn't urgent | `main` | `main` | 3 days |
| `hotfix/<kebab>` | emergency prod fix | released tag (see hotfix procedure) | `main` (+ cherry-pick to active `release/*`) | 24 h |
| `chore/<kebab>` | tooling, deps, config, CI | `main` | `main` | 3 days |
| `docs/<kebab>` | docs-only | `main` | `main` | 3 days |
| `refactor/<kebab>` | internal restructure, no behavior change | `main` | `main` | 7 days |
| `experiment/<kebab>` | exploration, may be discarded | `main` | `main` or delete | 14 days; ruthlessly pruned |
| `claude/*` | agent-generated work-in-progress | `main` | `main` after review | auto-delete on merge or at 14 days |
| `release/<calver>` | release branch | `main` (via `scripts/release/cut-release.sh`) | never merged; tagged + deleted after promote | until release lands |

`<kebab>` ≤ 40 chars, lowercase, hyphenated, descriptive.

## The three pipelines

| # | Pipeline | Trigger | What runs | Outcome |
|---|---|---|---|---|
| **P1** | **PR → `main`** | PR opened/updated against `main` | GitHub Actions gates: `test (20)`, `smoke`, Gates 1, 2, 5, 6, 8, 10, 11 — live today (see inventory below). Gates 9 and 12 are **pending** (ship with PR #113) and join only after producing check runs | Merge allowed only when required checks are green |
| **P2** | **`main` → UAT** | push to `main` | Cloud Build `cloudbuild-uat.yaml`: build → `--no-traffic` deploy to the UAT Cloud Run service → smoke → traffic flip. Then GitHub Actions `uat-verify.yml`: Playwright e2e + visual regression + k6 load probe → posts commit status **`uat/verified`** on the `main` SHA | Every `main` commit is exercised on a live tier; `uat/verified` marks release-candidate SHAs |
| **P3** | **`release/*` → prod** | push of a `release/*` branch | Cloud Build `cloudbuild-release.yaml`: builds and deploys **both regions** (Mumbai `asia-south1` + Singapore `asia-southeast1`) with `--no-traffic`. Then `release-promote.yml`: auto traffic flip with load-balancer smoke check and **auto-rollback** on failure. Manual path: `scripts/release/promote-release.sh` | Prod revision live in both regions, or automatically rolled back |

Notes:

- P2's UAT tier is documented in [docs/UAT_ENV.md](./UAT_ENV.md)
  (formerly `PREVIEW_ENV.md`).
- P3 never deploys traffic-first; the flip is a separate, observable,
  reversible step whether automated or manual.
- `scripts/safe-deploy.sh` remains the **break-glass** manual deploy for
  Cloud Build outages only — never the routine path.

## Release procedure

1. **Pick a candidate**: a `main` SHA carrying the `uat/verified` commit
   status.
2. **Cut**: `bash scripts/release/cut-release.sh` — creates
   `release/<calver>` from that SHA and pushes it (fires P3 builds).
3. **Watch builds**: both regional Cloud Build jobs must go green with the
   new revisions at 0% traffic.
4. **Promote**:
   - *Auto*: `release-promote.yml` flips traffic and runs the LB smoke; on
     smoke failure it rolls traffic back automatically.
   - *Manual*: `bash scripts/release/promote-release.sh` (same
     flip + smoke + rollback logic, human-invoked).
5. **Tag**: `release-YYYY-MM-DD` (`.N` suffix for same-day repeats) on the
   released SHA; push the tag. Delete the `release/*` branch.

CalVer stays: tags are `release-YYYY-MM-DD`, `hotfix-YYYY-MM-DD`,
`prod-YYYY-MM-DD-pre-<event>`, `milestone-<name>`. Tags are immutable;
every prod deploy corresponds to a tag.

## Hotfix procedure

1. **Branch from the released tag** (not `main`, which may have moved):
   `git checkout -b hotfix/<kebab> release-YYYY-MM-DD`.
2. **Fix + test**: `npm run predeploy` must pass.
3. **PR to `main`** — all P1 gates apply (hotfixes get no gate exemption).
4. **Ship to prod** by either:
   - **cherry-picking** the fix onto the active `release/*` branch (P3
     rebuilds + promotes), or
   - **cutting a fresh release** from `main` once the PR lands (preferred
     when no release is in flight).
5. **Break-glass**: if Cloud Build itself is down, `scripts/safe-deploy.sh`
   from the hotfix branch, then reconcile with a real release ASAP.
6. **Tag** `hotfix-YYYY-MM-DD`; post-mortem entry in `docs/INCIDENTS.md`.

Hotfix discipline: small. > 50 LOC or > 3 files means it is a feature being
rushed — do it through the normal P1 → P2 → P3 flow.

## Branch protection (rulesets)

Protection is applied as **repository rulesets** (Settings → Rules →
Rulesets, or `gh api /repos/sargupta/sahayakai/rulesets`).

> **WARNING — verify contexts before applying.** Required-check context
> strings must match the live check-run names **exactly** (including case,
> spacing, and matrix suffixes like `(20)`). Before applying either
> ruleset, open a recent PR → Checks tab (or
> `gh pr checks <n>`) and confirm every context below appears verbatim.
> Gates that have not landed yet (9 and 12, shipping with PR #113) are
> **deliberately excluded** from the main-protection JSON below — they
> live in a separate addendum fragment and may be added only **after**
> they have produced at least one check run. A required context that
> never reports blocks every merge forever.

### `main` ruleset

```json
{
  "name": "main-protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["refs/heads/main"], "exclude": [] }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 0,
        "dismiss_stale_reviews_on_push": false,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": false
      }
    },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "test (20)" },
          { "context": "smoke" },
          { "context": "Gate 1: block --no-verify commits" },
          { "context": "Gate 2: schema drift" },
          { "context": "Gate 5: no console.log in changed files" },
          { "context": "Gate 6: typecheck" },
          { "context": "Gate 8: test CI scripts" },
          { "context": "Gate 10: no new files in src/app/actions" },
          { "context": "Gate 11: design tokens (changed files)" }
        ]
      }
    }
  ]
}
```

The JSON above contains **only checks that are live today** — applying it
as-is cannot freeze `main`.

#### Addendum — add ONLY after Gates 9/12 have produced check runs on a real PR

Gates 9 and 12 ship with PR #113. After that PR is merged **and** both
gates have reported at least one check run on a real PR (verify via
`gh pr checks <n>`), append these two entries to the
`required_status_checks` array above and re-apply the ruleset
(`gh api --method PUT /repos/sargupta/sahayakai/rulesets/<id> ...`):

```json
          { "context": "Gate 9: i18n keys (ratchet)" },
          { "context": "Gate 12: firestore index drift" }
```

Do **not** include them in the initial apply — a required context that
never reports blocks every merge forever.

### `release/*` ruleset

Release branches are cut from an already-fully-gated `main` SHA, so they
carry only the fast recompile-safety checks:

```json
{
  "name": "release-protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": { "include": ["refs/heads/release/*"], "exclude": [] }
  },
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": false,
        "required_status_checks": [
          { "context": "test (20)" },
          { "context": "Gate 6: typecheck" },
          { "context": "smoke" }
        ]
      }
    }
  ]
}
```

### Apply / rollback

```bash
# Apply (returns the ruleset id)
gh api --method POST /repos/sargupta/sahayakai/rulesets --input main-ruleset.json
gh api --method POST /repos/sargupta/sahayakai/rulesets --input release-ruleset.json

# List ids
gh api /repos/sargupta/sahayakai/rulesets --jq '.[] | {id, name, enforcement}'

# Soft-disable (keep the ruleset, stop enforcing — evaluations still logged)
gh api --method PUT /repos/sargupta/sahayakai/rulesets/<id> -f enforcement=evaluate

# Hard rollback (delete the ruleset entirely)
gh api --method DELETE /repos/sargupta/sahayakai/rulesets/<id>
```

## Required-check inventory

Literal context strings as GitHub reports them. **Path-filtered or
conditional checks must NOT be required** — a required context that
doesn't trigger for a given PR never reports, and the merge blocks
forever.

| Context (literal) | Workflow / job | Required on `main`? | Notes |
|---|---|---|---|
| `test (20)` | `test.yml` → job `test`, node matrix `[20]` | **Yes** | Full unit + integration suite, typecheck, lint, build, bundle budget |
| `smoke` | `e2e-smoke.yml` → job `smoke` | **Yes** | Public-route Playwright @smoke suite |
| `Gate 1: block --no-verify commits` | `quality-gates.yml` → `no-verify-bypass` | **Yes** | |
| `Gate 2: schema drift` | `quality-gates.yml` → `schema-drift` | **Yes** | |
| `Gate 3: Cloud Run service.yaml drift` | `quality-gates.yml` → `service-yaml-drift` | **No — never** | `workflow_dispatch`-only (`run_live_checks`); would never report on PRs |
| `Gate 4: post-deploy smoke` | `quality-gates.yml` → `post-deploy-smoke` | **No — never** | `workflow_dispatch`-only; same reason |
| `Gate 5: no console.log in changed files` | `quality-gates.yml` → `no-console-log` | **Yes** | Ratchet — changed files only |
| `Gate 6: typecheck` | `quality-gates.yml` → `typecheck` | **Yes** | |
| `Gate 7: AppCheck env (warn-only)` | `quality-gates.yml` → `appcheck-env` | **No** | Warn-only by design |
| `Gate 8: test CI scripts` | `quality-gates.yml` → `test-ci-scripts` | **Yes** | Jest over `scripts/ci/*` tests |
| `Gate 9: i18n keys (ratchet)` | `quality-gates.yml` (ships with PR #113) | **Not yet** — add via the addendum fragment after first check run | See WARNING above |
| `Gate 10: no new files in src/app/actions` | `quality-gates.yml` → `no-new-server-actions` | **Yes** | `pull_request` events only — fine, since the ruleset gates PRs |
| `Gate 11: design tokens (changed files)` | `quality-gates.yml` → `design-tokens` | **Yes** | Ratchet — changed files only |
| `Gate 12: firestore index drift` | `quality-gates.yml` (ships with PR #113) | **Not yet** — add via the addendum fragment after first check run | See WARNING above |
| `pytest (blocking gate)` | `ci-agents.yml` → job `test` | **No — never** | **Path-filtered** (`sahayakai-agents/**`, generated sidecar types); PRs not touching those paths would block forever |
| `evaluate` | `genkit-eval.yml` → job `evaluate` | **No — never** | **Path-filtered** (`src/ai/**`, `scripts/eval/**`); same failure mode |

## Commit messages (Conventional Commits)

Unchanged from v1:

```
<type>(<scope>): <subject>
```

- **Types**: `feat | fix | chore | docs | refactor | test | perf | build | ci | revert | merge`
- **Scope**: short lowercase noun (`vidya | tts | exam-paper | community | deploy | ...`).
- **Subject**: imperative, lowercase, ≤72 chars, no trailing period.
- Footers: `Closes #<n>`, `Refs #<n>`, `BREAKING CHANGE: <what>`.

## Merge strategy

| Direction | Strategy |
|---|---|
| any short-lived branch → `main` | **squash merge** (one logical change; linear, bisect-able trunk) |
| `release/*` | never merged back — tagged and deleted |
| hotfix cherry-pick → `release/*` | `git cherry-pick -x` (traceable to the `main` commit) |

## What this model will prevent (once T2/T3 land)

- "We shipped to prod by accident" — prod only moves via a `release/*`
  branch through P3; `main` pushes stop at UAT.
- "We don't know what's in prod" — prod = the last `release-*` tag,
  full stop.
- "It worked on my machine" — every `main` SHA runs on a live UAT tier
  and only `uat/verified` SHAs become release candidates.
- "The hotfix got reverted by the next release" — hotfixes land on `main`
  via PR first; there is no divergent branch to forget to back-merge.
- "A required check never ran and the PR is stuck" — the inventory above
  marks path-filtered checks as never-required.

See also:
- [DEPLOY.md](../DEPLOY.md) — operator runbook (three-pipeline edition)
- [docs/UAT_ENV.md](./UAT_ENV.md) — UAT tier
- [docs/ROLLBACK.md](./ROLLBACK.md) — rollback procedure
- [docs/INCIDENTS.md](./INCIDENTS.md) — incident log
- [docs/FEATURE_FLAGS.md](./FEATURE_FLAGS.md) — flag inventory
- [docs/IMPLEMENTATION_LEDGER_2026-08.md](./IMPLEMENTATION_LEDGER_2026-08.md) — 2026-08 delivery-rebuild tranche ledger
