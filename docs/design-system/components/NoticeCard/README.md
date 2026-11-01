A tinted inline notice: curriculum alignment with a board mark, VIDYA's offline state, or a one-line trust note.

**Use**
- `tone="indigo"` with `mark` for the curriculum notice on a composer: say which board and chapter VIDYA aligned to before writing ("Aligned to CBSE · NCERT Ganita Prakash 7, Chapter 8 before anything is written"). The mark is the board's initial ("C", "I" for ICSE, "K" for KSEEB).
- `tone="saffron"` with a `title` for VIDYA's own state ("Working offline"), with `role="status"` so the change is announced.
- `tone="leaf"` with a `title` when something finished on its own ("Back online").
- `tone="note"` for the single reassurance line in a deliver tray ("Nothing leaves the phone until you tap send.").

**The consumer provides** the text as `children`, an optional `title` and `mark`, and the board name from the teacher's profile. Every board is named the same way: "CBSE", "ICSE", "Karnataka State Board (KSEEB)", never NCERT alone.

**Layout**
- Without a title: `radius-tile`, 12px 13px padding, 12px/1.45 text, mark centred beside it.
- With a title: `radius-card`, 13px 14px padding, a 13px/600 display title and 12px/1.6 text 5px below.
- Note: `radius-row`, 10px 12px padding, 12px/1.45 `text-body`, no mark.

**Colours**
- Indigo: `info-tint` with `info-tint-border`, text and mark `indigo-500` (7.5:1).
- Saffron: `accent-tint` with `accent-tint-border`, title `saffron-700`, body #7A4A08 (5.8:1).
- Leaf: `leaf-tint` with `leaf-tint-border`, text `leaf-700` (7.5:1).

**Rules**
- The role is `note` by default; use `status` only for a state that changes while the screen is open.
- The mark is decorative (`aria-hidden`): the text must name the board.
- Indic text is never truncated and gets a 1.7 line height.
- One notice per screen region. Never use a notice for an error the teacher must fix; that is the field's or the sheet's job.
