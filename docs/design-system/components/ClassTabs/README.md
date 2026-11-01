The teacher's classes as a row of tabs ("6A · 40") with a status dot; the chosen class is solid ink.

**Use** at the top of the register, under the class header, to switch between the teacher's classes. Each tab shows the class and its strength; its tint and dot say whether parents need contacting today. Pass `bleed` inside a 20px-gutter screen so the row runs edge to edge and scrolls under the screen's edges.

**The consumer provides** `classes` (`value`, `count`, `status`, optional `label` and `lang`), `value` and `onChange`, the `controls` id of the register panel below, and translated `statusLabels` and `countText`.

**States**
- Chosen: `ink-900` with white text. The dot keeps the status: `saffron-300` for outreach, `leaf-300` for clear.
- Outreach: `accent-tint-strong` with `saffron-700` text and an `amber-500` dot.
- Clear: `success-tint` with `leaf-700` text and a `leaf-500` dot.
- Pending (register not taken): `fill-quiet` with `ink-600` text and a `dot-idle` dot.

**Rules**
- It is a `tablist` of `tab`s: the arrow keys move and select (Home and End jump), Tab leaves. Only the chosen tab is in the tab order.
- Each tab's name says everything in words: "6A, 40 students, needs outreach". The drawn "6A · 40" and the dot are hidden from assistive tech, so colour never carries the status alone.
- Tabs draw 28px tall (12px/600, 7px 11px, 6px apart). Their touch areas extend to 44px; an 8px inner margin keeps those areas and the focus outline inside the scroller.
- The row scrolls inside its own box and never widens the page; the scrollbar is hidden, and arrow keys bring the chosen tab into view.
- Indic labels render at 12px and are never uppercased.
