One of VIDYA's readings of what the teacher said, chosen like a radio: a dot and a short line on a milk row.

**Use** inside VIDYA's listening sheet, under the quoted request, two or three rows 7px apart. Wrap the rows in an element with `role="radiogroup"`, an `aria-label` ("What I heard") and the class `sk-suggestionrow-group`.

**The consumer provides** each reading as `children`, written as short metadata joined by middle dots ("Worksheet · 10 questions · हिन्दी"), plus `value`, `selected` and `onSelect`. VIDYA's best guess comes first and starts selected.

**States**
- Rest: `surface-card` with a 1px `border-row` edge, `radius-row`, an 8px `dot-idle` dot.
- Selected (and pressed): `accent-tint` with an `accent-tint-border` edge and a `saffron-500` dot.
- Disabled: 55% opacity.

**Keyboard**
- Tab reaches the selected row only. Arrow keys move to the next or previous row and select it; Home and End jump to the first and last. Space and Enter select.

**Rules**
- Each row is a `button` with `role="radio"` and `aria-checked`. Keep exactly one row selected so the group has a tab stop.
- Label 12px/500 on one line; Latin text truncates with an ellipsis, Indic text wraps instead. Keep readings short enough not to need either.
- Rows draw 39px tall; the touch area extends to 45px.
