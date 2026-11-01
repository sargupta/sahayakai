Conversation: the typed or turn-based thread with VIDYA, from the teacher's ask to a grounded answer and the next ask.

Built from the following:
- a `ChatHeader` (back, "VIDYA", settings);
- a `ChatThread` with the "Today" chip, the teacher's `ChatBubble`s, VIDYA's `AnswerCard` with its board-aware source ("CBSE · NCERT Curiosity 6, Ch 8"), a `TypingIndicator`, and refine `Chip`s;
- a `Composer` in its `chat` variant, with send and mic.

**Where it fits.** The conversation is for working something out over several typed or spoken turns. VIDYA Live is hands-free voice around the large orb. The ask-in-place `VoiceSheet` is a quick ask about the page the teacher is on. Every conversation, typed or Live, is kept in Library → Conversations, never as a Generation.

The screen has no tab bar or parked orb: VIDYA is already the subject of the screen, and her mark beside each reply is the orb. The ground is the plain `wash-screen`. The teacher's turns may be code-mixed ("Class 6 ke liye jal chakra ka 40-minute lesson plan banao"); VIDYA answers in the teacher's language and names the board and book of anything she grounds.
