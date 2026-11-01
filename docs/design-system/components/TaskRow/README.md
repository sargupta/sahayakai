A status dot, a label and a trailing action or status word: what is waiting for the teacher, or what is queued.

**Use**
- `variant="plain"` (default) inside the primary card ("Waiting for you"), 10px apart, each with `action="Open"`.
- `variant="boxed"` for a queue (the offline queue), 8px apart, each with a `meta` word ("waiting").
- `onAction` makes only the action a button; `onClick` makes the whole row one button. Use one or the other, never both.
- `as="li"` inside a `<ul>` named by the card's eyebrow.

**The consumer provides** `label` with a real count ("4 absentees to call", "34 test sheets to scan"), `dot`, `statusLabel` (the dot's meaning in words, translated), and `action` + `onAction`, `onClick`, or `meta`.

**Dots**
- `red`: urgent or absent · `amber`: to do, queued, waiting · `leaf`: ready, done · `saffron`: VIDYA, pending · `indigo`: working, curriculum.

**Rules**
- The dot never carries meaning alone: give `statusLabel`, or a `meta` word that says it.
- Label 12px/500 `text-strong`; action 12px/600 `saffron-600` (5.2:1); meta 12px/500 `text-body`.
- The action draws at text size; its touch area extends to at least 44 × 44px. A boxed row that is one button draws 39px; its touch area extends to 45px.
- Indic actions and meta words render at 12px.
- The action's name reads the action and the label together ("Open 4 absentees to call").
- Labels may wrap in long languages; never truncate them.
