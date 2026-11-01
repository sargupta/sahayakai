A person's initials in a glass or tinted circle, a solid letter mark for things that are not people, or a photo.

**Use**
- `size="md"` (36px, `tone="glass"`) for the teacher on a screen header, beside the date and their name.
- `size="lg"` (44px, glass) on Profile.
- `size="sm"` (26px) for Community post authors, tinted by `tone`: `amber`, `leaf` or `saffron` at 14%, with initials in the deep tone (`saffron-700`, `leaf-700`, `saffron-600`).
- `shape="square"` (26px, `radius-sm`) for a mark: VIDYA's Daily Briefing ("स", `saffron`, filled `accent-fill`) or a curriculum or board ("N", `indigo`), white 700 text.
- `src` for a photo. It fills the shape, and initials show until there is one.

**The consumer provides** `name` (the full name) and, optionally, `initials` or a mark letter. Initials default to the first letters of the first and last words, keeping Indic conjuncts and matras whole. It also provides `lang` when the initials are in another script.

**Rules**
- An avatar is `role="img"`, named by the full name. Set `decorative` when the name is written right beside it, so screen readers do not hear it twice.
- Glass avatars draw their 1px `border-glass` edge outside the circle: the 36px avatar is 38px overall and the 44px one is 46px.
- An avatar is never a button. To make one tappable, wrap it with its name in a link or button that has a 44px target.
- Indic initials and marks render at 12px, never smaller.
- Use tint for people and solid marks for things, so a solid square always reads as VIDYA or curriculum, not a person.
