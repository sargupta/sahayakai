# Q4A — Restore AppCheck Enforcement on Prod Sidecar

**Branch:** `feature/appcheck-restore-sidecar` (off `develop`)
**Date:** 2026-06-06
**Owner:** Abhishek Gupta

## Summary

The sidecar was running with `SAHAYAKAI_REQUIRE_APP_CHECK=false` because every
Next.js sidecar client called the browser-only `getFirebaseAppCheckToken()` —
which returns `null` on the server, omitting the `X-Firebase-AppCheck` header.
This commit adds server-side App Check token minting (firebase-admin
`appCheck().createToken()`) with in-process caching and rewires all 18 sidecar
clients to use it. AppCheck enforcement can now be flipped back on.

## Changes

| File | Change |
| --- | --- |
| `src/lib/sidecar/app-check-mint.ts` | NEW — server-side mint + 10-min refresh-buffer cache + concurrent-mint coalescing + `AppCheckMintError` |
| `src/lib/sidecar/*-client.ts` (18 files) | replaced `getFirebaseAppCheckToken()` (browser-only) with `getServerAppCheckTokenOrNull()` |
| `src/__tests__/lib/sidecar/app-check-mint.test.ts` | NEW — 6 unit tests: first-mint, cache hit, refresh-on-buffer, mint failure (throws), safe wrapper null on failure, safe wrapper success |

18 clients touched: `assessment-scanner`, `assignment-assessor`,
`avatar-generator`, `community-persona-message`, `exam-paper`, `instant-answer`,
`lesson-plan`, `parent-call`, `parent-message`, `quiz`, `rubric`,
`teacher-training`, `video-storyteller`, `vidya`, `virtual-field-trip`,
`visual-aid`, `voice-to-text`, `worksheet`.

> Spec said 17 clients; actual count in `src/lib/sidecar/*-client.ts` is 18.

## Verification commands

### 1. AppCheck API enabled

```
$ gcloud services list --enabled --filter='name:firebaseappcheck.googleapis.com' --project=sahayakai-b4248
NAME                             TITLE
firebaseappcheck.googleapis.com  Firebase App Check API
```

### 2. reCAPTCHA Enterprise provider registered for the Web App

```
$ curl -s -X GET \
    "https://firebaseappcheck.googleapis.com/v1/projects/sahayakai-b4248/apps/1:640589855975:web:624436f873a78069aa3642/recaptchaEnterpriseConfig" \
    -H "Authorization: Bearer $(gcloud auth print-access-token)"
{
  "name": "projects/640589855975/apps/1:640589855975:web:624436f873a78069aa3642/recaptchaEnterpriseConfig",
  "tokenTtl": "3600s",
  "riskAnalysis": { "minValidScore": 0.5 }
}
```

### 3. firebase-adminsdk SA has token-mint permission

```
$ gcloud projects get-iam-policy sahayakai-b4248 --format=json \
    | jq -r '.bindings[] | select(.members[] | test("firebase-adminsdk")) | .role'
roles/editor                              # superset, grants firebaseappcheck.tokens.create
roles/firebase.sdkAdminServiceAgent       # native firebase admin role
```

### 4. Unit tests pass

```
$ npx jest src/__tests__/lib/sidecar/app-check-mint.test.ts
PASS src/__tests__/lib/sidecar/app-check-mint.test.ts
  app-check-mint
    ✓ mints a token on first call via firebase-admin appCheck().createToken()
    ✓ returns the cached token on subsequent calls (cache hit)
    ✓ refreshes the cache when the token enters the 10-minute buffer
    ✓ throws AppCheckMintError when createToken fails
    ✓ getServerAppCheckTokenOrNull returns null on mint failure
    ✓ getServerAppCheckTokenOrNull returns the token on success
Tests: 6 passed, 6 total
```

Existing `firebase-app-check.test.ts` (parent-call-client integration) also
green — no regressions.

### 5. TypeScript clean

```
$ npx tsc --noEmit -p tsconfig.json
# (no output, exit 0)
```

## Rollout sequence (NOT yet executed — needs operator)

> Run in the order below. The dispatcher change must reach prod BEFORE
> the sidecar enforcement flip, otherwise canary@10 calls without the
> header will start 401-ing.

### Step A — Land dispatcher change

```
git push origin feature/appcheck-restore-sidecar
gh pr create --base develop --title "feat(sidecar): server-side App Check token minting"
# review + merge → develop
# release flow → main → safe-deploy.sh
bash scripts/safe-deploy.sh
bash scripts/audit-deployments.sh
```

### Step B — Flip staging sidecar to enforce

```
gcloud run services update sahayakai-agents-staging \
  --region=asia-southeast1 \
  --project=sahayakai-b4248 \
  --update-env-vars=SAHAYAKAI_REQUIRE_APP_CHECK=true
```

### Step C — Probe one dispatcher → staging-sidecar call

Trigger a quiz generate from the deployed Next.js app, then in Cloud Logging:

```
gcloud logging read \
  'resource.type=cloud_run_revision
   AND resource.labels.service_name=sahayakai-hotfix-resilience
   AND jsonPayload.source=~"sidecar"' \
  --limit=20 --project=sahayakai-b4248 \
  --format='value(jsonPayload.source,jsonPayload.endpoint)'
```

Expect: `source: 'sidecar'` (NOT `source: 'fallback'`).

### Step D — Flip prod sidecar to enforce

```
gcloud run services update sahayakai-agents \
  --region=asia-southeast1 \
  --project=sahayakai-b4248 \
  --update-env-vars=SAHAYAKAI_REQUIRE_APP_CHECK=true
```

### Step E — service.yaml already durably set

`sahayakai-agents/deploy/service.yaml` lines 111-112 already contain
`SAHAYAKAI_REQUIRE_APP_CHECK="true"` — no edit needed; next sidecar
deploy will keep enforcement on.

## Rollback

If 401s appear in dispatcher logs after Step B or D:

```
gcloud run services update sahayakai-agents[-staging] \
  --region=asia-southeast1 \
  --project=sahayakai-b4248 \
  --update-env-vars=SAHAYAKAI_REQUIRE_APP_CHECK=false
```

Investigation order: (1) check SA IAM still has `firebase.sdkAdminServiceAgent`,
(2) check `NEXT_PUBLIC_FIREBASE_APP_ID` env var on the Next.js service matches
the App Check-registered web app id, (3) check Cloud Run logs for
`[app-check-mint] server mint failed` warnings — that surface is the canary.

## Risk notes

- **Cache lives in-process.** Each Cloud Run pod mints its own token on cold
  start. With min-instances=0 this means a small burst of mint calls during
  scale-up; well under AppCheck QPS limits.
- **Token TTL is 1h.** Refresh buffer is 10min, so re-mint happens at the 50min
  mark per pod. ~24 mints/pod/day.
- **No new env vars required.** Default `appId` is hard-coded to the prod web
  app id (same constant used in `src/lib/firebase.ts`), overridable via
  `NEXT_PUBLIC_FIREBASE_APP_ID` or `FIREBASE_APP_ID`.
- **Canary@10 safety.** The dispatcher change is backwards-compatible: if the
  mint fails the safe wrapper returns null and the header is omitted, which
  still works while the sidecar runs `REQUIRE_APP_CHECK=false`. So Step A can
  ship without coordinating Step B at the same minute.
