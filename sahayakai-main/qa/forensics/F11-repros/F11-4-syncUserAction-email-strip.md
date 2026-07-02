# F11-4 — syncUserAction's email write is silently dropped

**Severity:** P1
**Class:** misleading code / silent strip

## Trace
1. `src/app/actions/auth.ts:43-49`:
   ```ts
   const profileData: Partial<UserProfile> = {
       uid: callerUid,
       email: user.email || "",
       displayName: user.displayName || "",
       photoURL: user.photoURL || "",
   };
   await dbAdapter.updateUser(callerUid, profileData);
   ```
2. `src/lib/db/adapter.ts:90-108` (`filterUserUpdate`) — `email` is NOT in `CLIENT_EDITABLE_USER_FIELDS` (lines 21-84). Drop.
3. `uid` is also NOT in the allowlist. Drop. (Adapter re-adds `uid` from the function arg at line 154, so no harm.)
4. Cloud Logging emits a `warn` "updateUser: rejected non-allowlisted fields" on every single sign-in — likely noisy.

## Net effect
- `email` is never written by `syncUserAction`. The intended write is a no-op.
- This is silently OK because new-user email IS written by `POST /api/user/profile` (`dbAdapter.createUser` — no allowlist filter).
- BUT: the code reads as if it's setting email, which fooled the original Q1.A reviewer.

## Fix
Remove the `email`, `uid` keys from `profileData` in `syncUserAction`. Comment that email is handled by `/api/user/profile`. This both silences the noisy log warning and removes the misdirection.
