# Mumbai (asia-south1) Region Migration Runbook

**Status:** DRAFT — for review before execution
**Author:** Engineering
**Project:** `sahayakai-b4248` (project number 640589855975)
**Goal:** All teacher personal data physically resident in India (asia-south1, Mumbai), zero downtime, zero data loss, while teachers are actively using production.

---

## 0. The single most important finding (read this first)

The premise we started from — "Firestore, Cloud Run, and Realtime Database all run in Singapore" — is **wrong**. Live `gcloud` inventory of the production project on 2026-06-09 shows:

| Component | Holds | **ACTUAL** location (live) | DPDP status |
|---|---|---|---|
| **Firestore `(default)`** | ALL teacher PII: profiles, lesson plans, attendance, parent logs, analytics/telemetry, chat | **`asia-south1` (Mumbai)** | ✅ **Already in India** |
| **Cloud Storage** `sahayakai-b4248.firebasestorage.app` | Voice recordings, post/avatar images (personal data) | **`us-central1` (USA)** | ❌ **In the US — the real gap** |
| **Realtime Database** `...-default-rtdb` | Presence + typing indicators only (ephemeral, non-personal) | `asia-southeast1` (Singapore) | ⚠️ Non-PII |
| **Cloud Run** `sahayakai-hotfix-resilience` | Stateless compute (processing, not at-rest storage) | `asia-southeast1` (Singapore) | ⚠️ Processing locality |
| **Cloud Scheduler** (3 jobs) | cron triggers | `asia-south1` (Mumbai) | ✅ Already in India |
| **Artifact Registry** | build images (no user data) | `asia-southeast1` | cosmetic |

**Consequences that make this migration far safer than feared:**

1. **The hardest, riskiest piece is already done.** Firestore — the primary PII store with 47 collections and composite indexes — is *already in Mumbai*. There is **no Firestore export/import, no index rebuild, and no read-only maintenance window** required. That single fact removes ~80% of the risk of a typical region migration.
2. **The real residency problem is Cloud Storage, which is in the USA — worse than Singapore for DPDP.** Voice recordings are personal data under DPDP and they currently leave India entirely. This is the priority.
3. **The whole migration can be genuinely zero-downtime** because we never have to freeze the database.

> ⚠️ **Consent-copy correction required.** Both the original "data stays in India" claim AND the interim "Singapore" wording committed on branch `fix/dpdp-data-location-accuracy` are inaccurate against this live reality. See **§8**. Do not ship either as-is.

> 🔎 **One thing to confirm before execution:** there is a second Firestore database `ai-studio-13336d91-...` (ENTERPRISE edition) in `asia-southeast1`. Both the client (`initializeFirestore(app, …)`, `src/lib/firebase.ts:46`) and admin (`getFirestore()`, `src/lib/firebase-admin.ts:73`) bind to the **default** database, so the app does **not** use the ai-studio DB. Verify no code path passes a `databaseId`, then it can be ignored (or deleted separately).

---

## 1. Scope

### In scope (must move to asia-south1)
- **Cloud Storage media** (US → Mumbai) — the only at-rest PII migration. **§5**
- **Cloud Run compute** (Singapore → Mumbai) — for processing locality + lower latency to Indian users. **§4**
- **RTDB presence/typing** (Singapore → eliminate) — optional, for a clean "100% in India" claim. **§6**
- **Config / hardcoded region strings** across code, scripts, infra. **§7**

### Explicitly NOT in scope (already correct or no user-data impact)
- Firestore data — already in Mumbai. **Do not touch the database.**
- Cloud Scheduler jobs — already in asia-south1.
- Firebase Auth — global service, no region, **no user re-authentication**, FCM tokens stay valid.
- Secret Manager, Cloud Logging, Pub/Sub topics, Gemini (API-key/global), Cloud TTS (global), Sarvam/Exotel (external) — all global or region-agnostic. No work.
- Artifact Registry — build artifacts only; optional cosmetic move (§7), not data residency.

---

## 2. Architecture decisions (with rationale)

### D1 — Same project, new regional resources (NOT a new project)
Keep project `sahayakai-b4248`. Create a new Storage bucket and new Cloud Run service in asia-south1 *within the same project*. **Why:** a new project would force Auth migration, new service accounts, new FCM sender ID, and re-issuance of every API integration — enormous risk for zero benefit. Firestore is already in the right region in this project.

### D2 — Zero maintenance window (rejected the read-only-window approach)
Because Firestore stays put, we never freeze writes. Storage migrates via **dual-bucket coexistence** (§5): objects are duplicated to the new bucket and *both* bucket domains are accepted by the app during transition, so no URL ever 404s. **Why not a maintenance window:** unnecessary once the DB isn't moving, and teachers in a single timezone (IST) have no truly dead hours.

