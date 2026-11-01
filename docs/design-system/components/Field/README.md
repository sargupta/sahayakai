The field card: an eyebrow label inside a glass card, the value set in Bricolage, and an optional mic button for dictation.

A field in SahayakAI is a card the teacher fills by speaking or typing, never a grey box with a floating label. It is drawn exactly like the lesson composer's cards ("Topic", "Class", "Length"), so a filled form already reads as the plan it will produce.

**Use**
- `size="lg"` for the one field that matters most on a screen (the topic), with `mic`.
- `size="md"` for compact facts, paired two across (Class and Length) or full width (Board).
- `as="select"` when the value comes from a list (Class, Length, Board, Language). The card becomes a button; `onOpen` opens an `OptionSheet`. Never a native dropdown on mobile.
- `surface="inset"` inside sheets and solid cards; `glass` (default) on a screen wash.
- `multiline` for messages and notes; give it `counter` when there is a limit.

**The consumer provides** `label`, either `value` + `onChange` or `defaultValue`, and for selects `onOpen`. With `mic`, they provide `onMic` and switch `mic` between `'idle'` and `'listening'`. They also provide `error` text that says what happened and what to do ("This number has 9 digits. Add the missing digit to call.").

**States**
- Rest: a 1px `border-glass` edge on `surface-glass-strong`.
- Focus: the whole card takes a 2px `saffron-500` edge plus `shadow-current`, the same treatment as the current row in the roll call (3.4:1 or better against every ground).
- Listening: the mic button pulses (`micpulse` 2.2s) inside a 6px saffron halo, and a line under the field says so in words.
- Error: a 2px `red-500` edge and a `red-700` message, announced with `role="alert"`.
- Disabled: 55% opacity, with a helper line that says why.

**Rules**
- The label is a real `<label>` tied to the input. Helper and error are tied with `aria-describedby`, and `aria-invalid` is set on error.
- Labels in Indic scripts are not uppercased or tracked and render at 12px. Indic values get a 1.7 line height.
- Placeholders are examples ("How many in the class?"), never the label.
- The mic is a flat 34px `saffron-500` disc with a white mic glyph: a control the teacher presses to dictate into this one field. It is never a glyph-free sphere, which is VIDYA's orb. Its touch area extends to 44px, and its accessible name is "Speak instead of typing" (translated).
- At the phone's 360px width, an `lg` card spans the 320px between the screen gutters; `md` cards pair two across with a 9px gap. Select values that do not fit end in an ellipsis; typed Indic values never do.
- The card's resting edge is luminous, not a 3:1 boundary. The field is identified by its label, card and value, and its focused edge meets 3:1.
