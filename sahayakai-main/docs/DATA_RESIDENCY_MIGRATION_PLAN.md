# Data Residency Migration Plan — Singapore (asia-southeast1) → India

**Status:** PLAN ONLY. No region move has been performed. This document is the
implementation plan the governance ledger commits us to; executing it is a
separate, human-approved infrastructure project.

**Owner:** Abhishek Gupta / SARGVISION Intelligence Pvt. Ltd.
**Created:** 2026-06-10
**Driver:** DPDP Act 2023 + governance honest-ledger gap #1. Our users are Indian
teachers handling data about minors. Today all primary stores run in Google
Cloud **Singapore (`asia-southeast1`)**, governed by Singapore's PDPA, with a
cross-border transfer of personal data out of India. Moving to an India region
(`asia-south1` Mumbai or `asia-south2` Delhi) removes the cross-border transfer
and aligns storage with the jurisdiction whose law we are accountable to.

---

## 1. Current state (verified 2026-06-10)

| Layer | Service | Region today | India target |
|---|---|---|---|
| App compute | Cloud Run `sahayakai-hotfix-resilience` | `asia-southeast1` | `asia-south1` |
| Firestore (primary DB) | Firestore native | `asia-southeast1` | `asia-south1` |
| Realtime Database | RTDB `sahayakai-b4248-default-rtdb` | `asia-southeast1` | `asia-south1` |
| Cloud Storage (GCS) | default + asset buckets | `asia-southeast1` | `asia-south1` |
| Secret Manager | secrets | (multi/auto) | replicate to `asia-south1` |
| AI inference | Gemini, Sarvam, (Bhashini) | provider-side, cross-border | unchanged (disclosed) |

Region references found in code/config:
- `src/lib/firebase.ts:54` — RTDB URL hard-codes `asia-southeast1`.
- Several `src/app/api/jobs/*` route comments reference `asia-south1` in example
  Cloud Scheduler commands (docs only, not live config).
- Live Cloud Run region is set at deploy time (`scripts/safe-deploy.sh`,
  `--region asia-southeast1`) — see project memory.

> **Hard blocker:** Firestore and RTDB **location is immutable after database
> creation.** You cannot "move" the existing database to India. Migration =
> create a new India-region database/project and copy data into it, then cut
> over. This is the central reason this is a project, not a config flip.

---

## 2. Migration options (enumerated, with trade-offs)

### Option A — New India-region databases inside the *same* GCP project
Create a second Firestore database (multi-database is supported) and a new RTDB
instance in `asia-south1`; migrate data; repoint the app.
- **Pros:** No new project/billing setup; IAM and secrets stay put; smallest org
  change.
- **Cons:** Firestore *named* databases differ from the `(default)`; some legacy
  Admin SDK call sites assume the default DB and must be audited. Storage default
  bucket region is fixed at project creation, so GCS still needs a new bucket.

### Option B — New India-region GCP project (clean `sahayakai-in`)
Stand up a parallel project entirely in `asia-south1`, migrate data, then move
DNS/traffic.
- **Pros:** Cleanest residency story (everything in one India project); easy to
  prove to a regulator; default Firestore + default GCS bucket both India-region.
- **Cons:** Largest effort — re-create IAM, service accounts, Secret Manager,
  Cloud Scheduler, Pub/Sub, budgets, Cloud Armor; re-issue all SA keys; dual-run
  cost during cutover.

### Option C — Stay in Singapore, rely on disclosed consent (status quo)
- **Pros:** Zero migration work; already disclosed in Terms + analytics consent.
- **Cons:** Does not satisfy the governance commitment; cross-border transfer of
  minors' data persists; weaker posture for B2G/SCERT deals that may require
  India residency.

**Recommendation: Option B** for the end state (cleanest regulatory story and the
strongest B2G position), executed via the phased dual-write/backfill approach in
§3 so there is no hard downtime. Option A is the acceptable faster fallback if a
second project is operationally too heavy near a deadline.

---

## 3. Phased execution plan (zero/low-downtime)

**Phase 0 — Pre-work (no user impact)**
- Inventory every collection (Firestore), RTDB path, and GCS prefix.
- Audit Admin SDK call sites for hard-coded `(default)` DB assumptions and the
  `asia-southeast1` RTDB URL in `src/lib/firebase.ts:54`.
- Decide Option A vs B; provision the India-region project/database/buckets.
- Replicate Secret Manager secrets to `asia-south1`.

**Phase 1 — Dual-write**
- Deploy a write path that writes to BOTH Singapore (current) and India (new)
  for Firestore + RTDB + new GCS uploads. Reads still served from Singapore.
- Gated behind a feature flag (`system_config/feature_flags`) so it can be turned
  off instantly if latency regresses.

**Phase 2 — Backfill**
- Bulk-copy historical data: Firestore managed export/import
  (`gcloud firestore export` → import into the India database), RTDB JSON
  export/import, GCS `gsutil -m rsync` Singapore bucket → India bucket.
- Reconcile counts; verify a sampled set of docs/objects matches byte-for-byte.

**Phase 3 — Read cutover**
- Flip reads to the India region behind the same flag. Monitor latency (Indian
  users should see *lower* latency from `asia-south1`) and error rates.
- Keep dual-write on as a safety net.

**Phase 4 — Compute cutover**
- Redeploy Cloud Run to `asia-south1` via `scripts/safe-deploy.sh --region asia-south1`
  (script's region default must be updated). Move Cloud Scheduler jobs and
  Pub/Sub subscriptions to the India region.
- Update `src/lib/firebase.ts` RTDB URL to the India instance.

**Phase 5 — Decommission + verify**
- Stop dual-write; make India the sole store.
- Delete Singapore databases/buckets only AFTER a verified retention window.
- Run the lifecycle audit-log jobs against the India project so the
  `audit_log` trail is continuous.

**Phase 6 — Update disclosures**
- Reverse the Singapore disclosures added on 2026-06-10: Terms "Cross-border
  storage and processing" clause and the analytics-consent dialog lines now
  truthfully change to "stored and processed in India (`asia-south1`)". Update
  the 11-language translations in `src/context/language-context.tsx`. AI-inference
  cross-border disclosure (Gemini/Sarvam) REMAINS — those providers are still
  cross-border and must stay disclosed.

---

## 4. Rollback

Each phase is flag-gated and reversible until Phase 5:
- Phase 1–4: flip the feature flag back to Singapore-only reads/writes.
- Phase 5 is the point of no easy return — do NOT delete Singapore stores until
  India has served production reads cleanly for a full retention cycle and
  exports are archived.

## 5. Risks

- **Latency/cost during dual-run** — two regions billed simultaneously for the
  migration window. Budget for it; watch the budget kill-switch chain.
- **Hidden default-DB assumptions** — Option A risk; mitigated by the Phase 0
  call-site audit.
- **AI inference stays cross-border** — Gemini/Sarvam/Bhashini are not moved by
  this plan. The residency claim after migration must be scoped to *stored
  account data*, not inference. Keep that distinction in the Terms copy.
- **Immutable region** — re-confirm: you cannot edit an existing Firestore/RTDB
  region; the whole plan hinges on copy-and-cutover, not an in-place move.

## 6. Out of scope for this document

The actual execution. This is the plan the user explicitly scoped as "doc +
plan only" on 2026-06-10. No region move, no new project, and no data copy has
been performed.