### D3 — Rejected dual-write across two databases
N/A — no second database. (Documented so reviewers know it was considered and is moot.)

### D4 — Storage cutover keeps the old US bucket alive read-only for 30 days
A safety net: if any URL rewrite is missed, the old bucket still serves it. Delete only after verification + a soak period. **Why:** makes every storage step reversible.

### D5 — Cloud Run cutover via the existing HTTPS load balancer
Traffic path is: External HTTPS LB (`sahayakai-url-map`) → backend `sahayakai-backend-service` → serverless NEG `sahayakai-resilience-neg-asia` (asia-southeast1) → Cloud Run. We add a **second** serverless NEG in asia-south1 as an additional backend, shift traffic, then drain the old one. **Why:** the LB already fronts the service, so this is a backend swap with instant rollback — no DNS TTL waits.

---

## 3. Pre-flight (T-minus: do these days before, no production impact)

```bash
PROJECT=sahayakai-b4248
OLD_REGION=asia-southeast1
NEW_REGION=asia-south1
OLD_BUCKET=sahayakai-b4248.firebasestorage.app
NEW_BUCKET=sahayakai-b4248-media-asia-south1   # globally-unique; regional; Mumbai
SERVICE=sahayakai-hotfix-resilience
```

**P1. Snapshot current state (evidence + rollback baseline):**
```bash
gcloud firestore databases list --project $PROJECT \
  --format="table(name,locationId,type)"                              # expect (default) = asia-south1
gcloud storage buckets describe gs://$OLD_BUCKET \
  --format="value(location,storageClass,iamConfiguration.uniformBucketLevelAccess.enabled)"
gcloud run services describe $SERVICE --region $OLD_REGION \
  --format=export > /tmp/$SERVICE.$OLD_REGION.yaml          # full service spec for cloning
gcloud compute backend-services describe sahayakai-backend-service --global \
  --format="yaml(backends)"                                 # current NEG backends
```

**P2. Measure media volume (sizes the transfer + cost):**
```bash
gcloud storage du -s gs://$OLD_BUCKET     # total bytes + object count; may take minutes
```

**P3. Verify the CRITICAL token-preservation assumption (see §5.4):**
On a *single test object*, confirm the Firebase download token survives a copy. This decides whether the URL rewrite is a cheap string-swap or a per-object regeneration.
```bash
# pick any existing object path under the bucket
gcloud storage objects describe gs://$OLD_BUCKET/<SOME/OBJECT/PATH> \
  --format="value(metadata.firebaseStorageDownloadTokens)"
```
Note the token. After the test copy in §5.1, re-describe the copied object in the new bucket and confirm the same `firebaseStorageDownloadTokens` value is present. **If preserved → string-swap rewrite (cheap). If not → regenerate-via-Admin-SDK rewrite (heavier; §5.4 fallback).**

**P4. Confirm the ai-studio DB is unused** (grep already shows no `databaseId` arg; double-check):
```bash
grep -rnE "getFirestore\(app,|getFirestore\([\"']|databaseId|FirestoreSettings" src | grep -vi "getFirestore()" || echo "OK: default DB only"
```

**P5. Quotas:** confirm asia-south1 has Cloud Run CPU quota headroom (memory note: regional Cloud Run CPU quota was a known launch blocker in asia-southeast1). File an increase for asia-south1 *now* if needed — quota grants take days.
```bash
gcloud run regions list | grep asia-south1
# Check quota in console: IAM & Admin → Quotas → Cloud Run Admin API, region asia-south1
```

---

## 4. Phase A — Cloud Run → Mumbai (compute)

Lowest risk; do first to validate the new region end-to-end before touching data. Fully reversible at the load balancer.

**A1. New Artifact Registry repo in Mumbai (optional but clean):**
```bash
gcloud artifacts repositories create cloud-run-source-deploy \
  --repository-format=docker --location=$NEW_REGION --project $PROJECT 2>/dev/null || true
```

**A2. Build + deploy the service in asia-south1 with `--no-traffic`** (mirrors `scripts/safe-deploy.sh` defaults — warm but not serving):
```bash
# from sahayakai-main/, clean working tree, no other deploy in flight (run scripts/audit-deployments.sh first)
gcloud run deploy $SERVICE \
  --project $PROJECT --region $NEW_REGION \
  --source . \
  --no-traffic --tag=mumbai \
  # IMPORTANT: copy ALL env vars + secrets + service account + scaling from /tmp/$SERVICE.$OLD_REGION.yaml
  --service-account=sahayakai-hotfix-resilience-runtime@$PROJECT.iam.gserviceaccount.com
```
> Reproduce env/secret/scaling config exactly from the captured YAML (P1). Do **not** hand-type — diff against the old spec.

