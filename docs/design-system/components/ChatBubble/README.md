One turn in a conversation with VIDYA: the teacher's saffron bubble on the right, VIDYA's glass bubble on the left.

**Where it fits.** There are three ways to talk with VIDYA. The conversation (`ChatThread` of these bubbles) is the typed or turn-based thread. VIDYA Live is hands-free voice around the large orb. The ask-in-place `VoiceSheet` is a quick ask about the page the teacher is on. Every conversation, typed or Live, is kept in Library → Conversations, never as a Generation.

**Use**
- `from="teacher"` for what the teacher typed or said (a voice turn shows its transcript). Pass `initials` or `name` on the first turn so her 28px glass initials disc shows; later turns may drop it and sit flush right.
- `from="vidya"` for VIDYA's plain replies: questions back, confirmations, short explanations. VIDYA's mark is always the 28px resting orb (`orb-resting`), never an icon or a letter. In a run of VIDYA turns, pass `avatar={false}` on all but the newest; her column keeps its indent.
- For a result with a source and actions, use `AnswerCard`. While VIDYA writes, use `TypingIndicator`.

**The consumer provides** the message as `children`, `lang` for its language ("hi", or "hi-Latn" for Hindi typed in Latin letters) and a translated `senderLabel`.

**Anatomy**
- Teacher: `accent-fill` (`saffron-600`, white on it 5.28:1), white 500 14px/1.65, padding 13px 15px, radius 20 20 6 20 (`radius-panel`, tail `radius-xs`), `shadow-bubble-teacher`.
- VIDYA: white at 74% with a `border-glass` edge, `text-strong` 500 14px/1.7, padding 14px 15px, radius 20 20 20 6, `shadow-bubble`.
- Text is capped at `bubble-max` (260px); the mark sits 9px away, bottom-aligned.

**Rules**
- Each bubble starts with a visually hidden "You:" or "VIDYA:" so a screen reader always knows who spoke; the marks are hidden from assistive tech.
- VIDYA speaks in the first person, in sentence case, with no exclamation marks.
- Indic text gets a 1.7 line height and wraps; it is never truncated.
- Colour is meaning: saffron is the teacher's own voice and VIDYA's brand, never a status.
