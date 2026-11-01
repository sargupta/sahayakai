A row in Messages: a conversation (name, last line, time or unread count) or a request to connect with Accept.

**Use**
- Messages, under muted `Eyebrow`s: "Pending requests · 2" above request rows, "Conversations · 1" above chats. Stack rows 6px apart.
- A conversation row (`onOpen` or `href`) is one pressable card that opens the chat.
- `request` shows "Wants to connect" and the leaf Accept pill (`PersonAction`). Add `onDecline` for a quiet cross. Set `accepted` once accepted: the pill turns to "Connected", and the person moves to Conversations on the next visit.

**The consumer provides** `name`, `initials` if needed, `avatarTone`, `preview`, and `time` or `unread`; for requests, `onAccept`, `accepted` and optionally `onDecline`; translated `requestLabel`, `unreadLabel`, `acceptLabel` and `acceptedLabel`.

**States**
- Read: the time in `text-muted` at the end.
- Unread: a `saffron-600` count badge with white text instead of the time; assistive tech hears "2 unread messages".
- Request: plain glass row with Accept. Accepted: the quiet "Connected" with a tick.

**Rules**
- Chat opens only after a teacher accepts the request. A request row never opens a chat, and never offers Message.
- The conversation row is one button named "Aisha Khan, Sent you the photosynthesis sheet, 2 unread messages". Accept is named "Accept request from Suresh Reddy"; the cross "Decline request from Suresh Reddy".
- Previews truncate to one line in Latin scripts; Indic previews render at 12px with a 1.6 line height.
- Every person in samples is illustrative.
