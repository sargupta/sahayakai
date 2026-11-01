One item in the Shared resources library: its kind and board, title, class / subject / language chips, saves and Save.

**Use**
- The Shared resources screen, two columns 8px apart: put the cards in `<ul class="sk-resourcecard-grid">` with `as="li"`.
- `type` sets the eyebrow word and its colour: `lesson` (Lesson plan) `saffron-600`, `worksheet` `leaf-700`, `quiz` `indigo-500`, `visual` (Visual aid) and `rubric` `saffron-700`, `paper` (Exam paper) `indigo-500`.
- Chips go class, subject, language, in quiet grey on `fill-quiet`.
- `board` puts the board the material follows at the top right, in the curriculum colour (`indigo-500` on `info-tint-strong`), so cards keep one chip row.

**The consumer provides** `type`, `title`, `board`, `chips`, `saves`, `saved` and `onSave`; `onOpen` to make the title open the material; translated `typeLabel`, `savesLabel`, `saveLabel` and `savedLabel`; `headingLevel` to fit the screen's outline.

**States**
- Not saved: "Save" in `saffron-600`.
- Saved: a tick and "Saved" in `leaf-700`, `aria-pressed="true"`, and the count goes up by one.

**Rules**
- Save is a toggle button named "Save Water cycle". The title is a heading; with `onOpen` it is a button. Both touch areas extend to 44px.
- Be board-aware: show the board when the material follows one ("CBSE", "KSEEB", "ICSE"). Never imply NCERT or CBSE only.
- Latin eyebrows are uppercased and tracked; Indic ones are not, and render at 12px. Indic chips render at 12px.
- Only material other teachers chose to publish appears here; every sample is illustrative.
