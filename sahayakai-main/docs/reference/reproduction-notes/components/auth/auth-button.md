# AuthButton Component

**File:** `src/components/auth/auth-button.tsx`

---

## Purpose

Top-right header button for authentication. Shows "Sign in" when unauthenticated, profile dropdown when signed in.

---

## Props

None — reads from `useAuth()`.

---

## Signed-Out State

Single button: "Sign in" (with Google icon or LogIn icon).
Click → opens `AuthDialog` modal.

---

## Signed-In State

Avatar button → `DropdownMenu` with:
- User name + email (header row)
- "My Profile" → `/my-profile`
- "My Library" → `/my-library`
- Separator
- "Sign out" → `auth.signOut()`

Avatar: `AvatarImage` with `photoURL` from Firebase auth. Falls back to `AvatarFallback` (first letter of display name, orange gradient background).

---

## AuthDialog

`src/components/auth/auth-dialog.tsx`

- Modal with feature highlights (Fast AI, Cloud Storage, Smart Insights)
- "Continue with Google" button → `signInWithPopup(auth, googleProvider)`
- On success: dialog closes, `syncUserAction()` called (handled by auth context)

---

## Key Note

`requireAuth()` from `useAuth()` context can be called programmatically to show this dialog. Used by AI tool pages when unauthenticated user tries to generate content.
