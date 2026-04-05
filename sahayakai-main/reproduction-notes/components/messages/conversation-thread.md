# ConversationThread Component

**File:** `src/components/messages/conversation-thread.tsx`

---

## Purpose

Main chat view for a single DM or group conversation. Real-time message display, text + resource + voice input, resource sharing picker.

---

## Props

```ts
{
  conversation: Conversation;
  onBack?: () => void;          // mobile: back to list
}
```

---

## State

| State | Type | Purpose |
|---|---|---|
| `messages` | `Message[]` | Real-time message list |
| `input` | `string` | Text input |
| `sending` | `boolean` | Send in flight |
| `loading` | `boolean` | Initial load |
| `resourcePickerOpen` | `boolean` | Popover open |

---

## Real-Time Listener

```
collection: conversations/{convId}/messages
query: orderBy("createdAt", "asc"), limitToLast(100)
```

`onSnapshot` → `setMessages()`. Cleanup on unmount.

---

## handleSend(text, type, resource?, audioUrl?, audioDuration?)

```
1. Guard: !user || sending → return
2. Guard: type=text → !trimmed → return; type=audio → !audioUrl → return
3. setInput("")
4. setSending(true)
5. await sendMessageAction({ conversationId, text, type, resource, audioUrl, audioDuration })
6. finally: setSending(false), focus textarea
```

---

## Resource Sharing (Popover)

SHAREABLE_TYPES config:
```
lesson-plan   → /lesson-plan  → BookOpen
quiz          → /quiz-generator → ClipboardCheck
worksheet     → /worksheet-wizard → FileSignature
visual-aid    → /visual-aid-designer → Images
field-trip    → /virtual-field-trip → Globe2
rubric        → /rubric-generator → Wand2
training      → /teacher-training → GraduationCap
```

Clicking a type: navigates to the tool page. When teacher generates and saves there, they return to messages and share from library (separate flow, no direct integration here).

---

## Mark as Read

`useEffect` on `[conversation.id, user]`:
```
markConversationReadAction(conversation.id, user.uid)
```
Called once when conversation opens.

---

## Auto-Scroll

```
useEffect on [messages]:
  bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
```

---

## Input Bar Layout

```
[Popover trigger: Paperclip icon]
[Textarea: Shift+Enter newline, Enter sends]
[VoiceRecorder]
[Send button: orange-500]
```

Textarea config:
- `min-h-[40px] max-h-32` (auto-grow up to 132px)
- `rows={1}`, `resize-none`
- `maxLength={1000}`

---

## Design

- Thread fills full height of parent container
- Header: back arrow (mobile) + avatar + name + online dot
- Bubble alignment: own = right, other = left
- Bottom padding: enough to not overlap with input bar
