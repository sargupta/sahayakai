# AppSidebar Component

**File:** `src/components/app-sidebar.tsx`

_Last verified against source: 2026-06-10. (Lives directly under `src/components/`, not a `layout/` subfolder.)_

---

## Purpose

Main navigation sidebar built on the Shadcn `Sidebar` primitive set. Nav is grouped by user intent with progressive disclosure (advanced groups hidden for brand-new users) and live unread badges.

---

## Props

None - reads `useAuth()` and Firestore internally; also consumes subscription/usage and feature-flag context.

---

## Structure

Intent-grouped nav (not a flat AI-Tools / Platform split). Groups: **Home, Create, Assess, Engage, Ask, My work, Account**, plus an **Admin** group pinned in the footer.

- Progressive disclosure: an `isNewUser` / `canShowAdvanced` gate hides advanced groups until the user is established; a `FeatureSpotlight` highlights newly unlocked items.
- Footer area composes `PlanBadge` + `UsageDisplay` + `FeatureSpotlight` alongside the Admin group.

TODO(verify: exact route + icon for every item in each group against current source - the legacy two-table list is stale).

---

## Live Badges

Two independent unread badges:
1. **Conversations** - `totalUnread` summed from the user's conversations.
2. **Notifications** - `unreadNotifications` count.

Both subscribe via Firestore listeners established inside an auth-state listener; both must be unsubscribed on cleanup.

---

## Active State

Uses `usePathname()` to mark the active link; active styling uses theme tokens (`text-primary` / accent background), not hardcoded orange.

---

## Mobile Behavior

Collapses into the Shadcn sidebar's mobile sheet/drawer; content identical to desktop.

---

## Key Pattern

Nested-subscription cleanup (auth listener wrapping Firestore listeners) to avoid leaks:

```
let unsubA: (() => void) | null = null;
const authUnsub = onAuthStateChanged(auth, (user) => {
  if (user) unsubA = onSnapshot(...);
});
return () => { authUnsub(); unsubA?.(); };
```
