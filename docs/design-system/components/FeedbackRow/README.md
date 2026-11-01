"Was this helpful?" under a generated output, with a thumb up and a thumb down that VIDYA answers with thanks.

**Use**
- Under every generated output (lesson plan, quiz, rubric, worksheet), above its actions.
- `align="spread"` (default) when the row has the width to itself; `align="start"` when the orb is parked at the right of the same band; `align="end"` when it is parked at the left.

**The consumer provides** `onChange(value)` to record `'up'`, `'down'` or `null`, `value` or `defaultValue`, and translated `text` (the question, both thanks lines and both thumb names).

**States**
- Unanswered: the question in `text-body`; the thumbs are 32px glass discs, up drawn in `leaf-700`, down in `red-700`.
- Up: the up disc fills `leaf-500` with a white glyph; the question becomes "Thanks. I’ll keep making them like this."
- Down: the down disc fills `red-500` with a white glyph; the question becomes "Thanks. Tell me what to change and I’ll redo it."
- Pressing the chosen thumb again clears it.

**Rules**
- Each thumb is a toggle with `aria-pressed` and a name ("Helpful", "Not helpful"); its touch area reaches 44px.
- The thanks line is announced politely (`aria-live`). VIDYA speaks in the first person.
- Colour is never alone: the thanks line changes with the choice.
