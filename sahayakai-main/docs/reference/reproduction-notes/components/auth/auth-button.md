# AuthButton Component

**File:** `src/components/auth/auth-button.tsx`

_Last verified against source: 2026-06-10._

---

## Purpose

Top-right header control for authentication. Shows a Google sign-in button when unauthenticated and a profile dropdown when signed in.

---

## Props

None - reads the user from `useAuth()`.

---

## Signed-Out State

A single "Sign in with Google" button rendered with a custom `GoogleGIcon`. Click calls `signInWithGoogle()` directly (`signInWithPopup` under the hood). There is NO intermediate `AuthDialog` modal as of 2026-06-10. After sign-in the component performs a profile-completeness check and redirects (e.g. to onboarding/profile) when the profile is incomplete.

TODO(verify: exact post-sign-in redirect target and the profile-completeness predicate).

---

## Signed-In State

Avatar button opening a `DropdownMenu`:
- User name + email (header row)
- "Profile & Library"
- "Certifications"
- Separator
- "Sign out" → `auth.signOut()`

Avatar: `AvatarImage` with the Firebase `photoURL`, falling back to `AvatarFallback`.

---

## Notes

- No `auth-dialog.tsx` flow is referenced from this component anymore; sign-in is one click via `signInWithGoogle()`.
- TODO(verify: whether `src/components/auth/auth-dialog.tsx` still exists elsewhere in the app - this component does not use it).
