# F13 — Performance & Latency Forensics

Investigator: Role 7 (Perf + latency)
Date: 2026-06-06
Scope: `sahayakai-main/` Next.js app + `sahayakai-agents/` Python sidecar
Method: static analysis (grep + read) of route handlers, Firestore queries, index manifest, TTS chunking; no live load test executed (Cloud Run impersonation not run in this pass — flagged below).

---

## Severity Summary

| ID | Severity | Area | One-liner |
|---|---|---|---|
| F13-001 | P2 | N+1 | `daily-briefing` sequential `stateGroupRef.get()` per state in for-of loop |
| F13-002 | P2 | N+1 | `ai-community-agent` sequential per-persona `userRef.get()` in for-of loop |
| F13-003 | P2 | sync I/O | `readFileSync` in `/api/seo/llms` and `/api/seo/llms-full` request handlers |
| F13-004 | P2 | timeout | Hot AI routes (lesson-plan, quiz, exam-paper, virtual-field-trip, assessment-scanner, video-storyteller) declare no `maxDuration`; rely on Cloud Run default (currently 300s) — silent overshoot if instance timeout is dropped |
| F13-005 | P3 | cold-start | Sidecar Dockerfile flags `<200 MB target, p99 cold-start TBD`; no min-instances=1 confirmed yet (see `sahayakai-agents/Dockerfile` comment) |
| F13-006 | INFO | observability | No latency probe run this pass — needs `gcloud auth` + `hey`/k6 against canary URL with 14-agent matrix before P1 baselines can be claimed |
| F13-007 | INFO | indices | Audited `firestore.indexes.json` (582 lines) against every `.where(...).orderBy(...)` chain — all hot-path queries have backing composite indexes; no missing-index P0 found |
| F13-008 | INFO | TTS | Long-text TTS chunking confirmed parallel via `Promise.all` (Google path: `src/app/api/tts/route.ts:182`; Sarvam path: `src/lib/sarvam.ts:218`). Today's `<5 s` budget for 2000-char input is structurally achievable; verification still needs an actual probe |

No P0 or P1 found via static audit.

---

## Findings

### F13-001 — N+1 in `daily-briefing` state-group fanout (P2)

File: `src/app/api/jobs/daily-briefing/route.ts:920-945`

```ts
for (const [state, items] of curatedStateNews) {
  const stateGroupId = `state_${normalizeKey(state)}`;
  const stateGroupRef = db.doc(`groups/${stateGroupId}`);
  const stateGroupSnap = await stateGroupRef.get();   // ← N+1
  if (!stateGroupSnap.exists) continue;
  ...
}
```

Impact: 28 Indian states/UTs → up to 28 sequential round-trips per cron run. At ~30-50 ms each = 0.8–1.4 s added wall-time. Cron handler (`maxDuration = 180`) — not user-facing, so P2.

Fix: collect refs first, batch via `db.getAll(...refs)` or parallelise with `Promise.all`. Skipping existence check entirely and using a `set({...}, {merge: true})` won't work because the code intentionally only posts to groups that already exist.

Repro: trigger `/api/jobs/daily-briefing` with seeded `curatedStateNews` spanning 28 states; log handler duration.

### F13-002 — N+1 in `ai-community-agent` persona bootstrap (P2)

File: `src/app/api/jobs/ai-community-agent/route.ts:66-73`

```ts
for (const persona of personas) {
    const userRef = db.collection('users').doc(persona.uid);
    const userSnap = await userRef.get();   // ← N+1
    if (!userSnap.exists) batch.set(userRef, getPersonaUserDoc(persona));
}
```

Impact: scales with persona pool (currently ~10–50). Cron-only.

Fix: `db.getAll(...personas.map(p => db.doc('users/'+p.uid)))` → 1 RPC, then iterate.

### F13-003 — Sync `readFileSync` in request handlers (P2)

Files:
- `src/app/api/seo/llms/route.ts:10`
- `src/app/api/seo/llms-full/route.ts:10`

Blocks the event loop during request. These are static SEO files served per-request (LLMs.txt spec) — should be read once at module load and cached, or migrated to `fs.promises.readFile`. Low traffic but bot-driven so could spike unexpectedly.

