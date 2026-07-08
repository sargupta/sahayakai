# CommunityChat Component

**File:** `src/components/community/community-chat.tsx`

_Last verified against source: 2026-06-10._

---

## Purpose

Real-time chat room. Reusable for both the global community channel and group channels. Supports text and voice messages. Optimistic updates with rollback on error.

---

## Props

```ts
{
  collectionPath: string;   // Firestore collection to read/write (e.g. "community_chat" or a group path)
  groupId?: string;         // present for group channels -> selects the group send action
  title?: string;
  subtitle?: string;
}
```

The component is NOT propless - it is parameterised by `collectionPath`/`groupId` so the same UI backs the global room and group rooms. When `communityPersonas` (feature flag via `useFeatureFlag`) is enabled, AI persona authors may also appear in the stream.

---

## Internal Types

```ts
type ChatMessage = {
  id: string;
  text: string;
  audioUrl?: string;
  authorId: string;
  authorName: string;
  authorPhotoURL?: string | null;
  createdAt: Timestamp | null;
}
```

---

## State

| State | Type | Purpose |
|---|---|---|
| `messages` | `ChatMessage[]` | Last 100 messages |
| `input` | `string` | Controlled text input |
| `sending` | `boolean` | Message being sent |
| `error` | `string \| null` | Error banner text |
| `loading` | `boolean` | Initial load |

---

## Real-Time Listener

```
collection: `collectionPath` prop (default community room = community_chat)
query: orderBy("createdAt", "asc"), limitToLast(100)
```

`onSnapshot` fires on mount, updates `messages` state live. Cleanup on unmount.

---

## Auto-Scroll + New-Messages Pill

Uses a `useNearBottom` helper: it only auto-scrolls to the newest message when the user is already near the bottom. If the user has scrolled up, incoming messages surface a "new messages" pill instead of yanking the viewport; tapping it scrolls to bottom. (The legacy doc's unconditional `scrollIntoView` is stale.)

---

## Message Sending - handleSend(audioUrl?)

1. Validate: skip if no text AND no audioUrl
2. Optimistic: prepend message with `id: optimistic_${Date.now()}`, `createdAt: null`, `opacity-60` style
3. Clear input (if text message; text input max length 500)
4. Call the send action - `sendGroupChatMessageAction(...)` when `groupId` is set, otherwise `sendChatMessageAction(...)`
5. **On success:** real-time listener replaces optimistic message with server version (different id)
6. **On error:** remove optimistic message, restore input, show error banner

---

## Error Messages

| Condition | Message |
|---|---|
| Unauthorized | "You must be signed in to send messages." |
| Rate limited | "Slow down - you're sending too fast." |
| Other | "Failed to send. Please try again." |

---

## Voice Messages

`VoiceRecorder` component → `handleVoiceSend(audioUrl, duration)` → `handleSend(audioUrl)`.

Audio rendering uses a `Mic` icon chip beside a native `<audio controls preload="metadata" className="h-8 flex-1 min-w-0" />`. Own vs other styling uses theme tokens (e.g. `bg-primary` chip on own messages, muted chip on others), not hardcoded `orange-100`/`orange-500`.

---

## Message Grouping

Consecutive messages from same sender: only first shows avatar + name. Subsequent messages: avatar area is empty spacer (`w-7`), no name shown. Determined by comparing `prevMsg.authorId !== msg.authorId`.

---

## Layout

```
Flex column, h-[600px]:
├── Header (shrink-0): MessageCircle icon, "Community Chat", Live dot
├── Messages (flex-1, overflow-y-auto)
├── Error banner (conditional)
└── Input (shrink-0): Input + VoiceRecorder + Send button
```

---

## Design

- Own messages: right-aligned, `bg-primary` background, primary-foreground text, `rounded-br-sm`
- Other messages: left-aligned, muted background, foreground text, `rounded-bl-sm`
- Optimistic messages: dimmed (`opacity-60`)
- Live indicator: pulsing dot + label

TODO(verify: exact container height/utility classes and the live-indicator label text in current source).
