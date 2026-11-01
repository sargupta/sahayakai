A radio card for why the teacher is contacting a parent: a 40px tinted icon tile, the reason and what it means.

**Use** four to a sheet, 8px apart in a `radiogroup` (`.sk-reasonopt-group`) named by the "Reason for outreach" eyebrow: Consecutive absences, Academic concern, Behavioural concern, Positive feedback. The choice decides which records VIDYA is given next (marks, the register or the teacher's note).

**The consumer provides** the shared `name`, each option's `value`, `kind` (or `icon` and `tone`), `title` and `description`, plus `checked` and `onChange` (or `defaultChecked`).

**Kinds**
- `absence`: a calendar with a cross on red at 10%, `red-700`.
- `academic`: trend-down on `accent-tint`, `saffron-600`.
- `behaviour`: alert on amber at 10%, `saffron-700`.
- `positive`: a star on `leaf-tint`, `leaf-700`.

**States**
- Rest: `surface-card` with a `border-row` edge and `radius-tile`.
- Checked: a 1.5px `saffron-500` edge, the `accent-tint` fill, `shadow-current`, a solid `saffron-500` tile with a white glyph, a `saffron-700` description and a 20px check disc.
- Disabled: 45% opacity.

**Rules**
- Each card is a `<label>` around a real radio input, so the browser gives the group one tab stop, arrow-key movement and Space to choose. The title names the radio; the description describes it.
- The checked look is read from the input itself (`:checked`), so controlled and uncontrolled groups draw the same.
- Focus draws the 2px `saffron-600` outline around the whole card.
- Cards draw 68px tall. Indic titles and descriptions render at 1.6 line height, descriptions at 12px.
