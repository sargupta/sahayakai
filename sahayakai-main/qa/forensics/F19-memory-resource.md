# F19 — Memory & Resource Exhaustion Forensics

**Investigator role:** Memory + resource exhaustion (Role 6, 4 sub-specialties).
**Date:** 2026-06-06
**Scope:** Next.js dispatcher (`sahayakai-main`) + Python sidecar (`sahayakai-agents`).
**Cloud Run sidecar config:** `memory: 1Gi` (`deploy/service.yaml:56`).

---

## Summary

| # | Sub-specialty                                   | Finding ID | Severity | State                                 |
|---|-------------------------------------------------|------------|----------|---------------------------------------|
| 1 | Sidecar memory profile (50× lesson-plan)        | F19-01     | INFO     | Not exercised (live load test deferred) |
| 2 | Next.js dispatcher heap across calls            | F19-02     | INFO     | No leak surface in code                |
| 3 | Embedding cache `qa/embedding-cache/`           | F19-03     | INFO     | Directory does not exist               |
| 4 | OIDC token cache in dispatcher                  | F19-04     | INFO     | Bounded by env var (1 entry/client × 18 clients) |
| 5 | Notification batch fan-out                      | F19-05     | INFO     | Hard-capped at 50 recipients           |
| 6 | Pub/Sub storage-cleanup ack rules               | F19-06     | INFO     | Acks only on success — correct         |
| 7 | Long-text TTS (50,000 char input)               | **F19-07** | **P1**   | Unbounded parallel fan-out + buffer    |
| 8 | Audio upload (100 MB)                           | **F19-08** | **P2**   | 10 MB cap but `formData()` fully buffers |
| 9 | TTS audio cache (bonus)                         | **F19-09** | **P2**   | 500 entries × up to ~600 KB each       |

**P0:** none confirmed. No active OOM, no monotonic leak in static analysis.
**P1:** 1 (F19-07).
**P2:** 2 (F19-08, F19-09).

`gcloud monitoring metrics` for live sidecar memory utilisation was not exercised in this forensic pass — no `gcloud` impersonation token was available in the sandbox. The static-analysis verdict for §1 and §2 is "no leak surface in code"; live confirmation is queued as F19-FOLLOWUP-01 below.

---

## F19-01 / F19-02 — Sidecar + dispatcher per-request memory

**Surface inspected:**
- `sahayakai-agents/src/sahayakai_agents/agents/lesson_plan/router.py` — `run_lesson_plan_orchestration`.
- `sahayakai-agents/src/sahayakai_agents/main.py` (FastAPI app).
- Every `*-dispatch.ts` and `*-client.ts` in `sahayakai-main/src/lib/sidecar/`.

**Findings:**
1. Lesson-plan router constructs `InMemoryRunner(agent=…, app_name=…)` per request (router.py:129). `InMemoryRunner` instantiates its own `InMemorySessionService` (private to the runner). Sessions live in `self.sessions: dict[str, dict[str, dict[str, Session]]]` (`google/adk/sessions/in_memory_session_service.py:71`). Because the runner is a local variable inside the request handler, it (and its session dict) are garbage-collected once the response is returned. **No process-global session map.**
2. Module-level caches in the sidecar are `@lru_cache(maxsize=1)` (occasionally `maxsize=2` for assessment-scanner). Bounded by definition.
3. Dispatcher `*-client.ts` modules each declare `const tokenClientByAudience = new Map<string, Promise<IdTokenClient>>()`. The key is `process.env.SAHAYAKAI_AGENTS_AUDIENCE` (a single value per process). 18 client modules → at most **18 cached `IdTokenClient` instances per Next.js process**. Constant.
4. No request-keyed map in the dispatcher (no `Map<requestId, …>`, no in-flight registry).

**Verdict:** static analysis shows no monotonic-growth surface. Live profile (50× POST to `/v1/lesson-plan/generate`, watch `run.googleapis.com/container/memory/utilizations`) is the empirical confirmation but was not executed in this pass — see F19-FOLLOWUP-01.

---

## F19-03 — Embedding cache on disk

```
$ ls /Users/sargupta/SahayakAIV2/sahayakai/sahayakai-main/qa/embedding-cache
ls: No such file or directory
```

`rag/embeddings.py:embed_query` is a `raise NotImplementedError` stub (Phase 4.2 not landed). No embedding traffic, no on-disk cache.

**Verdict:** INFO — non-issue until Phase 4.2 lands; flag for re-review then.

---

## F19-04 — OIDC `tokenClient` cache