**A3. Smoke-test the Mumbai revision directly** (via its `--tag` URL) before any traffic:
```bash
MUMBAI_URL=$(gcloud run services describe $SERVICE --region $NEW_REGION \
  --format="value(status.traffic[].url)" | tr ' ' '\n' | grep mumbai)
bash scripts/smoke-test.sh "$MUMBAI_URL"     # adapt smoke-test to accept a URL arg if needed
```

**A4. Add Mumbai as a load-balancer backend (coexist, then shift):**
```bash
gcloud compute network-endpoint-groups create sahayakai-resilience-neg-mumbai \
  --region=$NEW_REGION --network-endpoint-type=serverless \
  --cloud-run-service=$SERVICE --project $PROJECT
gcloud compute backend-services add-backend sahayakai-backend-service --global \
  --network-endpoint-group=sahayakai-resilience-neg-mumbai \
  --network-endpoint-group-region=$NEW_REGION
```

> **CUTOVER COMPLETE (2026-06-09):** Mumbai is now a live LB backend, coexisting with Singapore.
> - Mumbai service deployed: `sahayakai-hotfix-resilience` rev `00001-vum` in `asia-south1`, exact image-by-digest of the live Singapore revision, all 8 secrets + 9 env vars + SA + scaling replicated. Smoke tests clean.
> - NEG `sahayakai-resilience-neg-mumbai` (`asia-south1`, serverless) **attached** to `sahayakai-backend-service` alongside `sahayakai-resilience-neg-asia` (Singapore). Global `EXTERNAL_MANAGED` LB now geo-routes: India teachers → Mumbai, others → nearest region.
> - Post-cutover verification: `www.sahayakai.com` HTTP 200 (~0.3s), `/api/health` healthy, Mumbai service direct 200, **zero 5xx across both regions** in the 10 min after cutover.
> - **Rollback (instant, if needed):** `gcloud compute backend-services remove-backend sahayakai-backend-service --global --network-endpoint-group=sahayakai-resilience-neg-mumbai --network-endpoint-group-region=asia-south1` → all traffic falls back to Singapore. Old Singapore service untouched.
> - **Next:** soak 7 days, watch latency/error rate, then optionally drain Singapore (A7). Do NOT remove Singapore until Phase B (Storage) is also done, since the US bucket is still the media source of truth.

**A5. Cutover & verify:** route LB traffic to Mumbai (shift the Cloud Run `--to-latest`/tag traffic to 100% in asia-south1, and/or rely on the LB to prefer the in-region backend). Watch error rate + latency for 30–60 min.

**A6. Rollback (instant):** remove the Mumbai backend / shift Cloud Run traffic back to the asia-southeast1 revision. The old service stays untouched the whole time.

**A7. Decommission (only after soak):** drain & remove `sahayakai-resilience-neg-asia`, then delete the old-region revision once stable for 7 days.

---

## 5. Phase B — Cloud Storage US → Mumbai (the real PII migration, zero-downtime)

Cloud Storage bucket **location is immutable** → we cannot move `sahayakai-b4248.firebasestorage.app`. We create a new regional bucket in Mumbai and migrate behind dual-bucket coexistence.

### 5.0 Create the new bucket (asia-south1, matching config)
```bash
gcloud storage buckets create gs://$NEW_BUCKET \
  --project $PROJECT --location=$NEW_REGION \
  --uniform-bucket-level-access --public-access-prevention
# Replicate CORS + lifecycle + IAM from the old bucket:
gcloud storage buckets describe gs://$OLD_BUCKET --format="json(cors,lifecycle)" > /tmp/oldbucket.json
gcloud storage buckets update gs://$NEW_BUCKET --cors-file=/tmp/cors.json   # extract cors from above
# Mirror Firebase Storage security rules to the new bucket target (see storage.rules / firebase.json).
```

### 5.1 Bulk copy objects US → Mumbai (live, no impact) — preserving metadata
Use **Storage Transfer Service** (managed, resumable, parallel) for the baseline copy. Metadata preservation is mandatory (token survival, §3-P3).
```bash
# Test a single object first to validate token preservation (§3-P3), then the full job:
gcloud transfer jobs create gs://$OLD_BUCKET gs://$NEW_BUCKET \
  --preserve-metadata=storage-class,custom-time,acl,metadata-keys \
  --name=media-mumbai-baseline
# Or for a one-shot/smaller set: gcloud storage cp -r --preserve-metadata gs://$OLD_BUCKET/* gs://$NEW_BUCKET/
```

