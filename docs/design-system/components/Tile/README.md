A quick-action tile on soft glass: a display title and one short line, laid out two across on the home screen.

**Use**
- Two across in a grid with a 9px gap (about 155px each on a 360px phone) for the home quick actions ("Roll call", "Make a lesson", "Scan a test", "Call parents"). Four is the norm; never more than six.
- Give it `onClick` (or `href`) and it becomes a full-width, left-aligned button (or link) that fills its grid cell.
- Give it a boolean `selected` only when the tiles are a toggle set (one kind of output out of two or three); it then sets `aria-pressed`.

**The consumer provides** `title` (two or three words, a verb or the task) and `subtitle` (how, in a few words: "Speak the names", "Script in हिन्दी"), plus `onClick` or `href`. Pass `lang` when the tile's text is in one language.

**States**
- Rest: `surface-glass-soft` with a 1px `border-glass` edge, `radius-card`, 13px padding.
- Pressed, and selected: the selected fill, `surface-glass-strong` with a 1px `saffron-500` edge.
- Disabled: 55% opacity.

**Rules**
- Title 13px/600 in the display face, `text-strong`; subtitle 12px in `text-body` (6.2:1 on glass), 2px below.
- A tile is one action. No icons, badges or counts inside it; a count that needs attention belongs in a `TaskRow`.
- The tile draws 60px tall, above the 44px touch minimum. Subtitles may wrap to two lines in long languages; never truncate them.
- Focus is the system outline 2px outside the tile.