Pattern (`lesson-plan-client.ts:110-122`, replicated across 17 other clients):

```ts
const tokenClientByAudience = new Map<string, Promise<IdTokenClient>>();
async function getTokenClient(audience: string): Promise<IdTokenClient> {
  let cached = tokenClientByAudience.get(audience);
  if (!cached) {
    const auth = new GoogleAuth();
    const p = auth.getIdTokenClient(audience);
    p.catch(() => tokenClientByAudience.delete(audience));
    tokenClientByAudience.set(audience, p);
    cached = p;
  }
  return cached;
}
```

**Audience source:** `process.env.SAHAYAKAI_AGENTS_AUDIENCE` (env var, single value per Cloud Run process). Map will hold exactly **one entry** in steady state. Eviction-on-rejection prevents poison-on-cold-start.

**Verdict:** INFO. Bounded by env-var cardinality. No leak.

---

## F19-05 — Notification batch fan-out

`src/lib/notifications/fanout.ts:23`:
```ts
const RECIPIENT_CAP = 50;
…
const candidatesSnap = await query
    .orderBy('createdAt', 'desc')
    .limit(RECIPIENT_CAP * 2)
    .get();
…
const trimmed = candidates.slice(0, RECIPIENT_CAP);
…
const batch = db.batch();          // Firestore batch, 500/batch limit
for (const r of recipients) { … batch.set(ref, doc); }
await batch.commit();
```

Firestore-side `limit(100)`, JS-side `slice(0, 50)`, single Firestore batch (well under the 500/batch ceiling). No unbounded `forEach.*push` or `map.*notifications` paths found in `src/app/api`, `src/app/actions`, or `src/lib/notifications`.

**Verdict:** INFO. Properly bounded.

---

## F19-06 — Pub/Sub storage-cleanup ack rules

`src/app/api/jobs/storage-cleanup/route.ts`:
- Returns `200` only on successful GCS delete or on 404 (already-absent, idempotent success).
- Returns `500` on any other error → Pub/Sub nacks → retry up to configured `max-delivery-attempts=5`, eventually DLQ.
- `404` is treated as success and acked — correct (file already deleted).
- `storagePath` missing → returns `200 { skipped: true }` — acks correctly.

**Verdict:** INFO. Ack discipline is correct; no risk of redelivery storms or silent message loss.

---

## F19-07 — **P1: Long-text TTS unbounded parallel fan-out**

**File:** `src/app/api/tts/route.ts`
**Helper:** `src/lib/sarvam.ts:chunkText`, `concatBase64Mp3`.

**Issue:**
- The route imposes **no upstream length limit** on `text`. The first 401 / 400 / 413 check is absent for length.
- `googleTTS(cleanText, …)` chunks at `GOOGLE_TTS_CHUNK_TARGET_CHARS = 500` and fires **`Promise.all(chunks.map(googleTTSOne))`** with **no concurrency cap** (route.ts:182-184).
- A 50,000-char request → **100 simultaneous `fetch` calls** to `texttospeech.googleapis.com`, each holding a base64 MP3 (~6 KB to ~50 KB per chunk depending on lang/voice) in memory before concatenation.
- The Sarvam path is the same shape (`sarvam.ts:187 chunks = chunkText(text, TTS_CHUNK_TARGET_CHARS)` then `Promise.all`).
- Peak transient buffer: ~5–50 MB held in flight per request, multiplied by request concurrency. With Cloud Run default concurrency of 80, **a single coordinated burst (e.g. attacker sends 10 parallel 50k-char POSTs) can pin > 500 MB transient buffer + 100×80 = 8,000 concurrent outbound Google TTS connections**, easily exhausting upstream rate limits and the Node `undici` connection pool. Sustained, this triggers a 502/503 storm rather than a clean 429.

**Severity:** P1 (unbounded array buffer + unbounded outbound fan-out per request; no quota gate against `text.length`).

**Recommended fix:**
1. Reject `text.length > N` (suggest `N = 8000` — matches a long VIDYA monologue) with `413` before any provider call.
2. Replace `Promise.all` with a `p-limit`-style concurrency gate (e.g. `concurrency = 4`) so 50k-char abuse still works, just slowly.
3. Track `cleanText.length` against the voice-quota gate **before** chunking so callers cannot circumvent minute-billing by sending one giant call.

**Repro (untested live):**
```bash
TEXT=$(python3 -c "print('हे शिक्षक. ' * 5000)") # ~55,000 chars Devanagari
curl -X POST https://<host>/api/tts \
  -H "Authorization: Bearer $ID_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"text\":\"$TEXT\",\"targetLang\":\"hi-IN\"}" &
# Send ×10 in parallel; watch Cloud Run /container/memory/utilizations
# and /v1/projects/<proj>/serviceQuotas for TTS.
```

