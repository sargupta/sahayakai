The printable A4 page an artifact becomes: school header, title, facts grid, sections and a footer.

**Use**
- When a teacher chooses Print or Download PDF from the deliver tray. The sheet is laid out at true A4 size (210 × 297 mm): show it at that size in a print preview, and scale it to the screen width with a CSS transform on a phone.
- It is a print surface, not a phone component: never restyle it to the phone's glass.
- One sheet per printed page set. Long artifacts flow onto more pages in print; pass `page` and `pages` for the footer.

**The consumer provides**
- `school`: `name`, `place`, and a `logo` (an image URL or node). Without a logo, the school's initials sit in the 40px slot.
- `title`, rendered as the page's `<h1>`.
- `meta`: the facts grid, four across: Class, Subject, Board, Textbook, Chapter, Duration, Date (and Language when it helps).
- `sections`: `{ title, body }` in teaching order. Bodies can be nodes, such as an ordered list of questions.
- A translated `footer` on non-English sheets; the default is "Prepared with SahayakAI · Page 1 of 2".

**States**
- Screen: a `surface-card` page with a 1px `border-row` edge, `radius-xs` corners and `shadow-card`.
- Print: white paper, black text, no border, radius or shadow, and 16 × 18 mm A4 margins from a named `@page`. Headers, the facts grid and each section avoid breaking across pages.

**Rules**
- Type follows the app: title 20px Bricolage bold, school name 15px semibold, section titles 13px semibold, text 12px/1.6 in `ink-900`, labels 12px uppercase tracked .14em in `text-muted`, footer 12px.
- Always name the board and the textbook ("CBSE", "NCERT Ganita Prakash 7"; "ICSE"; "Karnataka State Board (KSEEB)"). Never print a curriculum the school doesn't follow.
- Indic labels are not uppercased or tracked and render at 12px; Indic text takes a 1.7 line height.
