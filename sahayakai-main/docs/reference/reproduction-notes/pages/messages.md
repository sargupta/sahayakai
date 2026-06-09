# Messages - /messages

**File:** `src/app/messages/page.tsx`
**Auth:** Required (signed-out users get `<AuthGate>`: "Sign in to see your messages")
**Snapshot:** 2026-06-10

---

## Purpose

Direct messaging between connected teachers. Supports text, shared resources (lesson plans, quizzes, etc.), and voice messages. Two-panel layout: conversation list (left) + thread (right).

---

## Component Tree

```
MessagesPage (Suspense wrapper)
└── MessagesPageContent
    ├── PushPermissionBanner (FCM permission prompt)
    ├── ConversationList (left panel)
    │   ├── Search input (filter conversations)
    │   ├── Conversation items × N
    │   │   ├── Avatar + name
    │   │   ├── Last message preview ("You: ..." or their message)
    │   │   ├── Timestamp
    │   │   └── Unread count badge
    │   └── New message button → NewConversationPicker
    │
    └── ConversationThread (right panel, or full-screen on mobile)
        ├── Thread header (back button on mobile, avatar, name)
        ├── Message bubbles
        │   ├── MessageBubble (text)
        │   ├── MessageBubble (resource card)
        │   └── MessageBubble (audio - native <audio> player)
        ├── Resource attachment popover (Paperclip button)
        │   └── 7 resource type options (lesson-plan, quiz, worksheet, etc.)
        ├── Textarea input (Shift+Enter for newline, Enter to send)
        ├── VoiceRecorder button
        └── Send button
```

---

## State (MessagesPageContent)

| State | Type | Purpose |
|---|---|---|
| `activeConversation` | `Conversation \| null` | Currently open thread |
| `showPicker` | `boolean` | Show NewConversationPicker in right panel |
| `mobileView` | `'list' \| 'thread'` | Mobile: which panel is visible |
| `autoOpenLoading` | `boolean` | Loading while resolving `?with`/`?open` |

---

## URL Params

- `?with=uid` - `getOrCreateDirectConversationAction(user.uid, withUid)` then opens the DM
- `?open=convId` - fetches that conversation doc directly and opens it

Read via `useSearchParams()`; after handling, the page calls `router.replace("/messages")` to clear the params.

---

## Responsive Behavior

- **Mobile:** Either list OR thread visible (toggle via `showList`)
  - Thread has back arrow → returns to list
- **Desktop:** Both panels visible side-by-side (`md:flex md:flex-row`)

---

## ConversationList

- Real-time listener: `onSnapshot` on `conversations` where `participantIds` array-contains `userId`
- Sorted by `lastMessageAt` descending
- Unread badge: `unreadCount[userId]` from conversation doc
- Search: client-side filter on participant display names
- "New message" → `NewConversationPicker` (search all teachers, start DM)

---

## ConversationThread

Real-time listener: `onSnapshot` on `messages` subcollection, ordered by `createdAt`, last 100.

**Message types:**
- `text`: plain text bubble
- `resource`: resource card with "Open in Tool" button
- `audio`: Mic icon + `<audio controls>` player

**Mark as read:** called when conversation opens via `markConversationReadAction()`

**Resource sharing:**
- Paperclip button → Popover with 7 resource type options
- Each option navigates to the tool page (teacher completes the resource there, then comes back to share)
- OR if they already have content: share directly from library

**Voice messages:**
- `VoiceRecorder` component (idle → recording → uploading → sent)
- `onSend(audioUrl, duration)` → `handleSend("", "audio", undefined, audioUrl, duration)`

---

## NewConversationPicker

- Fetches all teachers (up to 200) via `getAllTeachersAction()`
- Search filter on name
- Shows connection state per teacher:
  - Connected → "Message" button → creates/opens DM
  - Not connected → "Connect" button → `sendConnectionRequestAction()`
  - Pending → "Pending" badge
- Footer note: "You can only message connected teachers"

---

## Design

- Left panel: `w-80 shrink-0 border-r border-slate-100`
- Thread area: `flex-1 min-w-0`
- Bubbles: own = orange-500 text-white rounded-br-sm; other = slate-100 text-slate-800 rounded-bl-sm
- Audio bubble: Mic icon (white on own, orange-500 on other) + native audio player
- Resource card: white inset card with type-colored left border, "Open in Tool" button
