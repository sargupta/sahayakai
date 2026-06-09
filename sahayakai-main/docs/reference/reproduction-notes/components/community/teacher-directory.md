# TeacherDirectory Component

**File:** `src/components/community/teacher-directory.tsx`

---

## Purpose

Grid of all registered teachers with connection state management. Teachers can connect, withdraw requests, accept/decline incoming requests, disconnect, and message.

---

## Props

None — reads from `useAuth()` and actions.

---

## State

| State | Type | Purpose |
|---|---|---|
| `teachers` | `Teacher[]` | All teachers (up to 200) |
| `connectionData` | `ConnectionData` | Current user's connection state |
| `loading` | `boolean` | Initial fetch |
| `actionStates` | `Record<uid, string>` | Per-teacher pending action |

---

## ConnectionData Shape

```ts
{
  connectedUids: string[]
  sentRequestUids: string[]
  receivedRequests: { fromUid: string, ... }[]
}
```

---

## Per-Teacher Connection Button Logic

```
if connectedUids.includes(uid):       → "Connected" + Message + Disconnect option
if sentRequestUids.includes(uid):     → "Pending" (withdraw on click)
if receivedRequests.fromUid === uid:  → "Accept" + "Decline" buttons
else:                                 → "Connect" button
```

---

## Actions

| Action | Server Action | Optimistic? |
|---|---|---|
| Connect | `sendConnectionRequestAction()` | Yes — moves to sentRequestUids |
| Withdraw | `declineConnectionRequestAction()` | Yes — removes from sentRequestUids |
| Accept | `acceptConnectionRequestAction()` | Yes — moves to connectedUids |
| Decline | `declineConnectionRequestAction()` | Yes — removes from receivedRequests |
| Disconnect | `disconnectAction()` | Yes — removes from connectedUids |
| Message | Navigate to `/messages?with={uid}` | — |

---

## Teacher Card Design

- Avatar with gradient fallback (no photo → gradient using uid hash for consistent color)
- Display name + designation
- Subject badges (up to 3, overflow hidden)
- Followers count + impact score icon
- Connection button (right-aligned)
- `ring-2` border on avatar for visual separation

---

## Performance Note

Loads up to 200 teachers at once. No pagination. Suitable for current scale; add virtual scrolling if teacher count grows significantly.
