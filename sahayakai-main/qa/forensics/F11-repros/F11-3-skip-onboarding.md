# F11-3 — Skip onboarding Step 1 by direct updateProfileAction call

**Severity:** P1
**Class:** state-machine bypass

## Setup
1. Sign up a fresh user, complete only Step 0 (language picker). Do NOT submit Step 1.
2. Confirm `profile.schoolName` is empty (Firestore console) and `profile.onboardingPhase` is unset.

## Exploit
From a signed-in client tab, in DevTools console:

```js
const { updateProfileAction } = await import('/_next/static/chunks/.../profile.js');
// or just call via your own page-component path:
await updateProfileAction(firebase.auth().currentUser.uid, {
  schoolName: 'X',
  onboardingPhase: 'exploring',
  profileCompletionLevel: 'basic',
});
```

`schoolName`, `onboardingPhase`, and `profileCompletionLevel` are all in `PROFILE_WRITABLE_FIELDS` (action layer) and `CLIENT_EDITABLE_USER_FIELDS` (adapter layer). The write succeeds.

## Result
- `/onboarding` now redirects to `/` (line 144: `if (profile && profile.schoolName) router.push("/")`).
- User can use AI tools without ever having selected subjects, gradeLevels, state, or educationBoard. Personalisation downstream silently degrades.

## Fix
Server-side gate: `updateProfileAction` should reject `onboardingPhase: 'exploring' | 'first-generation'` if any of `subjects[]`, `gradeLevels[]`, `state`, `educationBoard` are missing on the existing profile.
