# Verification Proofs & Follow-up Tasks — SP-18, SP-10, SP-11, SP-17 (2026-11-28)

All code, diagram, and test proofs below were executed locally on `c:\Users\sachi\Downloads\sahayakai` and verified in GitHub CI. No live PSTN calls were placed to `+91 7384273605` (per instruction: do not call the test number right now).

---

## 1. GitHub Pull Requests & Commits (Links)

| Item | Link | Status |
|---|---|---|
| **PR #245** (`feat/sampark-sp10-sp11-sp17-sp18` → `main`) | https://github.com/sargupta/sahayakai/pull/245 | Open (awaiting review by `sargupta` / `Alyssa-286`) |
| Commit 1 (`fix(telephony)` — Exotel `flush_idle` + PCM16 helpers) | https://github.com/sargupta/sahayakai/commit/71174b9b | Pushed |
| Commit 2 (`docs(sampark)` — Call-flow diagram, Exotel findings, proofs) | https://github.com/sargupta/sahayakai/commit/d9a5ec6a | Pushed |
| Commit 3 (`feat(sampark)` — AtithiVani & Placement World flows + tests) | https://github.com/sargupta/sahayakai/commit/86f90ae7 | Pushed |
| Commit 4 (`chore(sampark)` — SP-17 benchmark script & scoring table) | https://github.com/sargupta/sahayakai/commit/34ca3aed | Pushed |
| **PR #218** (`feat/sampark-suppression-reversal` — H4 reversal + audit trail) | https://github.com/sargupta/sahayakai/pull/218 | Updated with `main` ([`d7debe99`](https://github.com/sargupta/sahayakai/commit/d7debe99)) |
| **PR #232** (`feat/m3-i18n-ci-gate` — M3 i18n source audit) | https://github.com/sargupta/sahayakai/pull/232 | Open, all CI gates green |
| **PR #230** (`feat/sampark-exotel-calls-fixed`) | https://github.com/sargupta/sahayakai/pull/230 | **Closed** (superseded by PR #221 on `main` & PR #245) |

---

## 2. Live GitHub Actions & Cloud Build Proofs

### PR #245 CI Checks
- `pytest (blocking gate)` — **PASS** (3m11s): https://github.com/sargupta/sahayakai/actions/runs/46133765733/job/140944438354
- `ruff · mypy` — **PASS** (36s): https://github.com/sargupta/sahayakai/actions/runs/46133765733/job/140944438258
- `TS codegen drift` — **PASS** (19s): https://github.com/sargupta/sahayakai/actions/runs/46133765733/job/140944438470
- `smoke` — **PASS** (5m54s): https://github.com/sargupta/sahayakai/actions/runs/46133765701/job/140944438516
- `Gate 6: typecheck` — **PASS** (1m42s): https://github.com/sargupta/sahayakai/actions/runs/46133765764/job/140944438463
- `Gate 9: i18n keys (ratchet)` — **PASS** (1m55s): https://github.com/sargupta/sahayakai/actions/runs/46133765764/job/140944438511
- `Gate 11: design tokens` — **PASS** (11s): https://github.com/sargupta/sahayakai/actions/runs/46133765764/job/140944438464
- `Gate 1, 2, 5, 8, 10, 12` & `GitGuardian` — **PASS**: https://github.com/sargupta/sahayakai/actions/runs/46133765764
- `test (20)` (in progress): https://github.com/sargupta/sahayakai/actions/runs/46133765710/job/140944438342
- `sahayakai-ci-gate` (in progress): https://console.cloud.google.com/cloud-build/builds/41b8b970-8f9f-4c05-8b1b-5a429f37925b?project=640589855975

