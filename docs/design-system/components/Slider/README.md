One number from a range on a single row: an eyebrow label, a saffron track with a white thumb, and the value.

**Use**
- For a count the teacher tunes rather than types: questions in a quiz (1 to 20), copies to print, lesson length in 5-minute steps.
- For three to five named choices use `SegmentedControl`; for an exact large number use a `Field` with `inputMode="numeric"`.

**The consumer provides** `label`, `min`, `max`, `step`, and either `value` with `onChange(value)` or `defaultValue`. Give `unit` ("questions") or `valueText` so a screen reader says "5 questions", and `format` when the visible value needs a unit ("40 min").

**States**
- Rest: track 5px, `border-row` behind and `saffron-500` up to the thumb; thumb 21px `milk-50` with a 2px `saffron-500` edge; value 14px/700 display `saffron-600`.
- Dragging: the thumb grows to 115%.
- Disabled: 55% opacity.

**Rules**
- It is a native range input: arrow keys step, Page Up and Page Down jump, Home and End go to the ends. The input row is 44px tall for touch; its focus outline is the system pill around the track.
- The visible value is `aria-hidden`; the input itself announces `aria-valuetext`.
- Label 12px/600, 0.14em tracking, capitals, `text-eyebrow`; Indic labels are not uppercased and take 12px.
- Keep the value short (two or three characters, or "40 min") so the track keeps its width.
