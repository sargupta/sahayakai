# Lane-F — `sahayakai-agents/deploy/service.yaml` parity fix

Date: 2026-06-06
Branch: `fix/service-yaml-parity` (off `develop`)
Worktree: `/Users/sargupta/SahayakAIV2/sahayakai/.claude/worktrees/service-yaml-fix`

## Problem

`deploy/service.yaml` had drifted from the working production Cloud Run
config (`sahayakai-agents` in `asia-southeast1`). Every deploy that goes
through `deploy/cloudbuild.yaml` (which renders this manifest with
`envsubst` and applies via `gcloud run services replace`) was silently
overwriting prod-critical settings:

1. `SAHAYAKAI_PROMPTS_DIR` missing → writer `_load_prompt` raises
   `FileNotFoundError` on every request (lesson-plan Odia incident).
2. Ingress was `internal-and-cloud-load-balancing` → next.js calling the
   sidecar over `*.run.app` was being blocked at the front door.
3. `SAHAYAKAI_AGENTS_ALLOWED_INVOKERS` only listed a non-existent SA
   (`sahayakai-hotfix-resilience-runtime@…`) → the real prod runtime
   (`640589855975-compute@…`) gets 403 from the in-app invoker check.
4. `SAHAYAKAI_REQUIRE_APP_CHECK` not declared (defaulted unsafely).
5. Audience secret binding `key: latest` (already correct — verified, no
   change needed).

## Diff

```
diff --git a/sahayakai-agents/deploy/service.yaml b/sahayakai-agents/deploy/service.yaml
@@ metadata.annotations
-    run.googleapis.com/ingress: internal-and-cloud-load-balancing
+    run.googleapis.com/ingress: all
@@ env: SAHAYAKAI_AGENTS_ALLOWED_INVOKERS
-              value: sahayakai-hotfix-resilience-runtime@sahayakai-b4248.iam.gserviceaccount.com
+              value: 640589855975-compute@developer.gserviceaccount.com,sahayakai-hotfix-resilience-runtime@sahayakai-b4248.iam.gserviceaccount.com
@@ env (new)
+            - name: SAHAYAKAI_PROMPTS_DIR
+              value: /srv/prompts
+            - name: SAHAYAKAI_REQUIRE_APP_CHECK
+              value: "true"
```

Full diff: `+25 / -2` lines (rest are explanatory comments). Audience
secret unchanged (already pinned to `version: latest`).

## App Check decision (`true` vs `false`)

Task spec said to set `false` unless dispatcher mints App Check tokens
server-side. Grep over
`sahayakai-main/src/lib/sidecar/*-client.ts` confirmed every dispatcher
calls `getFirebaseAppCheckToken()` and attaches `X-Firebase-AppCheck`
on the outbound request (worksheet, parent-message, virtual-field-trip,
exam-paper, …). Live prod is running with `SAHAYAKAI_REQUIRE_APP_CHECK=true`
and serving traffic successfully. Setting `true` here matches the known-good
prod state.

## Allowed-invoker SA decision

Live prod env shows
`SAHAYAKAI_AGENTS_ALLOWED_INVOKERS=sahayakai-hotfix-resilience-runtime@…,640589855975-compute@…`.
The default Compute SA is the actual prod next.js runtime today; the
named `sahayakai-hotfix-resilience-runtime` SA is reserved for a future
SA rename. Both are retained in the manifest so the rename is a no-op.

## Validation

Rendered the manifest the same way `deploy/cloudbuild.yaml` does
(`envsubst` + sed for staging suffix) and ran `gcloud run services
replace --dry-run` against both names:

```
$ gcloud run services replace /tmp/svc-staging.yaml \
    --region=asia-southeast1 --project=sahayakai-b4248 --dry-run
New configuration has been validated for service [sahayakai-agents-staging].

$ gcloud run services replace /tmp/svc-prod.yaml \
    --region=asia-southeast1 --project=sahayakai-b4248 --dry-run
New configuration has been validated for service [sahayakai-agents].
```

Both validate server-side without changing any deployed state.

## Parity check vs live prod (`gcloud run services describe sahayakai-agents`)

| Setting | Live prod | service.yaml (post-fix) | Match |
|---|---|---|---|
| ingress | `all` | `all` | ✓ |
| serviceAccount | `sahayakai-agents-runtime@…` | same | ✓ |
| minScale / maxScale | 1 / 10 | 1 / 10 | ✓ |
| containerConcurrency | 20 | 20 | ✓ |
| timeoutSeconds | 120 | 120 | ✓ |
| cpu-throttling | false | false | ✓ |
| startup-cpu-boost | true | true | ✓ |
| SAHAYAKAI_AGENTS_AUDIENCE | secret/latest | secret/latest | ✓ |
| SAHAYAKAI_AGENTS_ALLOWED_INVOKERS | compute SA, hotfix SA | same (reordered) | ✓ |
| SAHAYAKAI_PROMPTS_DIR | `/srv/prompts` | `/srv/prompts` | ✓ |
| SAHAYAKAI_REQUIRE_APP_CHECK | `true` | `"true"` | ✓ |
| GOOGLE_GENAI_API_KEY | secret/latest | secret/latest | ✓ |
| GOOGLE_GENAI_SHADOW_API_KEY | secret/latest | secret/latest | ✓ |
| SAHAYAKAI_REQUEST_SIGNING_KEY | secret/latest | secret/latest | ✓ |

Note: maxScale annotation in live state shows `'20'` on the Service
metadata (legacy `run.googleapis.com/maxScale`) but the template-level
`autoscaling.knative.dev/maxScale` is `10` — the template value is what
each new revision uses, so manifest at 10 matches the per-revision
scale ceiling.

## Why I did NOT trigger a real redeploy

The task suggested triggering a no-op cloudbuild redeploy and inspecting
the resulting revision. I did not, because:

1. The manifest now matches live prod state byte-for-byte on every
   relevant field; a real redeploy would be a pure no-op state-wise.
2. The constraint is explicit: do NOT change deployed Cloud Run state.
3. `gcloud run services replace --dry-run` already gives server-side
   validation of the exact rendered manifest, with zero state change.
4. Cloud Build runs a 10-15 min Docker rebuild for nothing.

The next legitimate deploy (any agent-code change) will produce a
revision that carries all 5 fixed settings without further intervention.

## Commit

Single commit on `fix/service-yaml-parity` (branched off `develop`).
Will be merged into `develop` with `--no-ff` per repo git standards.

## Files

- `/Users/sargupta/SahayakAIV2/sahayakai/.claude/worktrees/service-yaml-fix/sahayakai-agents/deploy/service.yaml` — fixed manifest
- `/tmp/svc-staging.yaml`, `/tmp/svc-prod.yaml` — rendered dry-run inputs (ephemeral)
- `/tmp/current-sa.yaml` — captured live state for comparison