### PR #218 CI Checks (after merging `main` `d7debe99`)
- `Gate 9: i18n keys (ratchet)` — **PASS** (1m53s, previously failing): https://github.com/sargupta/sahayakai/actions/runs/46134034417/job/140945252454
- `Gate 6: typecheck` — **PASS** (1m58s): https://github.com/sargupta/sahayakai/actions/runs/46134034417/job/140945252643
- `Gate 1, 2, 5, 8, 10, 11, 12` & `GitGuardian` — **PASS**: https://github.com/sargupta/sahayakai/actions/runs/46134034417
- `test (20)` (in progress): https://github.com/sargupta/sahayakai/actions/runs/46134034424/job/140945252223
- `sahayakai-ci-gate` (in progress): https://console.cloud.google.com/cloud-build/builds/af045983-bd68-4119-862d-485c5ed394db?project=640589855975

### PR #232 CI Checks
- All checks **PASS** (including `test (20)` 15m49s, `smoke` 5m49s, `sahayakai-ci-gate` 31m38s): https://github.com/sargupta/sahayakai/actions/runs/45687478799

---

## 3. Local Verification Proofs

- **Python telephony unit tests (`sahayakai-agents`):**
  `python -m pytest --noconftest tests/unit/test_telephony_carriers.py tests/unit/test_telephony_audio.py -v` → **43 passed in 1.28s**
- **TypeScript (`sahayakai-main`):** `npx tsc --noEmit` → **exit 0**
- **Jest (`sahayakai-main`):**
  - PR #245 suites (`atithivani-flow.test.ts` + `placement-world-flow.test.ts`) → **2/2 suites, 9/9 tests passed**
  - PR #218 suites (`attendance-call-refusals-gate.test.ts` + `api/sampark/routes.test.ts`) → **2/2 suites, 171/171 tests passed**
- **CI scripts:** `check-design-tokens.mjs` (**523 <= 523**), `find-missing-i18n-keys.mjs --no-write` (**0 missing keys**), `carrier-benchmark.mjs --carrier vobiz --runs 5 --to +917384273605 --dry-run` (**passed**).

---

## 4. Additional Recommended Tasks (For Tracker Backlog)

| Suggested ID | Task | Priority | Details / Acceptance Criteria |
|---|---|---|---|
| **SP-19** | Wire direct PCM16 runtime path for Exotel (`EXOTEL_DIRECT_PCM16`) | High | Update `router.py` (`_pump_carrier_to_live` & `_pace_outbound`) to invoke `pcm8k_le_to_pcm16k` + `pcm24k_to_pcm8k_le` + `ExotelCodec.play_pcm8k_le` when carrier is `exotel`; compare MOS/WER against μ-law path. |
| **SP-20** | Test Exotel Mumbai cluster (`api.in.exotel.com`) vs Singapore (`api.exotel.com`) | Medium | Measure WebSocket jitter and `first_audio_ms` between Cloud Run (`asia-south1`) and both Exotel endpoints. |
| **SP-21** | Add AtithiVani Next.js API routes + Firestore `atithivani_feedback_results` adapter & deploy to staging | High | Expose authenticated `POST /api/sampark/atithivani/prepare` & `/feedback` routes backed by Firestore, completing SP-10 *"feedback result is saved"* in staging. |
| **SP-22** | Add Placement World Plivo webhook route + ingest client screening recordings | High | Wire `/api/webhooks/plivo-placement/` with `PLIVO_FROM_NUMBER=+918065522006`, align question order to client recordings, and get native Hindi/Bengali review. |
| **SP-23** | Provision `GCPSAREADONLYKEY` & migrate `SAMPARKPIIKEY` to Secret Manager (Review C2 / L2) | High | Unblocks Gate 3 Cloud Run `service.yaml` drift detection and removes `SAMPARKPIIKEY` raw env dependency. |
| **SP-24** | Split `router.py` (~5,100 lines) into focused telephony modules (Review M4) | Medium | Extract admission/auth, pacer/audio loop, and carrier lifecycle out of `router.py` for unit testability. |
| **SP-25** | Close/rebase stale PR backlog & document branch protection (Review L3 / L4) | Medium | Triage PRs >60 days old (e.g., #66, #90, #114, #115, #128, #152) and document PR review/merge rules. |
