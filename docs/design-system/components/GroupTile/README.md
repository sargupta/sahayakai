A solid group tile for the Staff room's sideways row: the group in the display face and its member count.

**Use**
- The Staff room's group strip, under the ask bar. Put the tiles in a `<ul class="sk-grouptile-row">`, one `<li>` each. The row scrolls sideways, snaps tile by tile, bleeds to the screen edges and never widens the page.
- `tone` is the tile's solid colour: `saffron` (rendered on `saffron-600`) for subject groups, `leaf` for state groups, `indigo` for class and board groups. Alternate tones along the row.
- For a vertical list of the teacher's groups, use `GroupRow`.

**The consumer provides** `name` (short: "Science · 7", "Maharashtra", "9 Maths · ICSE"), `meta` ("1,204 members"), `tone`, and `onClick` or `href`. The `ul` gets an `aria-label` ("Groups").

**States**
- Rest: the solid tone with a soft shadow of the same tone at 22%.
- Hover: 8% brighter. Press: scales to 98%.

**Rules**
- Tiles are 112px wide and 18px round (`radius-card`). In a row they take the tallest tile's height; long names wrap rather than truncate.
- White text holds 5.4:1 or better on every tone, which is why the saffron tile uses `saffron-600`.
- Each tile is a button named "Science · 7, 1,204 members". Tabbing scrolls the row; touch swipes it.
- Show at least three tiles so the third is cut by the screen edge: that cut is the cue that the row scrolls.
