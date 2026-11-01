A checkbox card for one way to reach a parent: the channel in words, the masked number on record, who answers and when.

**Use**
- In a "Send to" `fieldset` with a `legend`, one card per number on the student's record ("WhatsApp · ••••••4412", "Mother · preferred"; "Voice call · ••••••8830", "Father · after 6 pm"). The teacher may pick more than one.
- `reason` (amber, clock glyph) when the school's calling hours delay a call: "Goes out at 18:00, inside the school's calling hours". The option stays selectable.
- `disabled` with `reasonTone="muted"` (lock glyph) when there is nothing to dial: "No number on Divya's record. I only call numbers on the record."

**The consumer provides** `channel`, `number`, `who`, `when`, `checked` + `onChange` (or `defaultChecked`), and a translated `numberLabel` in other languages.

**States**
- Unchecked: `surface-glass-soft`, 1px `border-glass`, a 20px box with a 1.5px 20% ink edge and 7px corners.
- Checked: 92% white, a 2px `leaf-500` edge (1px border plus a 1px inset ring, so nothing shifts), a leaf shadow, and a `leaf-500` box with the white check glyph.
- Disabled: `fill-subtle` ground, muted title, dashed box, the reason in `text-body`.
- Focus: the system outline goes round the whole card, because the real checkbox inside is visually hidden.

**Rules**
- A real `<input type="checkbox">` inside a `<label>`: the whole card toggles it and it is at least `target-min` tall. Meta and reason are tied with `aria-describedby`.
- Numbers are always masked to the last four digits only; the component masks a raw number itself and reads it as "number ending 4412".
- Only numbers on the student's record are offered. Never a free-text number field here.
- Name the channel in words. No brand logos, no colour for the channel itself: leaf means selected.
