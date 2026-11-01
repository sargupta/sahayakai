One number and what it counts: three across on a results screen, or larger with a worded change on the web console.

**Use**
- `size="sm"` (default) three across with a 7px gap at the top of a results screen ("68% Class average", "4 Weak concepts", "11 Need help").
- `tone="red"` only when the number is a problem the label names ("Weak concepts"); `leaf` and `indigo` likewise only when they carry meaning.
- `size="lg"` on the web app and the school console, three or four across: a 26px value, a worded `delta` and an optional `series` sparkline ("38 · Calls to families · today · 212 in the last 7 days").

**The consumer provides** `value` (formatted for the teacher's locale), `label` (what is counted and, on the console, the window: "Parent calls · last 7 days") and, for `lg`, `delta`, `deltaTone` and `series` from real data.

**States**
- sm: `surface-glass-strong` with `border-glass`, `radius-field`, 11px 12px padding; value 18px/700 display, label 12px `text-body`.
- lg: `surface-card` with `border-hairline`, `radius-card`, 16px 18px padding; value 26px/700 display with tabular figures, label 12px.
- Delta: `leaf-700` when good, `red-700` when bad, `text-body` when flat.

**Rules**
- Colour never carries the meaning alone: the label or the delta says it in words ("+12 calls this week", "3 points lower than Monday"). Never show a bare percentage change.
- The sparkline is decorative (`aria-hidden`) and takes the delta's tone.
- No filler stats. A number that comes from demo or sample data is labelled as such on the screen.
- Indic labels render at 12px and may wrap; the value never wraps.
