The 44px pill input: search, the Staff room's ask bar and the feed's post prompt, with an optional saffron mic disc.

**Use**
- Search (default): the search glyph and an example placeholder ("Search lessons, quizzes, worksheets…"). The pill is a search landmark; the cross and Escape clear it.
- The post prompt: `glyph={false}` and `type="text"` ("What did you do today?"). Enter posts.
- The Staff room ask bar: `surface="glass"`, `glyph={false}` and `onMic` ("Ask something, or share what worked").
- `surface="solid"` (milk with a hairline) on lists and feeds; `glass` (lifted, 13px text) where the bar is the screen's main input.
- For VIDYA's own type-or-speak bar, use `Composer`; for a labelled form field, use `Field`.

**The consumer provides** a translated `label` (visually hidden; it names the input), a `placeholder`, `value` + `onChange` or `defaultValue`, `onSubmit`, and for dictation `onMic` with `micState`.

**States**
- Rest: `surface-card` with a `border-strong` hairline (solid), or 78% white with a `border-glass` edge and a soft lift (glass).
- Focus: a 2px `saffron-500` edge plus `shadow-current`, as `Field`.
- Typed (search): a quiet cross clears it.
- Dictating: the mic is a toggle (`aria-pressed`) on `saffron-600` and pulses.
- Disabled: 55% opacity.

**Rules**
- It is a real `<input>` with a real `<label>`. Placeholders are examples; the hidden label says what the field is for.
- The mic is a flat 36px disc with a mic glyph, never a sphere: it dictates into this field and is not VIDYA. Its touch area extends to 44px; its name is "Speak instead" (translated).
- Enter submits, never while an Indic keyboard is composing. Indic text renders at 14px.
