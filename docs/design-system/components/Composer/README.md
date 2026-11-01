The type-or-speak bar: a pill with a real text input, an optional leaf send disc and the saffron mic.

Voice comes first, but typing always works: the composer is how a teacher asks VIDYA for something without speaking, in any language, and how she keeps working offline.

**Where it fits.** The `chat` variant sits at the foot of the conversation, the typed or turn-based thread. The `sheet` variant sits at the foot of the ask-in-place `VoiceSheet`, a quick ask about the current page. VIDYA Live, hands-free voice, has no composer. Every conversation, typed or Live, is kept in Library → Conversations, never as a Generation.

**Use**
- `variant="chat"` (with `onSend`) under a `ChatThread`: a white 80% pill (`surface-disc`, `border-glass` edge) with a soft shadow, padding 7px 8px 7px 18px, 13px text, and two 38px discs: send and mic. The mic does not pulse here.
- `variant="sheet"` (default) under VIDYA's suggestions in a `VoiceSheet`: `composer-height` (54px) inside a 1px `border-strong` edge on `surface-inset`, 12px text, and the 40px (`mic-size`) mic pulsing (`micpulse` 2.2s).
- For a labelled form value, use `Field`.

**The consumer provides**
- `onSubmit(text)` and/or `onSend(text)`. Enter calls `onSubmit` (or `onSend` without it); the send disc calls `onSend` (or `onSubmit`).
- `onMic`: open the `VoiceSheet` (sheet) or start a voice turn (chat).
- Either `value` + `onChange` or nothing: uncontrolled composers clear after sending.
- `lang` for the language the teacher types in; `state="offline"` when there is no signal; translated `placeholder`, `label`, `sendLabel` and `micLabel`.

**Anatomy:** the send disc is `leaf-500` (done) with the `send` glyph; the mic is a flat `saffron-500` disc with `shadow-mic` and the `mic` glyph, both glyphs white.

**States**
- Focus: the pill takes a 2px `saffron-500` edge and `shadow-current`, as `Field` does.
- Offline: the mic turns `stone-500` with the `mic-off` glyph and stops, and the placeholder says "Typing still works". The mic stays focusable with `aria-disabled`, named "Speak, needs signal". Send still works; the message waits for signal.
- Empty: tapping send puts focus in the input rather than sending nothing.
- Disabled: 55% opacity.

**Rules**
- The mic is a control, so it carries the mic glyph and is never drawn as a sphere. VIDYA herself is the orb.
- The input has an accessible name; the placeholder is an example, never the label.
- Enter submits. It never fires while an Indic keyboard is still composing a word.
- The discs draw at 38px or 40px; their touch areas extend to 44px.
- Reduced motion stops the pulse; nothing depends on it.
