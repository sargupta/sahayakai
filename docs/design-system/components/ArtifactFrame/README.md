The output view for what VIDYA made: title, fact pills, section tiles, the AI disclosure, and Deliver beside Edit.

Every lesson plan, worksheet or explanation VIDYA writes opens in this frame, so the teacher always reads the same order: what it is, which class and curriculum it fits, what it says, and what to do next.

**Use**
- One per screen, as the screen's content. Pass `fill` inside a phone screen: the sections scroll and the last tile stretches down to the buttons.
- Park the ready orb (`Orb state="ready"`) with `.sk-orb-park--cta` so it sits `orb-park-bottom-cta` (172px) above the foot, clear of the buttons.
- Replace the button pair with `footer` when the artifact needs a different secondary action ("Answer key" for a quiz, "Weights" for a rubric). Keep one primary.

**The consumer provides**
- `title`, rendered as the page's `<h1>`.
- `meta`: the fact pills, in this order: class and length (`leaf`), the board-aware curriculum (`indigo`, for example "CBSE · NCERT Ch 8", "ICSE" or "Karnataka State Board (KSEEB)"), then the language (`amber`, with `lang`).
- `sections`: `{ title, body }` tiles in teaching order ("Hook · 5 min").
- `provenance`: what the artifact is grounded in ("Grounded in CBSE · NCERT Ganita Prakash 7, Chapter 8.").
- `onDeliver` and `onEdit`, plus translated `deliverLabel`, `editLabel` and `disclosure` for non-English screens.

**States**
- Ready: the sections are final and Deliver is live.
- `streaming`: VIDYA is still writing. The section list becomes a polite live region, a pending tile in `indigo-500` names what is being written ("Writing board work…") over a shimmer bar, and Deliver is disabled until the text is complete. The words carry the state; the shimmer stops under reduced motion.

**Rules**
- The disclosure line always shows, in `text-muted` at 12px under the pills. `provenance` is added before it and never replaces it. Do not pass an empty `disclosure`.
- Tiles are `surface-glass-strong` with a `border-glass` edge, `radius-tile`, padded 13px 14px; the tile title is 12px semibold, the body 12px/1.6 in `text-body`.
- Name the board and textbook in the pills and provenance. Never imply every school follows NCERT.
- Indic titles and bodies are never truncated; bodies take a 1.7 line height and Indic pills render at 12px.
