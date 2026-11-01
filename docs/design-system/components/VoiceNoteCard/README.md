The spoken copy of a parent message for parents who can't read: same words, same language, with a play disc and length.

**Use** directly under the `MessagePreview` it speaks, whenever a message goes to a parent. It travels with the text, so a parent who cannot read still hears exactly what the teacher approved.

**The consumer provides**
- `duration` in seconds (the default copy reads "A 20-second voice note in the same words").
- `playing`, `elapsed` and `onToggle` from the audio player, or nothing for a disc that toggles on its own.
- Translated `eyebrow`, `title`, `playLabel` and `pauseLabel` with `lang` when the app runs in another language.

**Anatomy:** a `leaf-tint` card with a 20% leaf edge and 22px corners, 15px 16px padding; a 38px `leaf-500` disc (touch area 44px) with the play or pause glyph; a 12px tracked eyebrow and a 13px/1.6 line in deep leaf #1C4A1D (9.6:1); the length at the right in tabular figures.

**States**
- Ready: play glyph, "0:20".
- Playing: pause glyph, "0:07 / 0:20" and a 3px leaf progress line under the text.
- Disabled: while VIDYA is still recording the note.

**Rules**
- The disc is a real button named "Play voice note, 20 seconds" / "Pause voice note". The card is a group named by its two lines.
- The voice reads the message word for word. It never adds a greeting, a name or a mark the text does not have.
- Indic labels are not uppercased or tracked and render at 12px.
