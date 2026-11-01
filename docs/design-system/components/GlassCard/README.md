A translucent white card with a 1px white edge, drawn over the screen wash: the base surface of every app screen.

**Use**
- The default `glass` (82% white) for cards on a screen. Glass only reads over `wash-screen`; on a solid ground use `solid` or `inset`.
- `radius="panel"` + `raised` for the one primary card on a screen ("Waiting for you"). Every other card stays flat.
- `tone="strong"` (88%) for content the teacher reads: lesson sections, quiz questions, stat cards.
- `tone="soft"` (70%) for secondary things: home tiles, the Recent list.
- `tone="inset"` + `radius="field"` for context inside a sheet ("This page", "Draft so far").
- `tone="accent"` for an item VIDYA posts on the teacher's behalf (the Daily Briefing in Community).

**The consumer provides** the children (usually an `Eyebrow`, a title and body text) and, if needed, `padding` and `gap`. The card stacks its children with a 10px gap.

**Rules**
- No cards inside cards, and no coloured left-border accents.
- The edge is `border-glass`: a luminous separation from the wash, not an outline. Never replace it with a grey border.
- Text on glass reads as on `milk-50`: `ink-900` 18:1, `ink-600` 7.4:1, `ink-500` 5.6:1.
