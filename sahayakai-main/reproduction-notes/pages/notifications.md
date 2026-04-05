# Notifications — /notifications

**File:** `src/app/notifications/page.tsx`
**Auth:** Required

---

## Purpose

Shows all notifications for the signed-in teacher. Connection requests (with Accept/Decline inline), likes, follows, badges, resource activity.

---

## Component Tree

```
NotificationsPage
├── Page header (title, "mark all read" button)
├── Loading state (Loader2 spinner)
├── Sign-in prompt (if unauthenticated)
└── NotificationsFeed
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

1. Mount: `getNotificationsAction(userId)` → fetches 50 notifications, sorted by `createdAt` desc
2. Accept connection: `acceptConnectionRequestAction()` → notification updates to accepted state
3. Decline connection: `declineConnectionRequestAction()` → notification updates to declined state
4. Mark read: `markNotificationAsReadAction(notificationId)` or `markAllAsReadAction(userId)`
5. `revalidatePath('/notifications')` called after read actions

---

## Notification Icons by Type

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
