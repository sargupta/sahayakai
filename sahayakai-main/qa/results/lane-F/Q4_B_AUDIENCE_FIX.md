# Q4-B — Audience-secret drift fix (staging 401 cascade)

**Branch:** `fix/audience-secret-staging-drift` (off `develop`)
**Repo:** `sahayakai` monorepo, files under `sahayakai-agents/deploy/`
**Date:** 2026-06-06

## Problem

`sahayakai-agents/deploy/cloudbuild.yaml` deploys both:
- `sahayakai-agents` (prod) — secret-mounts `SAHAYAKAI_AGENTS_AUDIENCE` (= prod sidecar URL).
- `sahayakai-agents-staging` — was inheriting the same secret-mount.

Cascade:
1. Staging sidecar reads `SAHAYAKAI_AGENTS_AUDIENCE` = **prod URL** (because that's
   the only secret version).
2. Prod next.js dispatcher mints ID tokens with `aud` = value of
   `NEXT_PUBLIC_SAHAYAKAI_AGENTS_URL` (= **staging URL** in current canary config).
3. Staging sidecar's ID-token verifier compares `aud` claim against its
   `SAHAYAKAI_AGENTS_AUDIENCE` env (prod URL) and rejects → **401**.
4. Next.js dispatcher catches 401 and silently falls back to the Genkit path, so the
   user sees an answer but every sidecar shadow + canary cell registers as a miss.

A manual override was applied to staging rev `00033-2rg` (plain env var). The very
next pipeline deploy produced rev `00034-rfr` which reverted to the secret mount —
confirming the source-level fix was required.

## Root cause

`deploy/service.yaml` is the single source of truth and contains the prod
secret-mount. `cloudbuild.yaml` only applies `_STAGING_SUFFIX` to the metadata
name; it does NOT branch any env vars by environment. So staging always inherited
the prod secret reference.

## Fix

### `deploy/cloudbuild.yaml`
- Added substitution `_STAGING_AUDIENCE_URL` pinned to the staging Cloud Run URL
  (`https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app`).
- Extended the `render-staging-service` step: when `_STAGING_SUFFIX` is non-empty,
  a `sed` range-replace rewrites the 5-line `SAHAYAKAI_AGENTS_AUDIENCE`
  `secretKeyRef` block into a plain `value:` line. Two grep guards then assert
  the secret block is gone and the staging URL was injected; the build fails
  loud if either guard trips.
- Prod path (when `_STAGING_SUFFIX=""`) is untouched — the prod secret-mount is
  preserved bit-for-bit from `service.yaml`.

### `deploy/service.yaml`
- Comment on the `SAHAYAKAI_AGENTS_AUDIENCE` block now documents both the PROD
  (secret-mount) and STAGING (sed-rewrite) behaviour, with a warning that the
  block's indentation and `key: latest` literal must not change without updating
  the cloudbuild sed pattern.

## Local verification

Simulated the render step against the post-edit `service.yaml`:

```
$ IMAGE=... envsubst < service.yaml | sed metadata.name | sed staging-audience override
```

- `metadata.name` correctly rewritten to `sahayakai-agents-staging`.
- `SAHAYAKAI_AGENTS_AUDIENCE` block replaced with plain `value: "<staging URL>"`.
- No other `secretKeyRef` blocks affected (GOOGLE_GENAI_API_KEY,
  GOOGLE_GENAI_SHADOW_API_KEY, SAHAYAKAI_REQUEST_SIGNING_KEY all preserved).
- Guards: `name: SAHAYAKAI_AGENTS_AUDIENCE` at 20-space indent count = 0 (pass);
  `value: "<staging URL>"` present (pass).

## Cloud-side state at fix time

- Staging rev `00033-2rg` — plain env override (manual fix, not currently serving)
- Staging rev `00034-rfr` — current serving rev, has secretKeyRef back (proves drift)
- Prod service `sahayakai-agents` — secretKeyRef (correct for prod)
- Secret `SAHAYAKAI_AGENTS_AUDIENCE` latest version — holds prod URL

## Test deploy

Not executed in this turn (would require `gcloud builds submit` with side effects
on the live staging service). The fix is structural; the next pipeline-driven
deploy from `develop` or this branch will:
1. Run the render step
2. Hit the new staging override branch
3. Fail the build loud if the sed pattern is broken
4. Otherwise produce a staging rev with `SAHAYAKAI_AGENTS_AUDIENCE` = plain
   staging URL value

## Post-deploy probe (to be run after next pipeline deploy)

```
gcloud run revisions describe <new-staging-rev> --region asia-southeast1 \
  --format='get(spec.containers[0].env)' | tr ',' '\n' | grep -A2 AUDIENCE
```
Expected: `'value': 'https://sahayakai-agents-staging-zwydpvyuca-as.a.run.app'`
(NOT `valueFrom: secretKeyRef`).

Then issue a synthetic dispatcher request from prod next.js → staging sidecar
and confirm dispatcher logs show `source: 'sidecar'` (not Genkit fallback).

## Notes / follow-ups

- The fix assumes the staging Cloud Run URL stays stable. If staging is ever
  redeployed under a new hash-prefix URL, update `_STAGING_AUDIENCE_URL` in
  `cloudbuild.yaml`.
- Long-term cleanup: move both URLs into separate secrets
  (`SAHAYAKAI_AGENTS_AUDIENCE_PROD`, `SAHAYAKAI_AGENTS_AUDIENCE_STAGING`) and
  branch via two distinct `secretKeyRef` blocks. The current sed-rewrite is the
  smaller, lower-risk change for today.
