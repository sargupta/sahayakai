A rubric as a real table, criteria down the side and four levels across, that scrolls sideways inside its own card.

**Use**
- When the teacher needs to compare levels across criteria: grading with the rubric, printing it, sending it to a parent group.
- For reading and editing one criterion at a time on a phone, use stacked `RubricCriterion` tiles instead.
- `fill` inside a screen's flex column: the card takes the remaining height and the table sits at its top.

**The consumer provides** `criteria` (`name`, `description`, one `cells` entry per level), `levels` if not the default Exemplary · 4, Proficient · 3, Developing · 2, Beginning · 1, a `caption` naming the rubric, and translated `criteriaLabel` and `hint`.

**States**
- Wider than its card: the hint "Swipe the table sideways" with an arrow shows above it, the criteria column stays pinned, and the right edge of the body fades.
- Scrolled: the pinned column casts a soft edge over the levels.
- Fits: no hint, no fade; the table fills the card.

**Rules**
- Real `<table>` semantics: a caption, column headers (`scope="col"`) for the levels, row headers (`scope="row"`) for the criteria.
- The scroll box is focusable and labelled by the caption, so keyboard users scroll it with the arrow keys; its focus outline is never clipped.
- The page never widens: only the table moves.
- The header row is `saffron-600` so its 12px white words hold 5.4:1. Cells are 12px on `surface-card`; Indic text renders at 12px with a 1.7 line height.
