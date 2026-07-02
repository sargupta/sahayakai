#!/usr/bin/env node
/**
 * F5-004 Repro: Profile save double-submit triggers duplicate fan-out.
 *
 * Bug: src/app/api/user/profile/route.ts:85-129
 *
 *   const existingProfile = await dbAdapter.getUser(requestingUserId);  // T1
 *   const isNewUser = !existingProfile;
 *   ...
 *   await dbAdapter.createUser(profile);   // T2 (set with merge — idempotent)
 *   if (isNewUser) {
 *     void fanoutNewTeacherJoinedNotification(profile.uid);  // T3 — SIDE EFFECT
 *   }
 *
 * Onboarding completion click — slow network, user clicks "Save Profile"
 * twice OR React strict mode fires twice. Both requests:
 *   A: getUser → null → isNewUser=true → createUser → FANOUT
 *   B: getUser → null → isNewUser=true → createUser → FANOUT
 *
 * Each fanoutNewTeacherJoined sends FCM + writes notification docs to
 * every "nearby teacher" (same district + primary subject). Doubles
 * (or worse on N-tap) the inbox spam for every neighbour, and burns
 * 2× the FCM quota for what should be a one-shot welcome event.
 *
 * Severity: P1
 *   - Not a data-loss bug
 *   - User-visible: receiving teachers see 2+ notifications for the
 *     same join → trust erosion
 *   - Cost: FCM is metered, doubles outgoing notification cost
 *
 * Fix options:
 *   (a) Use createUser with .create() (atomic fail-if-exists) when
 *       isNewUser is true and gate fanout on the create success.
 *   (b) Add a `welcomeFanoutSent: true` flag inside the same write
 *       and use a transaction read-set to gate the fanout.
 *   (c) Cheap: stamp a fanoutKey doc in collection
 *       `welcome_fanout_sent/{uid}` via .create() before firing the
 *       fanout — duplicate calls catch ALREADY_EXISTS and skip.
 */
console.log(JSON.stringify({
  test: 'F5-004 profile double-submit fanout',
  affected: ['src/app/api/user/profile/route.ts:85-129'],
  severity: 'P1',
  symptom: 'fanoutNewTeacherJoinedNotification fires N times for N concurrent first-save submits',
  fix: 'gate fanout on .create() of a welcome_fanout_sent/{uid} guard doc',
}, null, 2));
