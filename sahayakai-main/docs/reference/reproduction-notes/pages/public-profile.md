# Public Profile — /profile/[uid]

**File:** `src/app/profile/[uid]/page.tsx`
**Auth:** Not required to view (but auth needed for connection actions)

---

## Purpose

Any teacher's public profile. Viewed when clicking on another teacher's name in community/directory. Shows same layout as My Profile but with connection action buttons instead of edit button.

---

## Component Tree

```
PublicProfilePage (async, awaits params)
└── ProfileView (isOwnProfile=false, targetUid={uid})
    ├── Profile header (same as My Profile)
    ├── Stats row
    ├── Connection action buttons (instead of Edit)
    │   ├── "Connect" → sendConnectionRequestAction()
    │   ├── "Pending" (if request sent)
    │   ├── "Accept" / "Decline" (if request received)
    │   ├── "Connected" (if already connected)
    │   ├── "Disconnect" option
    │   └── "Message" → navigates to /messages?with=uid
    ├── Badges section
    ├── Certifications section (read-only)
    └── Recent activity timeline
```

---

## Route

Dynamic route: `/profile/[uid]`

```tsx
// page.tsx is async — awaits params
const { uid } = await params;
```

**Important:** Next.js 15 requires `await params` (params is a Promise in async server components).

---

## Data Flow

Same as My Profile but:
- `isOwnProfile: false`
- `targetUid` = the profile owner's UID (from URL params)
- Connection state loaded via `getMyConnectionDataAction()` → determines which button to show

---

## Connection State Logic

```
connectionData.connectedUids.includes(targetUid) → "Connected" + "Message" + "Disconnect"
connectionData.sentRequestUids.includes(targetUid) → "Pending" + withdraw option
connectionData.receivedRequests.find(r => r.fromUid === targetUid) → "Accept" / "Decline"
otherwise → "Connect"
```

---

## Design

Identical to My Profile layout. Only difference: connection button row replaces edit button.
- Connection buttons: same size/position as Edit Profile button
- "Message" button: secondary style, navigates to `/messages?with={targetUid}`
