# Notifications - /notifications

**File:** `src/app/notifications/page.tsx`
**Auth:** Required (signed-out users get `<AuthGate>`: "Sign in to see notifications")
**Snapshot:** 2026-06-10

---

## Purpose

Shows all notifications for the signed-in teacher. Connection requests (with Accept/Decline inline), likes, follows, badges, resource activity.

---

## Component Tree

```
NotificationsPage
├── Loading state (Loader2 spinner)
├── AuthGate (if unauthenticated)
├── Page header (Bell icon + title + subtitle)
└── NotificationFeed (notifications, userId, onRefresh)
    └── Notification items × N
        ├── Icon by type (UserPlus, Heart, Star, MessageCircle, etc.)
        ├── Sender avatar + name
        ├── Notification text
        ├── Timestamp
        ├── Mark as read button (if unread)
        └── [CONNECT_REQUEST only] Accept / Decline buttons
```

---

## State (NotificationsFeed)

| State | Type | Purpose |
|---|---|---|
| `notifications` | `Notification[]` | Loaded notifications |
| `loading` | `boolean` | Fetch in flight |
| `actionState` | `Record<string, 'pending' \| 'accepted' \| 'declined'>` | Per-notification action tracking |

---

## Data Flow

1. The page resolves the user via `onAuthStateChanged`, then calls `getNotificationsAction(uid)` (`src/app/actions/notifications.ts`).
2. Results render in `NotificationFeed`; `onRefresh` re-fetches. Accept/decline and mark-read interactions live inside the feed component. TODO(verify: exact fetch limit/sort and the read/connection action names called from NotificationFeed).

---

## Notification Icons by Type

(Rendered inside `NotificationFeed`; mapping below is indicative.) TODO(verify: exact type→icon mapping against `src/components/notifications-feed.tsx`.)

| Type | Icon | Color |
|---|---|---|
| FOLLOW | UserPlus | blue-500 |
| NEW_POST | FileText | orange-500 |
| BADGE_EARNED | Star | yellow-500 |
| LIKE | Heart | red-500 |
| RESOURCE_SAVED | Bookmark | green-500 |
| RESOURCE_USED | BookOpen | purple-500 |
| CONNECT_REQUEST | Users | orange-500 |
| CONNECT_ACCEPTED | CheckCircle | green-500 |

---

## Design

- Timeline layout with left-edge icons
- Unread notifications: slightly highlighted background (slate-50 or orange-50)
- Read notifications: white background
- Accept/Decline buttons: inline, small, with pending/accepted/declined state feedback
- "Mark all read" button in page header
