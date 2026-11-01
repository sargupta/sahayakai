Message to parents: what they will read, the same words as a voice note, and where it goes, sent with one tap.

Built from the following:
- a back-only `ScreenHeader`, then the page `ScreenHeader` ("Message to parents", "Written in Marathi. Read it before it goes.");
- a `MessagePreview` with the eyebrow "What they'll read";
- a `VoiceNoteCard` for parents who can't read;
- a "Send to" `fieldset` of `ChannelOption`s, one per number on the student's record;
- the trust line "No name or marks leave this phone without your tap." over the `success` `Button` "Send message", disabled while nothing is selected.

The message is always shown in the parent's script before it goes, never summarised in English.
