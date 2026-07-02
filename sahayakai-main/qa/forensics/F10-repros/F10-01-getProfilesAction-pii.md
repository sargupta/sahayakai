# F10-01 — Repro: `getProfilesAction` PII dump

## Vulnerability
`src/app/actions/community.ts:14-17` exposes raw Firestore user docs to any signed-in user.

## Steps
1. Sign in as any teacher (attacker).
2. Collect target uids: call `getAllTeachersAction()` — returns sanitized list with uids of all teachers.
3. POST to the Next.js server-action endpoint for `getProfilesAction` with a batch of 10 uids:
   ```js
   import { getProfilesAction } from '@/app/actions/community';
   const dump = await getProfilesAction(['victim1','victim2', /* …8 more */]);
   console.log(dump);  // full UserProfile docs each
   ```
4. Repeat for next 10. ~138 user docs → 14 calls → entire phone-number table dumped.

## Evidence (expected response shape per user)
```json
{
  "uid": "victim1",
  "email": "victim@school.in",
  "phoneNumber": "+91xxxxxxxxxx",
  "fcmTokens": ["e1a…"],
  "adminRoles": [],
  "planTier": "free",
  "schoolName": "…",
  "displayName": "…",
  "billing": { … },
  …
}
```

## Why it works
- `requireAuth()` only checks the caller is signed in; does not check WHO is being read.
- `dbAdapter.getUsers` (`src/lib/db/adapter.ts:120`) returns `{ uid, ...doc.data() }` with no projection.
- The dedicated public projection in `getPublicProfileAction` (`profile.ts:53`) is NOT used here.

## Suggested fix
```ts
export async function getProfilesAction(uids: string[]) {
    await requireAuth();
    const users = await dbAdapter.getUsers(uids);
    return users.map(u => ({
        uid: u.uid,
        displayName: u.displayName,
        photoURL: u.photoURL,
        schoolName: u.schoolName,
        subjects: u.subjects,
        gradeLevels: u.gradeLevels,
    }));
}
```
Or delete the action — `grep` shows no in-app callers, only an auth test.
