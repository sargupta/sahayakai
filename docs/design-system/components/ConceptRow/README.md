How well one student holds one concept: the concept, a worded level with the score, and a bar in the level's colour.

**Use** on the student page under "Where she's struggling", weakest first, rows 9px apart in `<ul class="sk-conceptrow-list">`. Name concepts as the chapter does, and show the board and book once beside the eyebrow.

**The consumer provides** `concept`, `value` and `max`, and translated `levelLabels` and `scoreText`.

**Levels**
- Under 50%: "Needs practice", `red-700` words and a `red-500` fill.
- 50 to 79%: "Getting there", `saffron-700` words and a `saffron-500` fill.
- 80% and over: "Secure", `leaf-700` words and a `leaf-500` fill.

**Anatomy**: a `surface-glass-soft` card with `border-glass`, `radius-card`, 13px 15px and `shadow-post`. The concept is 14px/600; the level word 12px/500 and the score 14px/600 sit on the right. The bar is a 6px `ProgressBar` on a `fill-mark` track, 9px below.

**Rules**
- Colour never stands alone: the level is always written beside the score.
- The bar is the row's only reading for assistive tech ("Condensation, 2 of 5, Needs practice"); the drawn line above it is hidden, so nothing is read twice.
- Indic concepts and level words render at 1.6 line height and are never truncated.
