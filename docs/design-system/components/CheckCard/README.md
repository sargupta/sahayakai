A multi-select option drawn as a card, plus the plain Checkbox row; both are real checkboxes.

**Use**
- `CheckCard`: two across with a 7px gap when the options are the content of the choice, such as question types ("Multiple choice", "True / false", "Fill in the blanks", "Short answer"). Wrap the set in `role="group"` with `aria-labelledby` pointing at its `Eyebrow`.
- `Checkbox`: a single yes/no beside its label ("Add an answer key", "Print on one page"), stacked with no gap; each row is 44px.
- One of several, exactly one: use `SegmentedControl` or `SuggestionRow`. Short multi-select labels inline (Bloom's levels): use `Chip`.

**The consumer provides** `label`, optional `hint`, and either `checked` with `onChange(checked)` or `defaultChecked`. Give `name` and `value` inside a form. Pass `lang` when the label is in one language.

**States**
- Unchecked: `surface-glass` with a 1.5px `border-glass` edge, 13px radius, no mark.
- Checked: 1.5px `saffron-500` edge, `accent-tint-strong` over `surface-card`, and a 16px saffron disc with a white check glyph.
- Checkbox checked: the 20px box fills `saffron-500` with a white check; unchecked it is `surface-card` with a 1.5px `ink-400` edge (3.6:1).
- Disabled: 55% opacity. `invalid` sets `aria-invalid`; the group's message is the consumer's.

**Rules**
- The native checkbox covers the card invisibly, so a tap anywhere toggles it and Space toggles it from the keyboard. Keyboard focus draws the system outline around the whole card (around the box for Checkbox).
- Label 12px/600 (CheckCard) or 12px/500 (Checkbox) in `text-strong`; Indic labels take 12px and 1.5 to 1.7 line height.
- The check is a glyph, never a text tick. Colour is not the only signal: the disc and edge both change, and the checkbox state is announced.
