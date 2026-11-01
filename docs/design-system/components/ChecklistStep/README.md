One line of VIDYA's progress while she works: a done check, a breathing ring for the current step, or a faint ring.

**Use** in the working sheet, under VIDYA's status line. Render the steps inside `<ol class="sk-checkliststep-list">` (6px apart) with an `aria-label` ("Progress"). Three to five steps; the last is always "Ready to deliver".

**The consumer provides** each step's text as `children` and its `status`. Done steps are past tense and name what VIDYA matched, including the board ("Matched CBSE · NCERT Ganita Prakash 7, Chapter 8", "Matched Karnataka State Board (KSEEB) · Class 7"); the active step is present tense ("Writing board work in हिन्दी"). Translate `statusLabel` with the rest of the UI.

**States**
- `done`: a `leaf-700` check on a 16px, 16% leaf disc; text `leaf-700`.
- `active`: a 2px ring at 35% `indigo-500` around a 16px hole that breathes (1.6s); text `indigo-500`; `aria-current="step"`.
- `pending`: a 2px ring at 16% ink; text `text-muted` (`ink-500`, 5.6:1).

**Rules**
- Text 12px/500. Each step also says its status in words, visually hidden ("done", "in progress", "not started").
- Exactly one step is active while VIDYA works. Under reduced motion the ring stops breathing; the colour and the word still say it.
- Every step's text starts on one line: the done disc sits in the same 20px slot as the rings.
