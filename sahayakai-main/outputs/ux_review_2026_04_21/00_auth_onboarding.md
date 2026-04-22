# Auth & Onboarding — SahayakAI (recon 2026-04-21)

## Signup paths
**Google OAuth only.** No email/password, no OTP, no anonymous. No Firebase Auth Emulator.
- `src/components/auth/auth-button.tsx:4-6` — `signInWithPopup(auth, GoogleAuthProvider)`
- `src/components/auth/auth-dialog.tsx:13-14` — same

## Firebase config
- Project: `sahayakai-b4248` (prod only)
- Config at `src/lib/firebase.ts:6-14` — API key hardcoded as fallback
- **No emulator hook** — `connectAuthEmulator` not present

## CRITICAL — dev-token bypass
Middleware `src/middleware.ts:89-92` recognises literal string `dev-token` in cookie/header and injects:
- `x-user-id: dev-user-123`
- `x-user-plan: pro`

**Implication for UX review**: cookie `auth-token=dev-token` lets me bypass Google OAuth entirely. Trade-off: user is Pro-tier, so free-tier plan-limit UX must be tested differently (probe Phase 4 — force plan=free via header override OR trip by 1 request on a 0-quota feature like `parent-message`).

## Onboarding flow (3 steps)
File: `src/app/onboarding/page.tsx`

1. **Language picker** — tap any of 11 languages → auto-advance. Writes `users/{uid}.preferredLanguage`.
2. **Professional profile** (accordion on mobile):
   - schoolName + state (required)
   - educationBoard: CBSE/ICSE/State (required)
   - subjects: multi-checkbox, ≥1 required
   - gradeLevels: grid of Class buttons, ≥1 required
3. **Aha moment** — pre-gen example + optional real lesson-plan gen. Skip available.

Redirect: `router.push('/')` → home.

## Profile schema (Firestore `users/{uid}`)
Key fields: `uid, email, displayName, schoolName, schoolNormalized, state, educationBoard, subjects[], gradeLevels[], preferredLanguage, onboardingPhase ('setup'|'first-generation'|'exploring'|'done'), profileCompletionLevel, impactScore, contentSharedCount, followersCount, badges[], planType ('free'|'pro'|'gold'|'premium'), verifiedStatus, createdAt, lastLogin`.

No `resourceLevel` field despite memory claim.

## Quickest signup recipe (for review)
1. Set cookie `auth-token=dev-token` (bypasses OAuth; dev-user-123)
2. Seed Firestore `users/dev-user-123` doc with minimal onboarding (or go through onboarding UI to exercise that flow)
3. Land on `/` directly

**Alternative** (closer to real UX): use actual Google sign-in via a personal test Gmail in the preview browser. Downside: OAuth popup may block inside Claude_Preview sandboxed browser.

Decision: test BOTH. First real Google flow (to capture real onboarding UX). If blocked, fall back to dev-token.
