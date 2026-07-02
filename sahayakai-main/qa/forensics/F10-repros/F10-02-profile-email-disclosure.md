# F10-02 — Repro: public profile leaks email

## Vulnerability
`src/components/profile/profile-view.tsx:245` renders `profile?.email` for non-connections.
Backed by `src/app/actions/profile.ts:74` which includes `email` in the public projection.

## Steps
1. Sign in as Attacker (no connection to Victim).
2. Discover victim uid via `getAllTeachersAction` or any group member listing.
3. Visit `/profile/{victimUid}`.
4. The "Mail" affordance renders `victim@example.com` — string `t("Contact Hidden")` is the fallback
   only when `profile.email` is empty, NOT when caller-is-not-connected.

## Impact
- Targeted phishing list for any teacher in the directory.
- Combined with `phoneNumber` from F10-01: complete contact spam list.

## Fix
1. Server: remove `email` from the public projection in `getPublicProfileAction` unless the caller is
   a confirmed connection.
   ```ts
   const callerId = await requireAuth();
   const connId = [callerId, targetUid].sort().join('_');
   const connSnap = await db.collection('connections').doc(connId).get();
   const isConnected = connSnap.exists;
   const publicProfile = {
       /* …safe fields… */
       ...(isConnected ? { email: profile.email } : {}),
   };
   ```
2. Client: keep the existing fallback; it will now correctly show "Contact Hidden" for non-connections.
