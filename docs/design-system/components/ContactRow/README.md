One student in the parent-outreach list: name, a worded reason line in its tone, and one Contact button.

**Use** in the outreach list, grouped under worded headings (Consecutive absences, At risk academically, Celebrate), rows 7px apart in `<ul class="sk-contactrow-list">`. Contact opens the reason sheet for that parent.
- `highlighted` on the one parent being contacted now (its sheet is open), or on VIDYA's suggested first call.
- `done` once the parent has been reached ("Called · 10:40", "Message sent"): a leaf status replaces the button.

**The consumer provides** `name`, `meta`, `tone`, `onContact` and, translated, `actionLabel` and `contactLabel`.

**States**
- Rest: `surface-glass` with `border-glass`, `radius-tile` and `shadow-post`; Contact is a 12px/600 `saffron-600` outline pill with an `accent-outline` edge.
- Highlighted: `surface-float`, a 1.5px `saffron-500` edge and `shadow-current`; Contact is solid `saffron-600` with white text (5.4:1).
- Done: a `success-tint` pill with a check and `leaf-700` words.
- Meta tone: `red-700` absences, `saffron-700` at risk, `leaf-700` celebrate, `ink-600` neutral.

**Rules**
- The button's name is "Contact Omkar Naik’s parent", and the meta line describes it, so a screen reader hears why before it acts.
- The pill draws 30px tall; its touch area extends to 44px.
- Never put a phone number in the row: numbers appear only, masked, in the sheet that Contact opens, and calls go out only within the school's calling hours.
- Names truncate with an ellipsis in Latin scripts; Indic names wrap and are never cut.
