# ConversationList Component

**File:** `src/components/messages/conversation-list.tsx`

---

## Purpose

Left-panel inbox showing all conversations. Real-time updates. Search filter. Opens/creates conversations. Shows unread counts.

---

## Props

```ts
{
  selectedConversationId: string | null;
  onSelect: (conversation: Conversation) => void;
}
```

---

## State

| State | Type | Purpose |
|---|---|---|
| `conversations` | `Conversation[]` | All conversations |
| `search` | `string` | Search filter text |
| `loading` | `boolean` | Initial fetch |
| `pickerOpen` | `boolean` | NewConversationPicker open |

---

## Real-Time Listener

```
collection: conversations
query: where participantIds array-contains userId
       orderBy updatedAt desc
```

`onSnapshot` → updates list live when new messages arrive or conversations update.

---

## Search

Client-side filter on `conversation.participants[uid].displayName` for all participants except self.

---

## Conversation Item Rendering

Each item shows:
- Avatar (for DM: other participant's photo; for group: group photo or initials)
- Display name (DM: other person's name; group: group name)
- Last message preview: "You: [text]" if own, otherwise just "[text]"
- Relative timestamp (e.g., "2 min ago")
- Unread badge: `unreadCount[userId]` — orange circle

---

## Selected State

Active conversation: orange-50 background, orange-500 left border.

---

## New Conversation

"New message" button → `Sheet` (mobile) or `Dialog` (desktop) → `NewConversationPicker`.

---

## NewConversationPicker

`src/components/messages/new-conversation-picker.tsx`

- Loads all teachers (200 max) via `getAllTeachersAction()`
- Search filter on names
- Connection state per teacher (connected / pending / not connected)
- "Message" button (connected) → `getOrCreateDirectConversationAction(myUid, targetUid)` → opens thread
- "Connect" button (not connected) → `sendConnectionRequestAction()`
- Footer: "You can only message connected teachers"
