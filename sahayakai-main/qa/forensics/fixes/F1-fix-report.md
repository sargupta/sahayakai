# F1 P1 Fix Report

Date: 2026-06-06
Branch: `fix/f1-twilio-secrets-email-spoof` (off `develop`)
Worktree: `/private/tmp/sahayakai-f1-fixes`

Two P1 items from `qa/forensics/F1-auth-identity.md` addressed.

---

## P1 FIX 1 — F1-04: Twilio credentials moved out of plaintext env

### Bug
`TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` lived as plaintext env vars
on the prod Cloud Run service. Any principal with `run.services.get`
(broadly granted across the project, including most viewer/editor roles)
could read both values from the service descriptor and place outbound
SMS / voice calls billed to the SahayakAI Twilio account.

Verified from prod before the fix (values redacted in this report;
both retrieved as plaintext from the service descriptor):
```
$ gcloud run services describe sahayakai-hotfix-resilience ... \
    --format='value(spec.template.spec.containers[0].env)'
{'name': 'TWILIO_ACCOUNT_SID', 'value': 'AC<REDACTED — see Secret Manager>'}
{'name': 'TWILIO_AUTH_TOKEN',  'value': '<REDACTED — see Secret Manager>'}
```

### Fix steps performed

1. **Secret Manager secrets** (`TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`)
   already existed. Added new versions with the verified prod plaintext
   values to guarantee `latest` matches what the service was running:
   ```
   printf "<SID>"   | gcloud secrets versions add TWILIO_ACCOUNT_SID --data-file=- ...  # → version 4
   printf "<TOKEN>" | gcloud secrets versions add TWILIO_AUTH_TOKEN  --data-file=- ...  # → version 4
   ```

2. **Granted access** for the Cloud Run runtime SA
   (`640589855975-compute@developer.gserviceaccount.com`) on each secret:
   ```
   gcloud secrets add-iam-policy-binding TWILIO_ACCOUNT_SID \
       --member="serviceAccount:640589855975-compute@developer.gserviceaccount.com" \
       --role=roles/secretmanager.secretAccessor --condition=None
   # same for TWILIO_AUTH_TOKEN
   ```

3. **Migrated the Cloud Run service**:
   ```
   gcloud run services update sahayakai-hotfix-resilience \
       --region=asia-southeast1 --project=sahayakai-b4248 \
       --remove-env-vars=TWILIO_ACCOUNT_SID,TWILIO_AUTH_TOKEN \
       --update-secrets=TWILIO_ACCOUNT_SID=TWILIO_ACCOUNT_SID:latest,TWILIO_AUTH_TOKEN=TWILIO_AUTH_TOKEN:latest \
       --no-traffic --tag=f1-secrets
   ```
   New revision: `sahayakai-hotfix-resilience-00486-wuv` (built, no
   traffic, tagged `f1-secrets`). Operator must flip traffic via the
   standard `safe-deploy` flow.

4. **Verified** plaintext is gone, secret refs are in place:
   ```
   $ gcloud run services describe ... | grep -i twilio
   {'name': 'TWILIO_PHONE_NUMBER',  'value': '+15577773467'}           # not a secret
   {'name': 'TWILIO_ACCOUNT_SID',  'valueFrom': {'secretKeyRef': {'key':'latest','name':'TWILIO_ACCOUNT_SID'}}}
   {'name': 'TWILIO_AUTH_TOKEN',   'valueFrom': {'secretKeyRef': {'key':'latest','name':'TWILIO_AUTH_TOKEN'}}}
   ```

5. **Persisted in `cloudbuild.yaml`** so future Cloud Build deploys
   re-bind the secret refs (idempotent `--update-secrets`). Plaintext
   `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` env vars must not be
   reintroduced — comment in the deploy step documents this.

### Rotation note
The Twilio creds were exposed as plaintext in env for an unknown window.
Recommended follow-up (not blocking this fix): rotate both SID/token in
the Twilio console and push the new values as fresh Secret Manager
versions. Cloud Run picks `latest` automatically on next deploy / revision
restart.

### Files touched
- `sahayakai-main/cloudbuild.yaml` — added `--update-secrets` flag on deploy step.

---

## P1 FIX 2 — F1-06: syncUserAction email spoof

### Bug
`syncUserAction` (`src/app/actions/auth.ts`) mirrored client-supplied
`email`, `displayName`, and `photoURL` straight into Firestore.
A signed-in attacker could call:
```
syncUserAction({ uid: ownUid, email: 'victim@evil.com',
                 displayName: 'Victim', photoURL: '...' })
```
and overwrite their own Firestore profile with arbitrary identity
strings. Every read surface that trusts the Firestore copy of email/
displayName (mutual contacts, connection requests, teacher directory,
community posts) would then render the attacker as `victim@evil.com`.
Wave 1 had locked uid down but left the other fields unchecked.

### Fix
1. **`src/middleware.ts`**: after a successful `verifyIdToken`, inject
   `x-user-email` and `x-user-name` headers populated from the verified
   token claims (`email`, `name`). Strip any inbound copies of these
   headers up front (matching the pattern already used for `x-user-id` /
   `x-user-plan`) so a client cannot forge them. Dev-bypass branches
   set deterministic placeholders.

2. **`src/app/actions/auth.ts → syncUserAction`**: read
   `email` / `displayName` from `headers()` (i.e., the middleware-trusted
   values). The client-supplied `user.email` / `user.displayName` are
   ignored. A divergence between client-supplied email and token email
   is logged as a WARN signal (useful for spoof-attempt telemetry but
   does not reject — a stale client cache is a benign cause). `photoURL`
   is still mirrored from the client payload because it's not a default
   token claim and the worst case (set own avatar to arbitrary URL) is
   already allowed by the profile-edit flow.

3. **Phone-auth edge case**: phone-auth users have no `email` claim on
   the token, so the middleware doesn't set `x-user-email`. The action
   writes an empty string rather than falling back to the client copy.
   Pinned by test #2 below.

### Files touched
- `sahayakai-main/src/middleware.ts`
- `sahayakai-main/src/app/actions/auth.ts`
- `sahayakai-main/src/__tests__/actions/auth-email-spoof-f1-06.test.ts` (new)

### Tests
`src/__tests__/actions/auth-email-spoof-f1-06.test.ts` — 4 cases:
1. Client sends `email: 'victim@evil.com'` → Firestore email is the
   verified-token email, not the attacker's. **(the requested test)**
2. No token email claim (phone auth) → Firestore email is `""`, not
   client copy.
3. uid spoof still rejected (Wave 1 regression).
4. Unauthenticated calls still rejected (Wave 1 regression).

Plus full Wave 1 auth suite still green (20 tests, including the
existing `syncUserAction rejects spoofed uid` case).

```
PASS src/__tests__/actions/auth-email-spoof-f1-06.test.ts   (4/4)
PASS src/__tests__/actions/wave-1-auth.test.ts              (20/20)
tsc --noEmit                                                clean
```

---

## Out of scope (flagged, not fixed here)
- **Twilio cred rotation** in the Twilio console — recommended after
  this lands. Add new Secret Manager versions; Cloud Run picks up
  `latest` on next deploy.
- **Other env-plaintext secrets** on Cloud Run not covered by F1-04
  (e.g. any API keys not yet migrated). A separate sweep is worthwhile
  but out of scope here.
