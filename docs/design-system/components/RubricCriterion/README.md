One rubric criterion as a tile: its name, what it covers and its weight, then its levels stacked with numbered badges.

A rubric on a phone is a column of these tiles when the teacher reads or edits it one criterion at a time. Each level is a row: a numbered badge, then what work at that level looks like.

**Use**
- Expanded for the criterion being read or edited; `collapsed` (name and weight only) for the rest.
- Pass `onToggle` to let the teacher open and close criteria. The header becomes a disclosure button with a chevron; the consumer flips `collapsed`.
- Give levels a `label` (Exemplary, Proficient, Developing, Beginning) when the rubric names its levels; give the criterion a `description` ("Uniqueness and aesthetic appeal").
- Stack criteria with a 10px gap under the rubric's title and its count line ("Rubric · 3 criteria · 4 levels").
- To compare levels across criteria, use `RubricTable`.

**The consumer provides** `name`, `weight` ("40%"), optional `description`, and `levels` as `{ score, descriptor, label }`, best first. On non-English screens, translated `levelLabel` and `weightLabel` (spoken only).

**States**
- Expanded: the levels list, 5px apart; a named level sets its name in 12px `text-strong` above the descriptor.
- Collapsed: one row, name (and description) at left, weight at right.
- With `onToggle`: `aria-expanded` on the header button; the chevron turns when open.

**Rules**
- Badge colours follow the score on a 4-level scale: 4 `leaf-500`, 3 `saffron-700`, 2 `amber-500`, 1 `red-500`, all with white 12px bold numbers (4.5:1 or better). Other scales spread over the same four, best to worst.
- The number in the badge carries the level, so colour is never alone. Screen readers hear "Level 4, Exemplary: Original design…".
- The weight is `saffron-600`, 12px semibold. The card is `surface-glass-strong` with a `border-glass` edge and `radius-tile`.
- The header button's touch area extends to 44px. Indic descriptors render at 12px with a 1.7 line height.
