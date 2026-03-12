# MessageBubble Component

**File:** `src/components/messages/message-bubble.tsx`

---

## Purpose

Renders a single message in a DM conversation thread. Handles 3 message types: text, resource (shared educational content), audio (voice message).

---

## Props

```ts
{
  message: Message;
  isOwn: boolean;              // current user sent this
  participantIds: string[];    // for read receipt
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

```
Own:    bg-orange-500 text-white rounded-br-sm
Other:  bg-slate-100 text-slate-800 rounded-bl-sm
Both:   px-3.5 py-2 rounded-2xl text-sm leading-relaxed font-medium break-words
```

---

## AudioBubble Sub-Component

```tsx
function AudioBubble({ audioUrl, duration, isOwn }) {
  return (
    <div className="flex items-center gap-2 min-w-[160px]">
      <div className={isOwn ? "p-1.5 rounded-full bg-white/20" : "p-1.5 rounded-full bg-orange-100"}>
        <Mic className={isOwn ? "h-3.5 w-3.5 text-white" : "h-3.5 w-3.5 text-orange-500"} />
      </div>
      <audio src={audioUrl} controls preload="metadata"
             className="h-8 flex-1 min-w-0"
             style={{ colorScheme: 'normal' }} />
      {duration && (
        <span className={isOwn ? "text-[10px] text-white/70" : "text-[10px] text-slate-400"}>
          {formatDuration(duration)}
        </span>
      )}
    </div>
  );
}
```

---

## ResourceCard Sub-Component

Type-to-config mapping (`RESOURCE_CONFIG`):
```
lesson-plan:         bg-orange-50 border-orange-200 text-orange-700, BookOpen
quiz:                bg-blue-50 border-blue-200 text-blue-700, ClipboardCheck
worksheet:           bg-green-50 border-green-200 text-green-700, FileSignature
visual-aid:          bg-purple-50 border-purple-200 text-purple-700, Images
virtual-field-trip:  bg-teal-50 border-teal-200 text-teal-700, Globe2
rubric:              bg-rose-50 border-rose-200 text-rose-700, Table
teacher-training:    bg-amber-50 border-amber-200 text-amber-700, GraduationCap
```

Shows grade + subject badges + "Open in Tool" button → navigates to `resource.route`.

---

## ReadReceipt Sub-Component

```tsx
function ReadReceipt({ readBy, participantIds }) {
  const allRead = participantIds.every(uid => readBy.includes(uid));
  return allRead
    ? <CheckCheck className="h-3 w-3 text-blue-300" />   // blue double-check = all read
    : <Check className="h-3 w-3 text-white/50" />;       // single white check = sent
}
```

Only shown for `isOwn` messages.
