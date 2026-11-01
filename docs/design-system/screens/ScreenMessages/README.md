Messages: connection requests to accept, then conversations, with a nudge to find more teachers.

Built from the following:
- `ScreenHeader` ("Messages") with a New button;
- an indigo `NoticeCard` that states the rule: chat opens only after a teacher accepts your connection request;
- `MessageRow` requests with Accept, under "Pending requests";
- `MessageRow` conversations with an unread count, under "Conversations";
- a centred Find more teachers prompt (message glyph, one line, a text button);
- the parked `Orb` and the `TabBar` on Community.

Accepting a request turns its pill to Connected; only then can a chat open.
