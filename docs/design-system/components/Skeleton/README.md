Placeholder blocks, lines and circles for content that is still loading, with a slow white sweep.

**Use** where real content will land within a few seconds: a lesson opening, a list of posts, the register, the queue. Lay the placeholders out in the shape of the component that is coming, at its sizes and gaps:
- a lesson output: an 18px title line, the tag pills as 24px pills, then each section as a `strong` `GlassCard` with an ink title line and two or three ink body lines;
- the register: rows drawn like `RosterRow` (number, name line, a 22px mark circle), 7px apart;
- a post: a milk card with a 26px circle, two meta lines, body lines and the footer counts;
- the queue: rows drawn like a boxed `TaskRow` (an 8px dot, a line, a short status line).
- `variant="block"` (default) for cards and sections, with `height` in px, or `fill` to take the rest of a column.
- `variant="line"` for a line of text: a 10px pill, `width` as a percentage.
- `variant="circle"` for an avatar or the orb, with `size`.
- `tone="glass"` (default) on a screen wash; `tone="ink"` on milk cards and sheets, where white would not show.

**The consumer provides** the layout and the loading region: set `aria-busy="true"` on the container and put one visually hidden `role="status"` line in it ("Loading the lesson"). Remove both when the content arrives.

**States**
- Glass: `surface-glass-strong` (88% white), `radius-tile` for blocks.
- Ink: an 8% ink fill (`border-hairline`).
- The sweep: a soft white band crosses left to right every 1.4s. Under reduced motion it stops and the block stays still.

**Rules**
- Skeletons are `aria-hidden`; never put text in them.
- Use them only for loads over about 300ms, and switch to a message if the wait passes 10 seconds ("Still loading · the signal is weak").
- Never show a skeleton for content that will not come, such as an empty list; use an empty state.
