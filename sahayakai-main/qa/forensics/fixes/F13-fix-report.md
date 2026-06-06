# F13 Performance Fix Report

**Branch:** `fix/F13-performance` (off `develop`)
**Reference:** `qa/forensics/F13-performance.md`
**Date:** 2026-06-06

Four P2 performance items addressed. All changes typecheck clean (`npm run typecheck`) and have unit-test coverage where applicable.

---

## F13-001 — N+1 in daily-briefing state posting

**File:** `src/app/api/jobs/daily-briefing/route.ts` (~line 939)

**Before:** for-of over `curatedStateNews` (up to 28 entries) called `await stateGroupRef.get()` sequentially — up to 28 serial Firestore round-trips per cron run.

**After:** all state group refs collected first, then a single `db.getAll(...refs)` reads them in one network round-trip. Existence checked from the resulting snapshot map.

```ts
const stateEntries = Array.from(curatedStateNews);
const stateRefs = stateEntries.map(([state]) =>
  db.doc(`groups/state_${normalizeKey(state)}`),
);
const stateSnaps = stateRefs.length > 0 ? await db.getAll(...stateRefs) : [];
const existingStateGroups = new Set<string>();
stateSnaps.forEach((snap, idx) => {
  if (snap.exists) existingStateGroups.add(stateRefs[idx].path);
});
```

Per-state write batches are unchanged (each state still gets its own translation + post). Only the existence-check fan-out was batched.

**Expected impact:** daily-briefing cron read-phase drops from O(N) round-trips to O(1). At 28 states, expect ~1s+ savings on the read side.

---

## F13-002 — N+1 in ai-community-agent profile bootstrap

**File:** `src/app/api/jobs/ai-community-agent/route.ts:61` (`ensureAITeacherProfiles`)

**Before:** for-of over personas called `await userRef.get()` per persona.

**After:** all user refs built first, single `db.getAll(...userRefs)`, then iterate the result array to decide which docs to `batch.set()`.

```ts
const userRefs = personas.map((p) => db.collection('users').doc(p.uid));
const userSnaps = await db.getAll(...userRefs);
// …iterate, batch.set missing ones, single batch.commit() at the end
```

Behaviour preserved: only missing user docs are written, and the batch is only committed when `created > 0`.

---

## F13-003 — `readFileSync` in SEO route handlers

**Files:**
- `src/app/api/seo/llms/route.ts`
- `src/app/api/seo/llms-full/route.ts`

**Before:** `fs.readFileSync(filePath, 'utf-8')` on every request — blocks the Node event loop for the duration of the disk read. Bad for tail latency under concurrent traffic.

**After:**
1. Switched to `fs/promises` `readFile` (non-blocking).
2. Added module-scope cache with 1-hour TTL — file is read once per server instance per hour, subsequent requests served from memory. Since `llms.txt` / `llms-full.txt` ship with the build, this is safe.

```ts
import fs from 'fs/promises';

let cachedContent: string | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60 * 60 * 1000;

async function loadContent(): Promise<string> {
  const now = Date.now();
  if (cachedContent !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedContent;
  }
  const filePath = path.join(process.cwd(), 'public', 'llms.txt');
  const content = await fs.readFile(filePath, 'utf-8');
  cachedContent = content;
  cachedAt = now;
  return content;
}
```

The existing public `Cache-Control: max-age=86400` is retained, so most traffic is served from CDN; this fix protects the origin from a tight loop of cache-miss requests blocking the event loop.

---

## F13-004 — Missing `maxDuration` on hot AI routes

**Files (6 added):**
- `src/app/api/ai/lesson-plan/route.ts`
- `src/app/api/ai/quiz/route.ts`
- `src/app/api/ai/exam-paper/route.ts`
- `src/app/api/ai/virtual-field-trip/route.ts`
- `src/app/api/ai/assessment-scanner/route.ts`
- `src/app/api/ai/video-storyteller/route.ts`

Each gained:
```ts
// Allow up to 120s for AI generation (hot path can be slow under load)
export const maxDuration = 120;
```

This matches the existing convention in `visual-aid/route.ts`. Default Vercel/Next serverless timeout is 10s — well below typical Genkit Gemini generation time for these flows under load, causing intermittent 504s.

---

## Tests Added

### `src/__tests__/api/maxDuration.test.ts`
Static-source assertion that every hot AI route exports `maxDuration >= 60`. Will fail if a regression removes the declaration. Covers all 7 hot routes (the 6 new + visual-aid baseline).

### `src/__tests__/api/seo-llms-cache.test.ts`
Static-source assertions for both seo routes:
- No `readFileSync` reference.
- Imports from `fs/promises`.
- Has module-scope `cachedContent` variable.

### Test results
```
Test Suites: 2 passed, 2 total
Tests:       13 passed, 13 total
```

N+1 fixes (F13-001, F13-002) are exercised indirectly by existing integration tests for `daily-briefing` / `ai-community-agent` cron jobs — behaviour is unchanged, only the access pattern was changed. No new mocks were needed.

---

## Verification

- `npm run typecheck` → clean (no output, exit 0)
- `npx jest src/__tests__/api/maxDuration.test.ts src/__tests__/api/seo-llms-cache.test.ts` → 13/13 pass

## Risk Assessment

- **F13-001 / F13-002:** Behaviour preserved 1:1. `db.getAll` returns snapshots in input order, identical to per-ref `get()` results. Empty-input guards added.
- **F13-003:** Cache TTL is 1h; `llms.txt` is part of the build artefact and won't change at runtime — TTL is conservative.
- **F13-004:** Pure config addition — no runtime behaviour change, just lifts the timeout ceiling.
