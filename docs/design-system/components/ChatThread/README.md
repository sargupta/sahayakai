The conversation with VIDYA: a day chip, the turns in a polite live log, and a wrapping row of refine chips.

**Where it fits.** Three ways to talk with VIDYA:
- The conversation (this thread) is the typed or turn-based back-and-forth, for working something out over several turns.
- VIDYA Live is hands-free voice: the teacher talks to the large orb and the screen takes VIDYA's state.
- The ask-in-place `VoiceSheet` is a quick ask about the current page, which then gets back to work.

Every conversation, typed or Live (as its transcript), is kept in Library → Conversations, never as a Generation. A chat never creates a Generation.

**Use** between a `ChatHeader` and a `Composer` in its `chat` variant. It fills the space between them and scrolls.

**The consumer provides**
- The turns as children, oldest first: `ChatBubble`, `AnswerCard`, and while VIDYA writes, one `TypingIndicator` last.
- `day` for the chip at the top ("Today").
- `refine` (one to three words each: "Make it easier", "In Marathi", "Add a diagram") and `onRefine`, which usually sends the chip as the teacher's next turn.
- Translated `label` and `refineLabel`.

**Anatomy:** turns sit 12px apart (`space-6`). The day chip is white at 70% (`surface-glass-soft`), `text-body` 500 12px, centred. The refine row follows the last turn 14px lower: ordinary `Chip`s, 7px apart, wrapping, never stretched.

**Rules**
- The turns are a `role="log"` with polite announcements of new turns only; the refine row sits outside the log, so changing chips is never read as a message.
- Refine chips are actions, not toggles: they carry no pressed state.
- The thread keeps the newest turn in view as turns arrive (`autoScroll`). Its scroller bleeds into the screen's 20px gutters so bubble shadows are never clipped; set `--sk-chat-bleed: 0` where there is no gutter.
- Refine chips act on VIDYA's last answer; drop them while she is writing if they no longer apply.
