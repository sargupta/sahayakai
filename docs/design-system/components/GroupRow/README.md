One of the teacher's groups: a tone dot, the name, its member count and how many posts are new. The row opens it.

**Use**
- "My groups" in Community, stacked 6px apart under a muted `Eyebrow` ("My groups · 3").
- `tone` marks the kind of group: `saffron` for the app's own Daily Briefing, `leaf` for state and school groups ("Karnataka Teachers"), `indigo` for class and board groups ("8 Science · KSEEB", "9 Mathematics · CBSE"), `amber` for interest groups.
- For a group the teacher has not joined, use `PersonRow` with `action="join"` instead.

**The consumer provides** `name`, `meta` ("44 members"), `tone`, `newCount` (or a translated `newLabel`) and `onClick` or `href`.

**States**
- Rest: `surface-glass-chip` with a `border-glass` edge. Hover and press: `surface-glass-strong`; press adds an `accent-tint-border` edge.
- New posts: "2 new" in `saffron-600` at the end. Nothing when there are none.

**Rules**
- The whole row is one button (or link), at least 50px tall. Its name reads "Daily Briefing, 44 members, 2 new".
- The dot is decorative; the name and meta carry the meaning.
- Name class groups board-aware, with the board beside the class: "9 Mathematics · CBSE", "8 Science · KSEEB". Mix boards; never imply CBSE only.
- Indic names are not truncated: they wrap at 13px with a 1.5 line height.
