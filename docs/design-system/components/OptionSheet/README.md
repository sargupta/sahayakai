A bottom sheet of radio rows for picking one value from a list: class, length, board or language.

**Use** whenever a `Field` select, a "more" `Chip` or a third chip such as `BoardSwitch`'s needs a list. It is never a native dropdown. Add `search` for long lists (the 29 boards); keep short lists (classes, lengths) plain. Group rows under eyebrows with `group` ("Your classes", "Other classes").

**The consumer provides**
- `open`, `onClose`, a `title` that names the list, and `value`.
- `onSelect(value)`, plus `options`: strings, or `{ value, label, meta, group, lang, keywords }`.
- Translated `searchPlaceholder`, `searchLabel`, `emptyText` and `countText`.
- Render it inside the positioned screen, and set the page behind to .34 opacity while it is open, as with any `Sheet`. It spans the screen's full width; a long list stops 48px below the top of the screen and only the list scrolls.

**Anatomy:** a `Sheet` with its title, then an optional search pill (the `Composer`'s inset pill at `target-min`, 44px, with a search glyph and no mic), then the list, which is the only part that scrolls. Rows are at least 48px, `radius-row`, on `surface-card` with a `border-row` edge and 7px apart. The label is 500 13px and the meta is 400 12px `ink-600`. The selected row is `accent-tint` with an `accent-tint-border` edge and a `saffron-600` check.

**Behaviour**
- On open, focus goes to the search, or else to the selected row, and the selected row scrolls into view.
- Arrow keys move between rows (Up from the first row returns to the search); Home and End jump. Enter, Space or a tap selects, calls `onSelect` and then `onClose`.
- Escape or a tap on the scrim closes without choosing. Focus returns to whatever opened the sheet, and the search clears.
- While searching, the match count is announced politely, and an empty result says what to try.

**Rules**
- One `role="radiogroup"` named by the title. Rows are `role="radio"` buttons with `aria-checked`, and only one row is in the tab order.
- Selection is shown by tint, edge and check together, never by colour alone.
- Indic labels get a 1.6 line height and their `lang`. Labels are never truncated.
