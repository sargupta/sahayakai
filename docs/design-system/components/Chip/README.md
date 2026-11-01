The selectable pill: languages, classes, boards, include options, Community filters, the scanner's toggles and one-tap actions.

A chip is a real button the teacher taps to choose. Its selected fill carries meaning, so the same colour always means the same kind of choice.

**Use**
- `variant="choice"` (default) for picking. `tone` sets the selected fill: `saffron` for language, `leaf` for classes and include options, `indigo` for the board.
- `size="md"` (12px) for onboarding and profile choices. `size="sm"` (12px) inside composers ("Activity", "Board work") and on the scanner.
- `emphasis` sets unselected text: `strong` (`ink-900`, 600) for language names, `quiet` (`ink-600`, 500) for classes and options. Saffron chips default to strong; the rest default to quiet.
- `variant="more"` for "+7 more": quieter glass (`surface-glass-soft`) that opens an `OptionSheet` instead of toggling. For languages, use `LanguagePicker`, which does this for you.
- `variant="filter"` for the Community filters (12px). The active filter is solid `accent-fill`. Inactive filters are tinted by post type: `saffron` Resource, `amber` Tried this, `leaf` Celebrate, `indigo` Need help.
- `variant="action"` for a chip that runs something rather than choosing: VIDYA's refine chips under an answer ("Make it easier", "In Marathi", "Add a diagram"). 12px/500 on 75% white glass with a `border-glass` edge, 8px 13px. On a card or sheet use `emphasis="strong"`: `surface-card` with a `border-row` edge at 600. `icon="plus"` adds a leading glyph; never type a "+" or other symbol into the label.
- `tone="camera"` on the scanner's dark ground. The active chip is light (`surface-chrome`, `ink-900` text) and inactive chips are `camera-glass` with `on-camera` text.

**The consumer provides** the label (one to three words, translated), `selected`, `onClick`, and `lang` when the label is in another script. Wrap a set in an element with `role="group"` and a name (an `Eyebrow` with `aria-labelledby`). Single choice versus several is the consumer's logic.

**States**
- Unselected: `surface-glass` with a `border-glass` edge (sm chips use 86% white).
- Selected: the tone's solid fill with white text. Hover brightens it and never removes it. Press shows the selected fill.
- Disabled: 45% opacity.
- Forced colours: the selected chip takes the system highlight.

**Rules**
- Renders a `<button>` with `aria-pressed`. The "more" chip has `aria-haspopup="dialog"` and `aria-expanded` instead. An action chip has neither: it runs once and never stays pressed, so say in a live region what it started ("Making it easier…").
- Chips draw at 25 to 38px tall; their touch area extends to 44px. At the phone's 360px width a row of four md chips fits between the 20px gutters; longer sets wrap.
- Never truncate a chip. Rows wrap: chips sit 7px apart (6px for sm, 5px for filters).
- Indic labels are never letter-spaced and render at 12px or larger, with an 18px line.
- A selected saffron chip fills `accent-fill` (`saffron-600`), so white on it is 5.28:1; never `saffron-500` (decided 26 Oct 2026). Keep selected chips at 600 weight, and always pair the fill with `aria-pressed`.
- A chip chooses. A status that cannot be tapped is a `Pill`.
