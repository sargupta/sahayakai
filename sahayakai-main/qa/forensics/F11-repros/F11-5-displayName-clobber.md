# F11-5 — syncUserAction clobbers displayName/photoURL on phone-only re-sign-in

**Severity:** P1
**Class:** data loss

## Setup
1. Sign up with Google (displayName: "Asha Sharma", photoURL: "https://...").
2. Verify `users/{uid}.displayName === 'Asha Sharma'` in Firestore.

## Exploit
1. Sign out.
2. Sign in via phone-OTP (same uid via linked credential, OR a fresh phone account where Firebase Auth returns `displayName: null`, `photoURL: null`).
3. `src/context/auth-context.tsx:137` fires:
   ```ts
   syncUserAction({
     uid: currentUser.uid,
     email: currentUser.email,            // null
     displayName: currentUser.displayName, // null
     photoURL: currentUser.photoURL,       // null
   });
   ```
4. In `src/app/actions/auth.ts:46-48`:
   ```ts
   email: user.email || "",              // dropped by adapter (email not in CLIENT_EDITABLE_USER_FIELDS)
   displayName: user.displayName || "",   // "" — NOT filtered, WRITTEN
   photoURL: user.photoURL || "",          // "" — NOT filtered, WRITTEN
   ```
5. `dbAdapter.updateUser` does `set({ displayName: "", photoURL: "", ...}, { merge: true })`.

## Result
- `users/{uid}.displayName` is overwritten with `""`.
- `users/{uid}.photoURL` is overwritten with `""`.
- Throughout the app the user now appears with no name and the default avatar.

## Fix
```diff
- email: user.email || "",
- displayName: user.displayName || "",
- photoURL: user.photoURL || "",
+ ...(user.displayName ? { displayName: user.displayName } : {}),
+ ...(user.photoURL ? { photoURL: user.photoURL } : {}),
+ // email: handled by POST /api/user/profile on first save; do not write here.
```
