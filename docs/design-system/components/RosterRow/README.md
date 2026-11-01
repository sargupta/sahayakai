One student in the roll call: roll number, name and a status mark, with P and A buttons on the row being marked.

**Use** in the roll call, one row per student, 7px apart in `<ul class="sk-rosterrow-list">` named for the class ("Class 7 register"). Voice marks rows as the teacher reads names; the buttons are for correcting or marking by hand.
- `current` on the one row being marked now. It shows P and A; `onMark` receives `'present'` or `'absent'`, or `'unmarked'` when the pressed one is pressed again.
- `onClick` on any other row makes it a button, so the teacher can make it current and correct it.

**The consumer provides** `number`, `name`, `status` and, translated, `statusLabels`, `markLabels` and `lateMark`.

**States**
- Present: `leaf-row` with `leaf-row-border`; a 22px `leaf-500` disc with a white check.
- Late: `amber-row` with `amber-row-border`; number and name `saffron-700`; "L" on `amber-500`.
- Absent: `red-row` with `red-row-border`; number and name `red-700`; a white cross on `red-500`.
- Unmarked: `surface-glass` with `border-glass`; an empty 22px ring.
- Current: `surface-card`, a 2px `saffron-500` edge, `shadow-current`, a bold name, P (solid `leaf-500`) and A (7% ink). The pressed choice takes a 2px ring in its own colour; when A is pressed it turns `red-500` and P turns grey.

**Rules**
- Each row reads as "3, Bhavna Patil, not marked": the status word is visually hidden, and the marks are `aria-hidden`.
- P and A are `aria-pressed` buttons named "Present, Bhavna Patil" and "Absent, Bhavna Patil". They draw at 27×26px; their touch areas extend to 44px without overlapping.
- Rows draw 46px tall (the current row 50px). Name 13px/500, number 12px/500 in a 16px column. A translated `lateMark` ("दे") renders at 12px.
- Colour never carries the status alone: the mark's shape and the hidden word say it too.
