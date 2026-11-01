The parked orb with a small capsule beside it that says what a tap does here: "Tap to speak", "Typing still works".

**Use**
- Park it on every app screen with `parked`: right 16 / bottom 100 (`orb-park-bottom`), above the tab bar. Over a full-width CTA use `parked="cta"` (bottom 172, `orb-park-bottom-cta`).
- `side="left"` when the teacher uses the left hand: the orb sits left 18 and the capsule reads to its right.
- `tone="strong"` when VIDYA offers something from the page ("Turn this post into a worksheet"): ink text on a raised capsule (`shadow-hint`).
- Match `state` to the orb: `offline` with "Typing still works", `ready` with a `badge` and what is ready.

**The consumer provides** `label` (a few words, translated), `state`, `badge`, `onClick` and the remembered `side`.

**Rules**
- The orb is the button (named "VIDYA"); the capsule is its description, tied with `aria-describedby`, and is not itself pressable.
- The capsule is `surface-capsule` with a `border-row` edge, 500 12px in `text-muted`; Indic labels render at 12px and wrap rather than truncate.
- One hint at a time, a few words long. It disappears while a sheet is open.
- The orb's touch area is at least 56px.