### 5.2 Code change: write new uploads to Mumbai, accept BOTH buckets on read
Deploy a Cloud Run revision (Phase A pipeline) that:
- Sets `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=$NEW_BUCKET` (new uploads land in Mumbai). Affects `src/lib/firebase.ts:32`, `src/lib/firebase-admin.ts:45`, `apphosting.yaml:22`.
- **Widens the URL-validation allowlists to accept the new bucket domain** (otherwise new/rewritten URLs are rejected):
  - `src/app/actions/messages.ts:163-164` (audioUrl allowlist)
  - `src/app/actions/community.ts:81-83` (imageUrl allowlist)
  - Keep the old bucket host in the allowlist during transition (accept BOTH).

After this deploy: new media → Mumbai; historical media → still served from the US bucket (kept alive). **No 404s.**

> **PHASE B §5.0–5.2 COMPLETE (2026-06-09):** New uploads now write to Mumbai in production, both regions.
> - **Actual new bucket name:** `sahayakai-b4248-mumbai` (NOT the `$NEW_BUCKET=sahayakai-b4248-media-asia-south1` placeholder used in this doc's examples). `asia-south1`, uniform access, public-access-prevention, Firebase-registered.
> - **Baseline copy:** all 4169 objects US → Mumbai, `firebaseStorageDownloadTokens` + bytes preserved (md5 identical); rsync `--dry-run` clean. US bucket UNTOUCHED (source of truth).
> - **Storage rules:** `firebase.json` switched to multi-bucket array form; `storage.rules` released to BOTH buckets (`firebase deploy --only storage` shows 2 releases). Mumbai bucket now rule-enforced.
> - **Code/config cutover (commits on `feature/storage-mumbai-migration`):** `firebase.ts:32`, `firebase-admin.ts:45` fallbacks → `sahayakai-b4248-mumbai`; `apphosting.yaml`; `cloudbuild.yaml` build-arg + deploy `--update-env-vars` pin. **NO allowlist change was needed** — `messages.ts`/`community.ts` allowlists are HOST-based (`firebasestorage.googleapis.com` / `storage.googleapis.com`), and the bucket name lives in the URL *path*, so Mumbai URLs and legacy US URLs both validate unchanged. Reads accept both buckets inherently.
> - **Deploy:** image built `--no-traffic` (tag `mumbai-a21f7c4cd`, digest `sha256:eee4a066…`) and deployed to BOTH `asia-southeast1` (rev `00522-mof`) and `asia-south1` (rev `00002-beb`), then traffic flipped `--to-latest` in both.
> - **Verification:** server `content/save` writes from BOTH no-traffic revisions AND via the live LB-routed `www.sahayakai.com` all landed in `gs://sahayakai-b4248-mumbai`, **zero** in the US bucket. `www.sahayakai.com` HTTP 200, `/api/health` healthy, **zero 5xx** in both regions post-flip. Smoke artifacts + QA user cleaned up.
> - **Rollback (instant, pre-deletion):** set `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=sahayakai-b4248.firebasestorage.app` + redeploy/flip. US bucket still holds every object; host-based allowlists already accept it.
> - **Image provenance:** built from `origin/main` + the 2 storage-only commits (no `develop` drift — `origin/develop == origin/main`). Repo `main` is BEHIND live prod by these 2 commits until a user-initiated release merges them.
> - **Next:** §5.3 delta re-copy (catch objects written US-side during the rollout window — none expected since both regions cut over together) + Firestore URL rewrite (dry-run first); then §5.5 soak + 30-day read-only retention before any US-bucket deletion.

### 5.3 Delta sync + URL rewrite in Firestore
1. Re-run the transfer to catch objects uploaded between baseline and now (`gcloud transfer jobs create … ` again, or scheduled).
2. **Rewrite stored absolute URLs** in Firestore from the old bucket to the new bucket. Fields and collections (from code audit):

   | Field | Collections | Source |
   |---|---|---|
   | `audioUrl` | `conversations/{id}/messages`, `community_chat`, `groups/{id}/messages` | messages.ts:163, community.ts:834 |
   | `photoURL` | `users`, `organizations` | settings/page.tsx:134, profile.ts:114 |
   | `imageUrl` | `posts` | community.ts:100 |
   | `groupPhotoURL` | `conversations` | types/messages.ts:60 |
   | `attachments[].url` | `posts` | types/community.ts:35 |

   Write a one-off Admin-SDK script (model it on existing `scripts/backfill-*.ts`) that batches over these collections and rewrites the bucket segment of each URL. **Dry-run first** (log intended changes, write nothing), verify counts, then run for real in batches of ≤400 with checkpointing.

> **PHASE B §5.3 COMPLETE (2026-06-09):** Delta re-copy + URL rewrite done.
> - **Delta re-copy:** `gcloud storage rsync -r` (additive, NO `--delete`) US → Mumbai = **0 copies, 0 deletions**. Both buckets at **4169** objects, identical. Nil delta window (both regions cut over together).
> - **Script:** `scripts/qa/dryrun-url-rewrite.mjs` — sweeps top-level `users/organizations/posts/community_chat/conversations/groups` + `collectionGroup('messages')` + `collectionGroup('content')`, recursively matches ANY string field (field-name-agnostic) against BOTH old bucket aliases (`…firebasestorage.app` AND legacy `…appspot.com`). DRY-RUN by default; `--commit` to write (≤400/batch, idempotent, asserts no array-segment paths).
> - **Dry-run finding (4879 docs scanned):** only **32** stored absolute URLs pointed at the old bucket — **31** in `content.data.storageRef` (visual-aid PNGs, `.firebasestorage.app`) + **1** in `messages.audioUrl` (`.appspot.com`). The runbook's predicted `photoURL`/`imageUrl`/community `audioUrl` rewrites turned out to be **non-existent in live data**: most media is referenced by *relative* `storagePath` (bucket-agnostic, needs no rewrite), and 71 user `photoURL`s are Google-hosted `lh3.googleusercontent.com` avatars (correctly left untouched).
> - **Token gate (§5.4): PASSED** — string-swap. Verified end-to-end: a swapped Mumbai URL returns HTTP 200 / identical 786470-byte PNG; the legacy US URL still returns the same bytes (coexistence intact).
> - **Commit run:** 32 fields updated. Re-scan = **0** remaining old-bucket URLs. A rewritten `content.data.storageRef` now stores the Mumbai URL and resolves HTTP 200.
> - **Reversible:** both buckets still hold every object; re-running the swap in reverse restores US URLs.

### 5.4 ⚠️ Token-preservation gate (decides 5.3's method)
Firebase download URLs look like `https://firebasestorage.googleapis.com/v0/b/<BUCKET>/o/<path>?alt=media&token=<UUID>`. The `token` is object metadata (`firebaseStorageDownloadTokens`).
- **If §3-P3 confirmed the token is preserved by the copy** → §5.3 is a simple deterministic string-swap of `<BUCKET>` (skip is safe, reversible).
- **If the token is NOT preserved** → a naive swap yields dead URLs. Instead, the rewrite script must, per object, call Admin SDK `getDownloadURL()` (or read the new object's token) against the **new** bucket and write that fresh URL. Heavier (one Storage read per media doc) but correct. **Do not skip this gate.**

### 5.5 Verify, soak, decommission
- Spot-check rendered media across chat (audio), community (images), profiles (avatars) in the live app.
- Confirm zero reads hitting the old bucket (Cloud Monitoring on `$OLD_BUCKET` request count) for 30 days.
- Then set old bucket read-only, and finally delete after the soak. **Never delete before the soak.**

> **PHASE B §5.5 — LIVE VERIFIED, SOAK STARTED (2026-06-10):**
> - **Existing media serves live from Mumbai:** a real `visual-aids/*.png` (token `ca38d017…`) fetched over HTTPS from the Mumbai bucket = **HTTP 200, 1,223,683 bytes, image/png, 1.5s**; the SAME token against the old US bucket also = **HTTP 200, identical 1,223,683 bytes, 3.9s** (Mumbai 2.6× faster — closer region; both buckets coexist for the soak).
> - **Fresh live write lands in Mumbai, NOT US:** minted a real QA ID token (`provision-test-user.mjs`), POSTed `/api/content/save` against prod `www.sahayakai.com` (HTTP 200, `{success:true}`). New object appeared at `gs://sahayakai-b4248-mumbai/users/<uid>/lesson-plans/…json`; **absent from US**. QA artifact + user cleaned up afterward (Mumbai back to 4169).
> - **Zero post-cutover writes to US:** newest US object is `2026-06-09T17:17:37Z` (pre-cutover); nothing written after the `2026-06-09T18:00:00Z` boundary. No divergence → nothing to lose on eventual deletion.
> - **Soak baseline (24h request_count):** US `ReadObject` app traffic ≈ nil — the 7021 US requests are migration tooling (`RewriteObject.From` 4170 copy-reads + `ListObjects` 2803 verification `ls`). Mumbai receiving live `WriteObject` + serving `ReadObject`.
> - **Repo synced:** storage cutover released to `main` (`chore(release): Mumbai storage cutover (Phase B)`), develop back-merged; git now matches what prod runs.
> - **Soak window: 2026-06-10 → 2026-07-10 (30 days).** Re-run `bash scripts/qa/soak-check-us-bucket.sh` any time and as the final gate on/after 2026-07-10. It checks object parity, the post-cutover-write tripwire, and US request breakdown; exit 0 = clean. **US bucket NOT deleted; kept fully intact as rollback target during soak.**
> - **Open decision (deferred to user):** whether to harden US to *read-only* (remove write IAM) now vs. keep it write-capable. Read-only eliminates silent-divergence risk but disables instant write-rollback (rollback would then need a reverse delta-copy first). Kept write-capable for now since cutover is freshly verified; revisit mid-soak.

### 5.5.1 ⚠️ Missed writer found (2026-07-04): call recordings were still leaking to the US
The soak check (`scripts/qa/soak-check-us-bucket.sh`) returned **NOT CLEAN**: ~20 `call-recordings/{outreachId}/*.wav` objects were written to the **US bucket after cutover** (2026-06-10 … 06-19). Root cause: the **`sahayakai-voice-call`** service (Exotel voicebot, a *separate* repo) is out of scope of the main-app `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` change — its `src/lib/firebase-admin.ts` set **no** `storageBucket`, so `getStorage().bucket()` in `src/exotel/call-record.ts` used the project **default (US) bucket**. The most sensitive media class (parent-call audio) was the one still leaving India.

Remediation (2026-07-04):
- **Code fix** (`sahayakai-voice-call`, branch `fix/recordings-mumbai`): pin `storageBucket` → `sahayakai-b4248-mumbai`, env-overridable. **Requires redeploy of the voice-call service (`asia-south1`, its own `scripts/safe-deploy.sh`) to take effect — until then, recordings keep going to US.**
- **Data rescued:** the 20 leaked recordings copied US→Mumbai additively (`gcloud storage rsync`, no `--delete`); both buckets now at 36. US untouched.
- **No Firestore rewrite needed:** recordings are referenced by relative `recordingPath` (bucket-agnostic → resolves to Mumbai after redeploy) + a 7-day signed URL (all leaked ones long expired).
- **Sequence correction:** the US bucket **cannot** be deleted (and the soak cannot pass) until the voice-call service is redeployed AND a subsequent soak-check shows zero new US writes. Re-run `soak-check-us-bucket.sh` after redeploy.

### 5.6 Rollback
At any point pre-deletion: flip `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` back to `$OLD_BUCKET` and redeploy. Old bucket still has every object; the broadened allowlist already accepts it. URL rewrite is reversible (re-run swap in reverse, both buckets hold the objects).

---

## 6. Phase C — RTDB presence/typing → a GCP-native, Mumbai-available store

### 6.0 Reframe: this is the *only* Firebase-proprietary piece
Firestore is a native GCP product (console: "Firestore in Native mode") and is already in Mumbai; Cloud Storage is a plain GCS bucket. The **only** Firebase-only service with no India region is **Realtime Database** (RTDB exists only in `us-central1`, `europe-west1`, `asia-southeast1`). So "use GCP-native databases instead of Firebase" reduces to: *what replaces RTDB's presence/typing, using a service that has `asia-south1`?* This migration is about **location, not vendor**.

RTDB here stores only `presence/{uid}` (online flag) and `typing/{conversationId}/{uid}` (~3s TTL) — **no personal data**.

### 6.1 The decisive constraint
The app is **serverless Cloud Run + client-SDK-direct** (browsers connect straight to Firestore/RTDB under security rules, with realtime listeners). Any replacement is judged on: (a) does it preserve client-direct realtime, and (b) does it cover RTDB's killer feature, **`onDisconnect()`** — server-enforced presence cleanup when a socket drops. Firestore has no `onDisconnect` equivalent.

### 6.2 GCP-native options (all verified available in `asia-south1` per GCP docs; live-verify at execution)
| Option | Client-direct? | Fit for presence/typing | Cost floor | Verdict |
|---|---|---|---|---|
| **Firestore** (already live in Mumbai) | ✅ SDK + rules + listeners already wired | Good, with 2 caveats below | $0 new (pay-per-op) | **Recommended** |
| **Memorystore for Redis** | ❌ browsers can't connect directly | *Ideal* model (TTL keys, pub/sub fanout, µs ops) but needs a **WebSocket/SSE relay** on Cloud Run + a **Serverless VPC Access connector** | ~$35–50/mo (Basic) + relay | Only at high concurrency |
| **Cloud SQL / AlloyDB** (Postgres) | ❌ | Wrong tool — relational, server-mediated, persistent instance; ill-suited to ephemeral churn | persistent $ | Skip for this |
| **Cloud Spanner** | ❌ | Massive overkill; global-scale strong consistency | high | Skip |
| **Bigtable** | ❌ | High write throughput but server-mediated, cost floor | persistent | Overkill |
| **Memorystore Memcached** | ❌ | No pub/sub / TTL-fanout | floor | Worse than Redis |

> **PHASE C1 IMPLEMENTED (2026-07-04, code):** presence + typing moved off RTDB (Singapore) → Firestore (Mumbai). RTDB is now unused by the app; `getDatabase`/`rtdb` removed from `src/lib/firebase.ts`, RTDB `connect-src` removed from `middleware.ts` CSP.
> - **Presence** (`use-presence.ts` + `presence-dot.tsx`): heartbeat model — `presence/{uid}` = `{ online, lastSeen, expireAt }`, refreshed every 30 s while the tab is visible; the reader shows "online" only if `online===true` AND `lastSeen` is within 45 s, recovering onDisconnect UX (crashed tab → grey within 45 s). Writes only while visible.
> - **Typing** (`use-typing-indicator.ts`): one `typing_status/{conversationId}` doc = `{ [uid]: expiryTimestamp }`, debounced to ≤1 write / 2 s; a user is "typing" while their expiry is in the future.
> - **Rules:** added for `presence/{uid}` (owner-write, signed-in read) and `typing_status/{conversationId}` (a caller may only affect its own uid key + `expireAt`).
> - **Founder activation:** (1) `firebase deploy --only firestore:rules`; (2) create Firestore **TTL policies** on `presence.expireAt` and `typing_status.expireAt` (console → Firestore → TTL, or `gcloud firestore fields ttls update expireAt --collection-group=presence` and `…=typing_status`) so idle docs self-reap; (3) after soak, the RTDB instance `sahayakai-b4248-default-rtdb` can be deleted. **Cost:** validate presence-write volume at real concurrency before a large rollout.

### 6.3 Recommended path — C1: fold presence/typing into Firestore (Mumbai)
Zero new infra, already GCP-native, already in India, rules + listeners already present. Touch `src/hooks/use-presence.ts`, `src/hooks/use-typing-indicator.ts`, `src/components/messages/presence-dot.tsx`, and remove the `rtdb` export in `src/lib/firebase.ts:54`. Engineer around the two real downsides:
- **No `onDisconnect`** → make presence a **heartbeat**: client writes `lastSeen` every ~20s; "online" = `lastSeen` within 30s; a **Firestore TTL policy** auto-purges stale presence docs.
- **Typing-write cost** → one `typingState` doc **per conversation**, debounced to **≤1 write / 2s**, TTL-cleaned. Validate write cost in staging before prod.

### 6.4 When to choose Redis instead (C-Redis)
Only if presence/typing concurrency grows enough that Firestore per-write cost bites **and** you are ready to operate a WebSocket relay. Then Memorystore Redis (asia-south1) is the right tool: presence via TTL keys, fanout via pub/sub, app holds the sockets. Note: long-lived WebSockets on Cloud Run are workable but fiddly (request timeouts, connection draining on revision swaps) — budget for that. Requires a Serverless VPC Access connector (Cloud Run → Memorystore is private-IP only).

### 6.5 Interim option — C2 (lowest risk, ship-now): keep RTDB in Singapore, disclose narrowly
"Your content and records are stored in India; transient online/typing status is processed in Singapore." Zero migration, honest, DPDP-defensible (non-personal session state).

**Recommendation:** don't block the PII migration (Phase B) on this. Ship with **C2** now, then do **C1 (Firestore)** as the fast-follow for a clean "100% in India". Reserve **C-Redis** for a future scale problem. Update disclosure copy (§8) to match whichever is live.

### 6.6 Adjacent note — analytics
`telemetry_events` / `teacher_analytics` are in Firestore-Mumbai already (residency fine). If you later want SQL analytics over them, the GCP-native home is **BigQuery (asia-south1 / asia-south2)** via the Firestore→BigQuery streaming export. That is an analytics upgrade, not a residency fix.

---

## 7. Config / code change manifest

Region/bucket/project strings to update (from full audit). Group into the PRs for each phase.

**Storage bucket (Phase B):**
- `src/lib/firebase.ts:32` — `storageBucket` fallback
- `src/lib/firebase-admin.ts:45` — admin `storageBucket` fallback
- `apphosting.yaml:22` — baked env value
- `scripts/deploy_shadow.sh:30` — shadow env
- `src/app/actions/messages.ts:163-164`, `src/app/actions/community.ts:81-83` — URL allowlists (accept new bucket)

**RTDB URL (Phase C, only if migrating):**
- `src/lib/firebase.ts:54` — hardcoded `asia-southeast1.firebasedatabase.app` (remove if RTDB retired)

**Cloud Run region (Phase A):**
- `cloudbuild.yaml` (lines 13–14, 43, 44, 56, 62), `cloudbuild-preview.yaml` (18,19,27,28,32) — `asia-southeast1-docker.pkg.dev`, `--region`
- `scripts/safe-deploy.sh:47`, `scripts/audit-deployments.sh:20`, `scripts/deploy_shadow.sh:11`, `scripts/deploy-alerts.sh:13` — default `REGION`
- `scripts/audit-i18n-live.sh`, `scripts/ci/check-appcheck-env.sh`, `scripts/ci/check-service-yaml-drift.sh` — region/URL defaults
- `infra/billing/dispatch-cost-log-sink.sh:11`, `infra/labels/apply-dispatcher-labels.sh:6`, `infra/monitoring/*.yaml` — region strings
- `firebase.json:10` — `"region": "asia-southeast1"` (Functions/backend region; change if any Functions deploy here)

**No change needed:** project-id fallbacks (`sahayakai-b4248`) stay — same project. Auth domain `sahayakai-b4248.firebaseapp.com` stays (Auth is global). `next.config.ts:80,84` auth reverse-proxy stays.

---

## 8. Consent & privacy copy — correct it to match reality

The committed branch `fix/dpdp-data-location-accuracy` says data is in **Singapore**. Live infra says: **content/records/analytics in India (Mumbai); media in the US; presence in Singapore.** Neither the original nor the interim wording is accurate.

**Interim (pre-migration) honest wording** for `analytics-consent-dialog.tsx` and `terms-client.tsx`:
> "Your account data and analytics are stored in India (Google Cloud Mumbai). Uploaded media files are currently stored on Google Cloud in the USA and online-status signals in Singapore; we are migrating both to India. By continuing you consent to this cross-border processing."

**Post-migration wording** (after Phase B, and C1 or C2):
> "Your data is stored in India on Google Cloud (Mumbai)." — *(if C1 done; if C2, append the one-line Singapore presence disclosure).*

**Action:** amend the branch — replace the "Singapore" strings (and all 11-language translations) with the interim wording above, since shipping "Singapore" would be a *new* inaccuracy. Flip to post-migration wording only when Phase B (and chosen C) is live and verified.

---

## 9. Master checklist

**Pre-flight**
- [ ] P1 state snapshot captured (Firestore=asia-south1 confirmed, service YAML exported, LB backends recorded)
- [ ] P2 media volume measured
- [ ] P3 token-preservation tested on one object → method for §5.3 chosen
- [ ] P4 ai-studio DB confirmed unused
- [ ] P5 asia-south1 Cloud Run quota confirmed / increase filed

**Phase A — Cloud Run → Mumbai**
- [x] Service deployed with env/secrets/SA cloned from captured YAML (rev 00001-vum, image-by-digest)
- [x] Mumbai revision smoke-tested via run.app URL
- [x] Mumbai serverless NEG added as LB backend (coexist with Singapore) — 2026-06-09
- [x] Post-cutover verified: prod 200, zero 5xx both regions
- [ ] Error rate + latency watched over 7-day soak
- [ ] Old Singapore NEG drained (ONLY after Phase B Storage migration completes)

**Phase B — Storage → Mumbai**
- [ ] New Mumbai bucket created (CORS/lifecycle/rules mirrored)
- [ ] Baseline Storage Transfer completed (metadata preserved)
- [ ] App revision live: new uploads → Mumbai, allowlists accept BOTH buckets
- [ ] Delta transfer run
- [ ] URL rewrite script dry-run reviewed → run in batches → counts verified
- [ ] Media spot-checked live (audio, images, avatars)
- [ ] Old bucket read traffic = 0 for 30 days → set read-only → delete

**Phase C — RTDB (chosen path)**
- [ ] C2 disclosure shipped now; OR C1 presence/typing moved to Firestore with cost validated

**Copy**
- [ ] Branch `fix/dpdp-data-location-accuracy` amended to interim wording (§8), all 11 languages
- [ ] Post-migration wording staged for flip after verification

**Cross-cutting**
- [ ] `npm run predeploy` (typecheck + build) green on every PR
- [ ] `scripts/audit-deployments.sh` run before AND after each deploy
- [ ] No direct-to-main commits; `develop` integration; `--no-ff` merges

---

## 10. Rollback summary (per phase, all reversible)

| Phase | Rollback | Window |
|---|---|---|
| A (Cloud Run) | Shift LB traffic back to asia-southeast1 NEG / old revision | seconds |
| B (Storage) | Flip `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` to old bucket + redeploy; both buckets hold objects | minutes |
| C (RTDB) | Re-point to Singapore RTDB URL + redeploy (if C1 had been done) | minutes |

No phase deletes the source until a 30-day (storage) / 7-day (compute) soak passes. **Nothing is destructive until verified.**

---

## 11. Cost & residual notes
- Storage Transfer Service + one-time egress US→Mumbai: ~$0.08–0.12/GB egress; size from P2.
- Mumbai storage/compute pricing ≈ comparable to Singapore; latency to Indian users improves.
- Keeping the old US bucket 30 days adds ~1 month of its storage cost — negligible insurance.
- Firestore: **zero migration cost** (already in region).
- If C1: Firestore write cost for presence/typing — validate in staging before prod.
