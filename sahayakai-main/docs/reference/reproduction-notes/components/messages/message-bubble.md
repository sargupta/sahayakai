# MessageBubble Component

**File:** `src/components/messages/message-bubble.tsx`

_Last verified against source: 2026-06-10._

---

## Purpose

Renders a single message in a DM/group thread. Handles the 3 `MessageType` values: `text`, `resource` (shared educational content), `audio` (voice message).

---

## Props

```ts
{
  message: Message;
  isOwn: boolean;               // current user sent this
  showAvatar: boolean;          // first-in-group flag (avatar/name shown)
  participantIds: string[];     // for delivery/read status
  onRetry?: (message: Message) => void;   // retry a failed optimistic send
}
```

---

## Layout

```
Flex row (isOwn: flex-row-reverse):
├── Avatar (left for others, right for own)
└── Content column
    ├── Sender name (only for others, only on first in group)
    ├── Message bubble
    │   ├── Text: plain text
    │   ├── Resource: ResourceCard
    │   └── Audio: AudioBubble
    └── Timestamp + ReadReceipt (isOwn only)
```

---

## Message Type Rendering

### Text (`type === 'text'`)
```tsx
<p className="text-sm leading-relaxed font-medium break-words">{message.text}</p>
```

### Resource (`type === 'resource'`)
```tsx
<ResourceCard resource={message.resource} isOwn={isOwn} />
```
Shows: type icon, title, grade/subject badges, "Open in Tool" button.

### Audio (`type === 'audio'`)
```tsx
<AudioBubble audioUrl={message.audioUrl} duration={message.audioDuration} isOwn={isOwn} />
```
Shows: Mic icon + `<audio controls>` player + optional duration label.

---

## Bubble Styles

Own bubbles use the primary token (`bg-primary` + primary-foreground text, `rounded-br-sm`); other bubbles use a muted surface (`rounded-bl-sm`). Avoid hardcoded `orange-500`/`slate-100`.

---

## AudioBubble Sub-Component

Renders a `Mic` icon chip plus a native `<audio controls preload="metadata" />` (`h-8 flex-1 min-w-0`, `style={{ colorScheme: 'normal' }}` to defeat dark-mode inversion) and an optional formatted duration label. Chip/label colors follow own-vs-other theme tokens.

---

## ResourceCard / RESOURCE_CONFIG

Per content-type config (color + icon). Verified entries include:
```
worksheet         -> emerald accent,  (resource icon)
visual-aid        -> pink accent
rubric            -> violet accent,    GraduationCap
teacher-training  -> amber accent,     Wand2
```
(Note: rubric uses `GraduationCap` and teacher-training uses `Wand2` here - the legacy doc's `Table`/`GraduationCap` mapping is stale.)

Shows grade + subject badges + an open/"Open in Tool" action that navigates to the resource's route.

TODO(verify: the complete current RESOURCE_CONFIG table - color + icon for every content type.)

---

## Delivery / Read Status (DeliveryStatus)

For `isOwn` messages the bubble renders a delivery-status tick reflecting `DeliveryStatus = 'sending' | 'sent' | 'delivered' | 'read' | 'failed'`:
- sending -> spinner/clock
- sent/delivered -> single/double check
- read -> highlighted double check
- failed -> error affordance wired to `onRetry(message)`

TODO(verify: exact icon per DeliveryStatus value.)
