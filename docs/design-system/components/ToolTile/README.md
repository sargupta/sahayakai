A tool to open: a lettered badge tinted by type, an arrow, the tool's name and one line on what it makes.

**Use**
- `variant="tool"` (default): two across with a 10px gap where tools are offered by name, such as a tool picker or a "Recent tools" shelf. Badges: LP lesson plan, WS worksheet, QZ quiz, AT attendance; tint by type (`saffron`, `leaf`, `indigo`, `amber`).
- `variant="template"`: three across with a 7px gap for quick-start templates inside a composer ("Fractions · Maths", "Water cycle · Science"). The subject colours the kicker: `amber` maths, `leaf` science, `indigo` social science, `saffron` languages.
- For a plain title-and-line action with no badge (Home quick actions, the Make clusters), use `Tile` instead.

**The consumer provides** `title`, `subtitle` (tool) or `kicker` (template), `mark` (two capital letters), `tone`, and `onClick` or `href`. Pass `lang` when the text is in one language.

**States**
- Rest: tool tiles on `surface-glass-soft` with a 1px `border-glass` edge, `radius-panel`, 14px padding and a soft 6px shadow; template tiles on `surface-glass`, `radius-field`, 10px 8px padding.
- Pressed: `surface-glass-strong` with a 1px `saffron-500` edge, scaled to 98%.
- Disabled: 55% opacity.

**Rules**
- The badge is decorative (`aria-hidden`); the button's name is the title and subline. The arrow shows only when the tile acts.
- Badge letters are 12px/600 at 5:1 or better on their tint: `saffron-700` on `accent-wash`, `leaf-500` on `leaf-wash`, `indigo-500` on `indigo-wash`.
- Tool title 14px/600 in the display face; subline 12px in `text-body`. Template title 12px/600; kicker 12px with 0.08em tracking, capitals for Latin text only. Indic text is never uppercased and floors at 12px.
- Never truncate: sublines and template titles wrap ("Gram Panchayat" takes two lines). Tiles in a row stretch to the tallest.
- Template tiles draw at least 44px tall; tool tiles are well above it.
