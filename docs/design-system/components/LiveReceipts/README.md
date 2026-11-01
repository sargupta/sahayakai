VIDYA's visible receipts while she works: what she heard, the board and book she matched, and what she is building now.

**Use** under the working orb in VIDYA Live. Inside the `VoiceSheet`, use `ChecklistStep`; the Live receipts are larger (13px rows, 18px solid marks) because the teacher reads them at arm's length.
- Add `offers` for extra work VIDYA will do only if tapped ("Make a worksheet", "Add a diagram"). The card always says "Nothing paid runs until you tap it."

**The consumer provides** `items` in order, each `{ status, label }`. Labels are specific and board-aware: "Heard: lesson plan, water cycle, Class 6", "Matched CBSE · NCERT Curiosity 6, Ch 8", "Building a 40-minute plan…". For `offers`, each `{ label, onClick }`, plus `added` once tapped.

**States**
- `done`: an 18px `leaf-500` disc with a white check, `text-strong` words.
- `current`: a 2px `indigo-500` ring (22px overall, centred on the same axis), `indigo-500` words, `aria-current="step"`.
- `pending`: a 2px `ring-idle` ring, `text-muted` words.
- Offer added: a check replaces the plus, on a leaf tint, with `aria-pressed="true"`.

**Rules**
- An ordered list; every step's status is also said in words ("done", "in progress"). Colour is never the only signal.
- Ground in the board, never "NCERT" alone; for a state board name it ("Karnataka State Board (KSEEB) · Class 7").
- Offers are buttons drawn at 33px with a 44px touch area. Nothing runs, and nothing is charged, until one is tapped.
