# Q3D — CI Quality Gates

Date: 2026-06-06
Branch: `chore/q3d-ci-gates-final` (off `develop`)
Owner: Abhishek Gupta

## Why

On 2026-06-06 we shipped a stack of fixes while repeatedly using
`--no-verify` to work around pre-commit failures. The patterns:

1. TS errors in unrelated files → bypass.
2. Schema drift between Genkit (Zod) and the Python sidecar (Pydantic).
3. service.yaml fields silently regressed when re-deployed.
4. Dispatcher fell back to `genkit_fallback` when sidecar 5xx'd.
5. AppCheck was disabled on sidecar revisions and stayed that way.

Q3D adds eight CI gates that mechanically refuse to merge any of those
shortcuts again.

## Files added

| Path | Purpose |
|---|---|
| `.github/workflows/quality-gates.yml` | 8-gate workflow (PR + push + manual) |
| `scripts/ci/check-no-verify-bypass.mjs` | Scans PR commit msgs for `--no-verify` / `[skip hooks]` |
| `scripts/ci/check-schema-drift.mjs` | Counts constraints fresh vs committed; fails if drift > 10 / agent |
| `scripts/ci/check-service-yaml-drift.sh` | `gcloud run services describe` vs lane-F SERVICE_YAML_VERIFY.md |
| `scripts/ci/post-deploy-smoke.mjs` | Probes `/api/health` + one bucket-0 canary per agent |
| `scripts/ci/check-appcheck-env.sh` | Reads `SAHAYAKAI_REQUIRE_APP_CHECK` on both sidecars (warn-only today) |
| `src/__tests__/scripts/ci-no-verify-check.test.ts` | Jest tests (6 cases) for no-verify + drift checkers |

No new runtime deps. Tests use built-in `node:child_process` + `node:fs`.

## The eight gates

1. **`no-verify-bypass`** (PR only) — `git log $BASE..$HEAD` and reject if any
   commit body / trailer matches `/--no-verify/i` or `/skip[-\s]?hooks/i`.
2. **`schema-drift`** — dumps fresh Zod + Pydantic schemas, compares against
   committed baselines, fails if constraint count drifts by > 10 / agent.
3. **`service-yaml-drift`** (manual / live) — `gcloud run services describe` on
   both sidecars, verifies critical keys (ingress, PROMPTS_DIR, concurrency,
   timeout, runtime SA, 3 secrets, app-check env).
4. **`post-deploy-smoke`** (manual / live) — probes `/api/health` and one
   bucket-0 canary per dispatchable agent. Any
   `dispatcher.source !== 'sidecar'` → ALERT; with `STRICT=1` → exit 1.
5. **`no-console-log`** — `grep -rE 'console\.log\b' src` excluding
   `__tests__` / `__mocks__`. `console.warn` and `console.error` allowed.
6. **`typecheck`** — runs `npm run typecheck`. Required status check
   means PRs cannot merge with TS errors regardless of local bypasses.
7. **`appcheck-env`** (manual / live, warn-only) — reads
   `SAHAYAKAI_REQUIRE_APP_CHECK` from both sidecars. Today: WARN only.
   Flip workflow input to `MODE=strict` when D.1 fully lands.
8. **`test-ci-scripts`** — runs `jest src/__tests__/scripts/ci-no-verify-check.test.ts`.

## How to test

### Locally (no GCP creds needed)

```bash
cd sahayakai-main
node scripts/ci/check-no-verify-bypass.mjs <base-sha> HEAD       # gate 1
npx tsx scripts/dump-zod-schemas.mjs --out qa/baseline-schemas-fresh
python ../sahayakai-agents/scripts/dump-pydantic-schemas.py --out qa/sidecar-schemas-fresh
node scripts/ci/check-schema-drift.mjs --threshold=10             # gate 2
grep -rEn 'console\.log\b' src --include='*.ts' --include='*.tsx' \
  --exclude-dir='__tests__' --exclude-dir='__mocks__'             # gate 5
npm run typecheck                                                  # gate 6
npx jest src/__tests__/scripts/ci-no-verify-check.test.ts --coverage=false  # gate 8
```

