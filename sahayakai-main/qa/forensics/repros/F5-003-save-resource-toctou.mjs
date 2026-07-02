#!/usr/bin/env node
/**
 * F5-003 Repro: saveResource TOCTOU on community library.
 *
 * Bug: src/app/actions/community.ts:582 (saveCommunityResourceAction)
 *
 *   const saveDoc = await saveRef.get();          // T1 read
 *   if (saveDoc.exists) return { alreadySaved };  // idempotent path OK
 *   await saveRef.set(...);                        // T2 mark save
 *   await resRef.update({ 'stats.saves': increment(1) });  // T3 counter
 *   await dbAdapter.saveContent(...);              // T4 user library copy
 *
 * Two concurrent saves from same UID:
 *   A: read → not exists → set save → increment(+1) → copy to library
 *   B: read → not exists → set save → increment(+1) → copy to library (DUPLICATE)
 *
 * Symptoms:
 *   - library_resources/{id}/saves/{uid} = 1 doc (idempotent set)
 *   - library_resources/{id}.stats.saves = +2  (inflated)
 *   - users/{uid}/saved_content/saved_{id}_{prefix} = 1 doc (saveContent uses
 *     stable id, so idempotent) — phew. Counter is the only damage.
 *
 * Severity: P1 (cosmetic stats inflation; no user-visible duplication
 * in the saver's library because contentId is deterministic).
 *
 * Fix: runTransaction wrapping the read+set+increment, with the
 * library-copy still outside (it's its own idempotent path).
 */
console.log(JSON.stringify({
  test: 'F5-003 saveResource TOCTOU',
  affected: ['src/app/actions/community.ts:582'],
  severity: 'P1',
  fix: 'runTransaction(read saveRef + set + increment); leave saveContent() outside',
}, null, 2));