---

## F19-08 — **P2: Audio upload buffers fully into memory**

**File:** `src/app/api/ai/voice-to-text/route.ts:16-41`.

```ts
const formData = await request.formData();  // ← fully buffers
const audioFile = formData.get('audio') as File | null;
…
const MAX_AUDIO_BYTES = 10 * 1024 * 1024;
if (audioFile.size > MAX_AUDIO_BYTES) { return 413; }
```

**Issue:**
- The 10 MB cap is enforced **after** `await request.formData()` resolves, i.e. after the entire body has been read into memory. A 100 MB upload from an unauthenticated-but-CSRF-armed client (or any authenticated abuser) **forces the Node process to hold 100 MB transiently** before the 413 is returned.
- Multiplied by Cloud Run concurrency (default 80) this can spike RSS by 8 GB in the dispatcher container (which is provisioned at far less). A Cloud Run instance with 1 Gi memory OOMs immediately under coordinated 50 MB uploads × 20 concurrent.
- Other upload paths (`/api/transcribe`, `/api/instant-answer/upload-image` if any) should be audited the same way.

**Severity:** P2 (unbounded transient memory until streaming reject is in place).

**Recommended fix:**
- Use `Content-Length` header check first: reject `> MAX_AUDIO_BYTES * 1.1` before `formData()`.
- Long-term: stream the upload directly to GCS and pass the GCS URI to the STT path.

**Repro:**
```bash
dd if=/dev/urandom of=/tmp/big.webm bs=1M count=100
curl -X POST https://<host>/api/ai/voice-to-text \
  -H "Authorization: Bearer $ID_TOKEN" \
  -F "audio=@/tmp/big.webm;type=audio/webm"
# Expect 413, but the dispatcher's memory utilisation should spike before the response.
```

---

## F19-09 — **P2: TTS audio cache size**

**File:** `src/lib/cache.ts:8-33`.

```ts
const TTS_CACHE = new Map<string, CacheEntry>();
const MAX_CACHE_ITEMS = 500;
…
export function setCachedAudio(key: string, buffer: string): void {
    if (TTS_CACHE.size >= MAX_CACHE_ITEMS) { …delete first key… }
    TTS_CACHE.set(key, { buffer, timestamp: Date.now() });
}
```

**Issue:** entry count is bounded (500) but **byte size is not**. `buffer` is a base64-encoded MP3 string of an entire synthesised utterance. With F19-07 unfixed, an attacker can populate the cache with 500 × ~600 KB entries = ~300 MB resident on a single Cloud Run instance, all surviving 24 h (`MAX_CACHE_AGE_MS`). On the dispatcher's typical 512 MiB profile this is OOM territory.

**Severity:** P2 (unbounded-byte cache; mitigated by 24 h TTL and 500-entry count, but item size is uncapped).

**Recommended fix:**
- Track cumulative byte size; evict on `bytes > N` (e.g. 64 MiB) in addition to item count.
- Or: cap per-entry buffer size (`if (buffer.length > 256 * 1024) return; // don't cache giants`).

---

## F19-FOLLOWUP-01 — Live memory profile (deferred)

The forensic plan calls for "50 sequential calls to /v1/lesson-plan/generate, watch Cloud Run memory utilization". This was not exercised because:
- `gcloud auth print-access-token` and impersonation were not validated in the forensic sandbox.
- The lesson-plan endpoint is gated by HMAC signing (`SAHAYAKAI_REQUEST_SIGNING_KEY`) + OIDC + App Check; reproducing the call shape requires the live dispatcher's signing helper.

Static analysis identifies **no in-process retention surface**. Recommend the next forensic pass run the 50-shot load test via the dispatcher itself (warm `/api/ai/lesson-plan`) while polling:

```bash
gcloud monitoring time-series list \
  --filter='metric.type="run.googleapis.com/container/memory/utilizations" AND resource.labels.service_name="sahayakai-agents"' \
  --interval-start-time=…
```

Expected steady state on 1 Gi: peaks ≤ 60 %, plateau within 5 requests. **Flag P0 if utilisation grows monotonically past the 10th request.**

---

## findings.json

See `qa/forensics/F19-findings.json`.

## Repros

See `qa/forensics/F19-repros/`:
- `repro-F19-07-long-text-tts.sh`
- `repro-F19-08-large-audio-upload.sh`
- `repro-F19-09-tts-cache-flood.sh`
