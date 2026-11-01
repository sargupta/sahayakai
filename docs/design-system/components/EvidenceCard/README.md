The real records VIDYA must quote in a parent message: a tinted card of marks or dates under a worded flag.

**Use** in step 2 of contacting a parent, between the sheet's header and the teacher's optional note. It shows exactly what VIDYA will be given, so the teacher can check it before the message is written.
- `tone="red"` with "Recent marks · VIDYA cites the lowest" and "At risk" for an academic concern, or with the register's dates for absences.
- `tone="leaf"` with "VIDYA cites the best" and "Improving" for positive feedback.
- `tone="amber"` for a slipping trend.

**The consumer provides** `title`, `flag`, `tone`, and `rows` of `label` and `value` from the school's own mark book or register, newest first, with an optional spoken `valueLabel` ("6 out of 25, 24 percent"). `muted` marks a row VIDYA will not cite. `footnote` can say where the records come from.

**Anatomy**: the tone's row tint and edge (`red-row` / `red-row-border` and its leaf and amber twins), `radius-card`, 14px 15px. A 12px/600 tracked title in the deep tone sits beside a solid flag pill (`red-500`, `leaf-500` or `amber-500`, white text). Below it, records sit 9px apart: the label at 12px/400 in ink, the value at 12px/600 in the deep tone.

**Rules**
- Nothing here is generated. If a record is missing, leave it out; never estimate one.
- The flag always says the status in words; the tint repeats it.
- It is a `section` named by its `h3`; the rows are a description list.
- The title balances over two lines when it does not fit one. Indic titles and flags render at 12px and are never uppercased.
