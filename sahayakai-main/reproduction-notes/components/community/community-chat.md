# CommunityChat Component

**File:** `src/components/community/community-chat.tsx`

---

## Purpose

Real-time community chat room. All teachers share one global channel. Supports text and voice messages. Auto-scrolls on new messages. Optimistic updates with rollback on error.

---

## Props

None — self-contained, reads from `useAuth()` and Firestore.

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
collection: community_chat
query: orderBy("createdAt", "asc"), limitToLast(100)
```

`onSnapshot` fires on mount, updates `messages` state live. Cleanup on unmount.

---

## Auto-Scroll

`useEffect` on `messages` → `bottomRef.current?.scrollIntoView({ behavior: 'smooth' })`. A `<div ref={bottomRef} />` sits below the last message.

---

## Message Sending — handleSend(audioUrl?)

1. Validate: skip if no text AND no audioUrl
2. Optimistic: prepend message with `id: optimistic_${Date.now()}`, `createdAt: null`, `opacity-60` style
3. Clear input (if text message)
4. Call `sendChatMessageAction(text, audioUrl)` — server action
5. **On success:** real-time listener replaces optimistic message with server version (different id)
6. **On error:** remove optimistic message, restore input, show error banner

---

## Error Messages

| Condition | Message |
|---|---|
| Unauthorized | "You must be signed in to send messages." |
| Rate limited | "Slow down — you're sending too fast." |
| Other | "Failed to send. Please try again." |

---

## Voice Messages

`VoiceRecorder` component → `handleVoiceSend(audioUrl, duration)` → `handleSend(audioUrl)`.

Audio rendering:
```tsx
<div className="flex items-center gap-2 min-w-[160px]">
  <div className={cn("p-1.5 rounded-full", isOwn ? "bg-white/20" : "bg-orange-100")}>
    <Mic className={cn("h-3.5 w-3.5", isOwn ? "text-white" : "text-orange-500")} />
  </div>
  <audio src={audioUrl} controls preload="metadata" className="h-8 flex-1 min-w-0" />
</div>
```

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

- Container: `flex flex-col min-h-[400px] h-[600px] rounded-2xl overflow-hidden`
- Own messages: right-aligned, orange-500 background, white text, `rounded-br-sm`
- Other messages: left-aligned, slate-100 background, slate-800 text, `rounded-bl-sm`
- Optimistic messages: `opacity-60`
- Live indicator: green pulsing dot + "LIVE" uppercase label
