# Home Page - /

**File:** `src/app/page.tsx`
**Auth:** Not required (auth-conditional rendering)
**Snapshot:** 2026-06-10

---

## Purpose

A single URL (`/`) serving two audiences via an auth-conditional split:

- **Cold visitors** (school admins, chains, governments, organic teachers): render `<LandingPage />` (`src/components/landing/landing-page.tsx`) - the B2B marketing page (rotating 6-pillar headline, CTAs, proof strip, Lakshmi/Raichur quote).
- **Authenticated teachers**: render `<DashboardHome />` (`src/components/dashboard/dashboard-home.tsx`) - the Namaste dashboard with voice input, quick actions, suggestions.

---

## Render Logic

```
HomePage()
├── useAuth() → { user, loading, openAuthModal }
├── while loading or pre-hydration → render null
├── pending sign-in (sessionStorage flag, no user yet) → render null
│     (suppresses landing-page flash during signInWithRedirect round-trip)
├── no user → <LandingPage onAuthClick={openAuthModal} />
└── user → <DashboardHome />
```

The page itself contains no tool cards or mic. Those live inside `<DashboardHome />`.

---

## Landing-flash Fix (Phase U.zeta)

On mobile `signInWithRedirect`, the page reloads after the OAuth round-trip and Firebase briefly reports `loading=false, user=null` while `getRedirectResult()` hydrates. A `PENDING_SIGN_IN_KEY` (`"sahayakai-pending-signin-flow"`, set in `src/lib/sign-in-with-google.ts`) in sessionStorage suppresses `<LandingPage />` during that window, rendering blank instead. A 5s belt-and-braces timer force-clears the flag (iOS Safari ITP / third-party cookie edge cases) so the landing page is never permanently blank.

---

## Notes

- Sidebar visibility is handled by `<AppShell />` in the root layout, not here.
- For the dashboard's quick-action cards, voice input, and suggestions, see `<DashboardHome />`.
