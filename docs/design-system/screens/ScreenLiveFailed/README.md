VIDYA Live, failed: the line dropped, VIDYA keeps what she caught and the teacher finishes the task by typing.

**The state** VIDYA couldn't hear. The screen takes `wash-live-failed`, with no glow and no orb; the pill is solid red, "Couldn’t hear". `LiveError` says what happened in VIDYA's words; the "What I caught" `LiveTranscript` marks the lost span; a `Field` holds the request to finish without voice, with its parameters as chips; a saffron `NoticeCard` explains why she stays on typing on 2G; a `Switch` retries voice once when the signal returns.

**How the teacher gets here** The connection dropped mid-sentence during Live. Live opens from the ask-in-place `VoiceSheet` ("Keep talking"), never by holding the orb; on the web, "Talk to VIDYA" starts it directly.

**Recovering** The primary action finishes the task typed ("Make the quiz"); the mic disc tries voice again. Nothing is lost: her last three requests are saved as drafts in Library whatever happens to the signal. Barge-in still applies once voice is back: talking over VIDYA returns her to listening.

**How it ends** Making the quiz, or End from a later state, returns the teacher to the page she came from. The quiz is one Generation; the conversation, including what was caught, is kept in Library under Conversations.

Built from `PhoneScreen` (`wash: 'live-failed'`, network "2g"), `LiveHeader` with a failed `LiveStatus`, `LiveError`, `LiveTranscript` (caught), `Field`, `Chip`, `NoticeCard`, `GlassCard` with `Switch`, and `LiveControls` in failed mode.