### Locally (with GCP creds)

```bash
GCP_PROJECT=sahayakai-b4248 GCP_REGION=asia-southeast1 SERVICE=sahayakai-agents \
  bash scripts/ci/check-service-yaml-drift.sh                       # gate 3

APP_BASE_URL=https://sahayakai-hotfix-resilience-…run.app \
  APP_BEARER_TOKEN="$(firebase auth:print-id-token)" STRICT=1 \
  node scripts/ci/post-deploy-smoke.mjs                             # gate 4

GCP_PROJECT=sahayakai-b4248 GCP_REGION=asia-southeast1 MODE=warn \
  bash scripts/ci/check-appcheck-env.sh                             # gate 7
```

### On GitHub

- PRs to `develop` / `main` → gates 1, 2, 5, 6, 8 run automatically.
- Manual trigger with `run_live_checks=true` → also runs gates 3, 4, 7.
- One-time branch-protection setup: mark all eight checks as required
  on `develop` and `main`. That makes Gate 6 un-bypassable from the
  server side — local `--no-verify` no longer lets bad TS merge.

### Verified locally (this commit)

```text
$ node scripts/ci/check-no-verify-bypass.mjs $BASE HEAD   # clean
[no-verify-check] PASS — 1 commits clean.    EXIT=0

$ # add a commit "fix: yolo\n\nshipped via --no-verify"
$ node scripts/ci/check-no-verify-bypass.mjs $BASE HEAD
[no-verify-check] FAIL — commits reference pre-commit bypass:
  - fix: yolo
EXIT=1

$ node scripts/ci/check-schema-drift.mjs       # parity baseline
PASS: all agents within drift threshold.       EXIT=0

$ # mutate fresh schema → 80-constraint drift on lp.json
$ node scripts/ci/check-schema-drift.mjs --threshold=10
[zod-baseline] lp.json: committed=80 fresh=0 drift=80 FAIL
FAIL: 1 agent(s) exceeded drift threshold.     EXIT=1

$ npx jest src/__tests__/scripts/ci-no-verify-check.test.ts --coverage=false
Tests:       6 passed, 6 total
```

## Required GitHub secrets (for manual-trigger gates)

| Secret | Used by | Notes |
|---|---|---|
| `GCP_SA_READ_ONLY_KEY` | Gates 3, 7 | Service account with **read-only** `roles/run.viewer`. Do NOT reuse `GCP_SA_KEY` (deploy rights). |
| `SMOKE_APP_BASE_URL` | Gate 4 | e.g. `https://sahayakai-hotfix-resilience-…run.app` |
| `SMOKE_BEARER_TOKEN` | Gate 4 | Firebase ID token for a dedicated smoke-test user. Rotate weekly. |

## Workflow YAML — source of truth

`.github/workflows/quality-gates.yml` in this commit (188 lines). 8 jobs,
gated by `if:` conditions. Concurrency group cancels in-progress runs
on the same ref.

## Open follow-ups

- Flip `MODE=strict` on Gate 7 when D.1 ships everywhere.
- Verify `dump-pydantic-schemas.py` accepts `--out` (workflow has a `cp`
  fallback if not).
- Override `AGENT_ENDPOINT_TEMPLATE` env var on Gate 4 if the dispatcher
  endpoint path differs from `/api/ai/{agent}`.
- Not run via [`act`](https://github.com/nektos/act) — gates 3/4/7 need GCP
  creds. Gates 1, 2, 5, 6, 8 verified individually with the commands above.

## Branch / commit

- Branched from `origin/develop` as `chore/q3d-ci-gates-final`.
- Single commit. No `--no-verify` used.
- Merge with `--no-ff` back into `develop` once reviewed.
