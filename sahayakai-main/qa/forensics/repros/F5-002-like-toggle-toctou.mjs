#!/usr/bin/env node
/**
 * F5-002 Repro: toggleLike TOCTOU on community posts.
 *
 * Bug: src/app/actions/community.ts:83 (toggleLikeAction)
 *      src/app/actions/groups.ts:550   (group post like)
 *
 *   const likeDoc = await likeRef.get();        // T1 read
 *   if (likeDoc.exists) { ... } else {
 *     await likeRef.set({...});                  // T2 write
 *     await postRef.update({ likesCount: increment(1) });   // T3
 *   }
 *
 * Race scenario (same UID, two concurrent clicks — user double-taps the
 * heart on a sluggish 3G network, or React's strict mode in dev fires
 * the server action twice):
 *
 *   Call A: get → exists=false → set like → increment(+1)
 *   Call B: get → exists=false → set like → increment(+1)   // OVERLAP
 *   Result: 1 like doc (idempotent set), but likesCount = +2
 *
 * Worse — like + unlike interleaving:
 *   Call A (like):   get → exists=false
 *   Call B (unlike): get → exists=true   (B sees A's not-yet-written state? NO — but if A landed first)
 *   Actually the worst is double-LIKE inflation: 1 doc, +2 count.
 *
 * To verify in preview:
 *   curl -X POST .../api/actions/toggleLike?postId=X  &  (10 times)
 *   gcloud firestore:
 *     - subcollection posts/X/likes : 1 doc (uid)
 *     - posts/X.likesCount         : > 1   (BUG)
 *
 * Fix: wrap in db.runTransaction so the read+decide+write is serialised.
 */

console.log(JSON.stringify({
  test: 'F5-002 toggleLike TOCTOU (preview-env required for live verification)',
  affected: [
    'src/app/actions/community.ts:83 toggleLikeAction',
    'src/app/actions/groups.ts:535 toggleGroupPostLikeAction',
  ],
  scenario: 'N concurrent like requests from same UID → likesCount inflated by N, like doc count = 1',
  severity: 'P0',
  fix: 'Wrap read+set+increment in db.runTransaction()',
}, null, 2));
