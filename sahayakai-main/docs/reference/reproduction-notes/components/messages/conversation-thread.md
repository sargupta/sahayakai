# ConversationThread Component

**File:** `src/components/messages/conversation-thread.tsx`

_Last verified against source: 2026-06-10._

---

## Purpose

Main chat view for a single DM or group conversation. Real-time, paginated message display with optimistic sending, typing indicators, text + resource + voice input, and a 2-step resource picker.

---

## Props

```ts
{
  conversation: Conversation;
  onBack?: () => void;          // mobile: back to list
}
```

TODO(verify: exact prop names against current source.)

---

## Hooks (the real engine)

This component is driven by custom hooks, NOT local `messages`/`sending` state:
- `usePaginatedMessages` - windowed message loading (load-older as you scroll up) instead of a single `limitToLast(100)` listener.
- `useMessageOutbox` - optimistic send + retry queue; sending goes through `sendWithOutbox(...)`. Failed sends surface a retry affordance rather than vanishing.
- `useTypingIndicator` - broadcasts/observes typing state.
- `LibraryPickerDialog` / `InlineResourcePicker` - resource attach flow.

---

## handleSend

Sends via the outbox (`sendWithOutbox`), which enqueues an optimistic message and reconciles on server ack (or marks failed for retry). Guards: empty text for `type=text`, missing `audioUrl` for `type=audio`.

---

## Resource Sharing (2-step InlineResourcePicker)

`SHAREABLE_TYPES` maps content types to their tool routes/icons. Note `lesson-plan` routes to `lesson-planner` (not `/lesson-plan`).

The picker is a 2-step inline flow (pick type, then pick a saved resource via `LibraryPickerDialog`) that attaches a resource message directly - this is a real in-thread share, not just a navigate-away.

TODO(verify: the full current `SHAREABLE_TYPES` route/icon table.)

---

## Other behaviour

- Mark-as-read on open (server action).
- Typing indicator row above the input.
- Header includes a `BackButton` (mobile) + participant identity + presence.
- Send button uses default (`bg-primary`) variant.

TODO(verify: textarea maxLength and exact input-bar composition in current source.)
