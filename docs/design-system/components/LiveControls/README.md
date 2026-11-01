The foot of VIDYA Live: the few controls each state needs, every one a real, labelled button of 44px or more.

**Use** as the last child of the Live screen body. It carries the screen's bottom spacing.
- `mode="listening"`: three 50px glass discs (52 overall): Type (keyboard and "Type"), Mute (mic-off and "Mute", a toggle) and End (a cross).
- `mode="working"`: one wide 48px glass "Stop".
- `mode="speaking"`: a wide "Pause" that turns into "Resume", and an End disc.
- `mode="failed"`: a 48px mic disc to try voice again, and the primary saffron action that finishes the task typed ("Make the quiz").

**The consumer provides** the handlers for the mode (`onType`, `onMute` with `muted`, `onEnd`, `onStop`, `onPause`/`onResume` with `paused`, `onMic`, `onCta` with `ctaLabel`) and translated labels.

**Rules**
- End stops the conversation and returns the teacher to the page she came from. Stop ends only the work in progress; she stays in Live, listening.
- Type leaves Live for the composer with the words so far; voice never traps the teacher.
- Mute is `aria-pressed`; its name stays "Mute" and its disc turns `ink-800` while pressed. Glyph-only discs carry an `aria-label` ("End conversation", "Try voice again").
- Disc labels are 12px in every script, `text-muted`. Glyphs come from the icon set; never ✕, Aa or other text symbols.
- One primary action, and only after a failure.
