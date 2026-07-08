# TeacherDirectory Component

**File:** `src/components/community/teacher-directory.tsx`

_Last verified against source: 2026-06-10._

---

## Purpose

Searchable grid of registered teachers with connection state management. Teachers can connect, withdraw requests, accept/decline incoming requests, disconnect, and message. Includes voice search (SpeechRecognition) over the directory.

---

## Props

None - reads from `useAuth()` and actions.

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
| Connect | `sendConnectionRequestAction()` | Yes - moves to sentRequestUids |
| Withdraw | `declineConnectionRequestAction()` | Yes - removes from sentRequestUids |
| Accept | `acceptConnectionRequestAction()` | Yes - moves to connectedUids |
| Decline | `declineConnectionRequestAction()` | Yes - removes from receivedRequests |
| Disconnect | `disconnectAction()` | Yes - removes from connectedUids |
| Message | Navigate to `/messages?with={uid}` | - |

---

## Teacher Card Design

- Avatar with gradient fallback (no photo → gradient using uid hash for consistent color)
- Display name + designation
- Subject badges (up to 3, overflow hidden)
- Followers count + impact score icon
- Connection button (right-aligned)
- `ring-2` border on avatar for visual separation

---

## Per-Teacher Connection State

Connection state is held per teacher (a `connState` map keyed by uid), driving each card's button set. Active/primary buttons use theme tokens (`bg-primary`), not hardcoded `orange-500`.

---

## Search

- Text search plus a voice-search affordance (Web `SpeechRecognition`) that fills the search query.
- Async result handling includes a stale-response guard so a slower in-flight fetch cannot overwrite newer results, and surfaces failures via an error toast.

---

## Layout

Responsive grid: `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4` (1/2/3/4 columns).

TODO(verify: exact teacher fetch limit / pagination behaviour in current source.)
