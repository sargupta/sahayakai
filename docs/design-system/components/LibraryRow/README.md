One saved Generation in My Library: a type badge, the title, when it was made, and its sync state in words.

**Use**
- My Library → Generations: one row per lesson plan, worksheet, quiz, visual aid, rubric or exam paper, 9px apart in a `<ul>` with `as="li"`.
- The offline queue: the same row with `badge` ("AT", "MSG") for things that are not Generations, and `status="waiting"`.
- `onClick` (or `href`) makes the whole row the control that opens the item.

**The consumer provides** `type` (LP · WS · QZ · VA · RB · EP), `title` ("Water cycle · Class 6"), `meta` ("Lesson plan · today"), `status`, and translated `statusLabel` when not in English. Add `source` where the curriculum matters: "CBSE · NCERT Curiosity 6, Ch 8", "Karnataka State Board (KSEEB)".

**States**
- `synced`: on the server (`leaf-700`) · `waiting`: queued for signal (`saffron-700`) · `local`: saved on this phone only (`text-body`) · `making`: still being generated (`indigo-500`).

**Rules**
- One row per Generation, even after Regenerate: a retry updates the row, it never adds one. Chats with VIDYA never appear here; they live in Conversations (`ConversationRow`).
- The badge is decorative (the meta names the type); its tint is the type's, never a status.
- The status is always a word; colour only repeats it.
- Name the board beside the book in `source`; never NCERT alone.
- Titles stay on one line; Indic titles wrap and are never truncated.
- Row: 18px radius, 72% glass, `shadow-post`; 64px tall, so the whole row is a full touch target.
