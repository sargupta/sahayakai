One choice from two to four options, side by side in a glass pill: difficulty, or questions versus answer key.

**Use** when the options are few, short and mutually exclusive, and switching them changes what is on screen right now ("Easy · Medium · Hard" on a quiz). For more options, or options that need a second line, use a `Field` select with an `OptionSheet`. For several choices at once, use `Chip`s.

**The consumer provides** `options` (strings, or `{ value, label, lang }`), either `value` + `onChange` or `defaultValue`, and `label`: the group's accessible name, translated ("Difficulty").

**Anatomy:** a `radius-pill` container of 62% white with a `border-glass` edge, 4px padding and 5px gaps. Equal segments are 600 12px `ink-600` with 8px vertical padding. The chosen segment is solid `accent-fill` with white text.

**Rules**
- A `role="radiogroup"` of `role="radio"` buttons. Only the chosen segment is in the tab order. Arrow keys move and select, wrapping at the ends; Home and End jump.
- Segments draw at 31px tall; their touch area extends to 44px. At the phone's 360px width the control spans the 320px between the gutters, so three segments are about 100px each.
- Labels are one or two words and never truncate. Indic labels get an 18px line.
- White on `accent-fill` (`saffron-600`) is 5.28:1, at 600 weight. The chosen state is also `aria-checked`.
- When the choice changes content, update that content in place and say so politely (`aria-live`), as the quiz does.
