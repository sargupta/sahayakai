A quiet row that opens more: a glass card with a chevron, or a bare text toggle for a hidden section.

**Use**
- `variant="card"` (default) at the end of a list of choices, for what does not earn a tile: "Explore · 8 more tools". With `expanded` it opens the extra choices in place; with `href` it leads to a screen.
- `variant="toggle"` under a composer for settings most teachers never change: "Show advanced options".

**The consumer provides** `title`, `subtitle` (card), and either `expanded` with `controls` (the id of the region it shows) and `onClick`, or `href`. Give `expandedTitle` when the toggle's words change ("Hide advanced options").

**States**
- Card rest: 58% white glass, 1px `border-glass`, `radius-card`, 14px 16px padding; title 14px/600 display, subtitle 12px `text-body`, forward chevron in `saffron-600`. Pressed: `surface-glass-strong`.
- Card expanded: the chevron turns to point down.
- Toggle: 12px/500 `text-body` and an `ink-500` chevron that flips when open; full width and 44px tall.
- Disabled: 55% opacity.

**Rules**
- With `expanded` the row is a button with `aria-expanded` and `aria-controls`; keep the controlled region in the DOM (hidden when closed).
- The chevron is a glyph, never a text triangle.
- Lighter than a `Tile` on purpose: it is the way to more, not a choice itself. Do not stack two card rows.
