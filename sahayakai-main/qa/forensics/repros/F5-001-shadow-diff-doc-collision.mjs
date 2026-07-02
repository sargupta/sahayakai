#!/usr/bin/env node
/**
 * F5-001 Repro: Generic shadow-diff doc-id collision.
 *
 * Bug: src/lib/sidecar/shadow-diff-writer.ts:100
 *   const id = `${sample.uid}__${Date.now()}`;
 *   ...
 *   .doc(id).set(payload);   // .set() overwrites silently
 *
 * Two writes from same UID landing within a single millisecond
 * (trivially achievable when the dispatcher fires the canary-observation
 * Genkit shadow + sidecar primary; or when a teacher's client retries a
 * dispatch on flaky network) → one shadow_diff row silently overwrites
 * the other. Parity-rollup loses a sample. Promotion gate stalls or
 * (worse) green-lights a regression that lost its evidence.
 *
 * This script does NOT touch prod. It demonstrates the collision rate
 * in pure JS by counting unique doc IDs across N concurrent calls.
 *
 * For preview-env e2e: dispatch 10 concurrent quiz-agent canary calls
 * with the same UID and inspect
 *   agent_shadow_diffs/{YYYY-MM-DD}/quiz/{uid}__*
 * — fewer than 10 docs == bug confirmed.
 */

const N = 200;
const ids = new Set();
const uid = `forensic-race-1`;
let collisions = 0;

// Simulate the writer's doc-id computation under Promise.all-style burst.
const t0 = Date.now();
for (let i = 0; i < N; i++) {
  const id = `${uid}__${Date.now()}`;
  if (ids.has(id)) collisions++;
  ids.add(id);
}
const elapsed = Date.now() - t0;

console.log(JSON.stringify({
  test: 'F5-001 shadow-diff doc-id collision (synthetic)',
  writes: N,
  uniqueIds: ids.size,
  collisions,
  elapsedMs: elapsed,
  verdict: collisions > 0 ? 'BUG CONFIRMED — Date.now() is not unique under burst' : 'no collisions (try larger N or busy loop)',
  fix: 'Use uid__${Date.now()}__${randomUUID().slice(0,8)} OR collection.add() for auto-id',
}, null, 2));
