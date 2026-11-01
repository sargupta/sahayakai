The action row on every generated output: one glass pill per action, each with a glyph and a word.

Every output wears the same chrome: its title and provenance, the artefact, this row, then one primary action. The row is a toolbar, so it is one tab stop and the arrow keys move between pills.

**Use**
- `set="revise"` (Edit · Regenerate · Download · Share) is the output chrome: lesson plans, exam papers, visual aids, quizzes.
- `set="save"` (Copy · Save · PDF · Edit · Share) on tool outputs a teacher keeps and reuses: rubrics, worksheets.
- `actions` to change the row. Mix preset keys with objects, and give an object `pressed` to make it a toggle: the quiz's "Answer key" fills `indigo-500` while the key is shown.
- `size="md"` (12px, 35px tall, a soft lift) on the read-back outputs (lesson plan, exam paper, visual aid); `sm` (12px, 32px) elsewhere.
- `bleed` on a phone screen: the row scrolls under the 20px gutters to the screen edges, the way a chip row does.
- `wrap` only where the row must stay fully visible and there is room for a second line.

**The consumer provides** `onAction(key)` or per-action `onClick`, a toolbar `label` that names the output ("Exam paper actions"), and translated words through `labels` (`{ edit: 'बदलें' }`).

**States**
- Rest: `surface-glass-strong` with a `border-glass` edge; the glyph in `text-body`, the word in `text-strong`.
- Pressed toggle: solid `indigo-500`, white glyph and word, `aria-pressed="true"`.
- Disabled: 45% opacity (an action that needs the network while offline).
- Overflowing: the row scrolls sideways inside its own box and the edge that has more fades out. The page never widens.

**Rules**
- Never an icon without its word: the word is the accessible name.
- Pills are at least 44px tall to the touch (`sk-hit`) and wider than 44px.
- One tab stop: Arrow keys, Home and End move focus; disabled pills are skipped.
- Indic words render at 12px and are never tracked or truncated; the row scrolls instead.
- The row carries no primary action. The output's one primary action is a `Button` below the artefact.
