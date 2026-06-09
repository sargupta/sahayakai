# ProfileView Component

**File:** `src/components/profile/profile-view.tsx`

_Last verified against source: 2026-06-10._

---

## Purpose

Full profile display for both own profile and other users. Conditionally shows edit/certification controls (own) or connection action buttons (others).

---

## Props

```ts
{
  uid?: string;
  isOwnProfileManual?: boolean;
}
```

Note the names: `uid` (not `targetUid`) and `isOwnProfileManual` (not `isOwnProfile`).

---

## Data Flow

- Own profile: `getProfileData(...)` returns the profile plus certifications.
- Other user: `getPublicProfileAction(...)` for the public view; connection state loaded separately.

TODO(verify: exact action names and return shapes for getProfileData / getPublicProfileAction in current source).

---

## Sections

### Header
- Avatar + display name.
- Verified check shown when `verifiedStatus === 'verified'` (a string equality, not a boolean `=== true`).
- Designation / school / district / bio when set.

### Certifications
- List with status; own profile exposes an `AddCertificationDialog`.

### Edit
- Own profile exposes `EditProfileDialog`.

There is NO followers/following/resources/impact stats row and NO badges row in the current component (the legacy doc's "Stats Row", "Badges", and "Activity Timeline" sections are stale).

---

## Connection Button Logic (other user)

Connection status drives the action buttons via a `connStatus` value, conceptually:
- connected -> Connected / Message / Disconnect
- pending sent -> Pending (withdraw)
- pending received -> Accept / Decline
- none -> Connect

Button colors use theme tokens (`bg-primary`), not hardcoded `orange-500`.

TODO(verify: exact `connStatus` enum values and the precise button set/labels for each state).

---

## Dialogs

- `AddCertificationDialog` - add a certification (own profile).
- `EditProfileDialog` (`src/components/edit-profile-dialog.tsx`) - edit profile fields; submit then toast + close.