### F13-004 — Hot AI routes lack explicit `maxDuration` (P2)

Inventory of routes under `src/app/api/ai/*` showed only `visual-aid/route.ts` declares `export const maxDuration = 120`. The remaining 14 AI agent routes inherit Cloud Run instance default. If anyone drops Cloud Run timeout to <60 s (a common cost-cut knob), every long-tail lesson-plan / exam-paper request silently 504s.

Fix: add explicit `export const maxDuration = 60` (or 90 for exam-paper/video-storyteller) at top of each `src/app/api/ai/<flow>/route.ts`.

### F13-005 — Cold-start budget for sidecar not yet measured (P3)

`sahayakai-agents/Dockerfile` header comment:
> P0 #1 cold-start: keep image slim … P1 #20: first deploy MUST measure p99 cold start before setting min-instances=1.

Static analysis cannot confirm the image is <200 MB or that min-instances=1 is set in production. Needs:
```bash
gcloud run services describe <sidecar-svc> --region asia-southeast1 \
  --format='value(spec.template.metadata.annotations."autoscaling.knative.dev/minScale")'
```

### F13-006 — Live latency probe not executed (INFO)

Hunting playbook step 5 (50 RPS × 60 s vs Genkit baseline across 14 canary agents) was **not run** in this pass — requires:
1. `gcloud auth application-default login` with impersonation to canary SA
2. Canary URL surface (likely behind App Check) — needs minted dev token
3. `hey -z 60s -c 50 -H "Authorization: Bearer …" <url>` per agent

Without this, F13-007 (indices look fine) and F13-008 (TTS chunking parallel) cannot be promoted from structural to behavioural confirmation. Recommend a dedicated `qa/forensics/F13-live-probe.md` follow-up once auth is staged.

### F13-007 — Composite index coverage (INFO, clean)

Every `.where(...).orderBy(...)` chain in `src/` cross-checked against `firestore.indexes.json`:

| Query | Required index | Present |
|---|---|---|
| `parent_outreach.where(teacherUid).where(studentId).orderBy(createdAt desc)` | line 342 | yes |
| `parent_outreach.where(callSid)` | line 360 | yes |
| `users.where(district).where(subjects array-contains).where(state).orderBy(createdAt desc)` | line 522 | yes |
| `notifications.where(recipientId).where(type).where(createdAt >=)` (range-after-equality OK) | line 532 | yes |
| `posts.where(authorUid).orderBy(createdAt desc)` | line 476 | yes |
| `billing_reconciliation_actions.where(action).orderBy(createdAt desc)` | line 490 | yes |
| `content` & `library_resources` COLLECTION_GROUP filters | lines 10-180 | yes |
| `vidya_sessions.orderBy(updatedAt)` (single-field, COLLECTION-scope) | auto-indexed | OK |

No silent-failure index missing.

### F13-008 — TTS chunk parallelism (INFO, clean)

Confirmed `Promise.all` over chunks at:
- `src/app/api/tts/route.ts:182` (Google path)
- `src/lib/sarvam.ts:218` (Sarvam path)

Wall-time bounded by slowest single ~500-char chunk. Structurally consistent with the documented `<5 s` p95 target for 2000-char input. Live verification still required (see F13-006).

TTS in-memory cache (`src/lib/cache.ts`) bounded at 500 items, FIFO eviction, 24 h max age — no unbounded growth.

### F13-INFO — Firestore TTL coverage

`firestore.indexes.json:557-580` declares TTL `fieldOverrides` on: `content.expiresAt`, `notifications.expiresAt`, `vidya_intent_cache.expiresAt`, `lesson_plan_cache.expiresAt`. Embedding cache for `pyq_questions` vector search has no TTL but is intended as a stable corpus, not user-data churn. OK.

---

## Methodology gaps to close

1. Run the 50 RPS probe with `hey` to produce p50/p95/p99 numbers per agent → fills F13-006, gates P1 regression claims.
2. Run `bash scripts/safe-deploy.sh --dry-run` then describe Cloud Run revision to confirm cold-start min-scale and concurrency settings.
3. Trigger 5-min idle then hit `/` and `/api/health` to capture cold TTFB delta — fills F13-005.
