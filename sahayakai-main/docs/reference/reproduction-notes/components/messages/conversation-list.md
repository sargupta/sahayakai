# ConversationList Component

**File:** `src/components/messages/conversation-list.tsx`

_Last verified against source: 2026-06-10._

---

## Purpose

Left-panel inbox showing all conversations. Real-time updates. Opens/creates conversations. Shows unread counts and presence.

---

## Props

```ts
{
  activeConversationId: string | null;     // note: activeConversationId, not selectedConversationId
  onSelect: (conversation: Conversation) => void;
  onNewDM: () => void;                       // open the new-DM flow
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
       orderBy lastMessageAt desc      (note: lastMessageAt, not updatedAt)
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
- Relative timestamp
- Unread badge: `unreadCount[userId]`, rendered on the avatar
- Presence: a `PresenceDot` shows the other participant's online state

---

## Selected State

Active conversation highlighted via theme tokens (accent background / primary accent), not hardcoded `orange-50`/`orange-500`.

---

## New Conversation

A new-DM affordance (`PenSquare` icon) calls the `onNewDM` prop, which the parent wires to its new-conversation picker flow.

---

## NewConversationPicker (parent-owned)

Note: ConversationList no longer owns the picker; it raises `onNewDM`. The picker itself lives separately. TODO(verify: current picker filename and its action names against source.)

`src/components/messages/new-conversation-picker.tsx`

- Loads all teachers (200 max) via `getAllTeachersAction()`
- Search filter on names
- Connection state per teacher (connected / pending / not connected)
- "Message" button (connected) → `getOrCreateDirectConversationAction(myUid, targetUid)` → opens thread
- "Connect" button (not connected) → `sendConnectionRequestAction()`
- Footer: "You can only message connected teachers"
